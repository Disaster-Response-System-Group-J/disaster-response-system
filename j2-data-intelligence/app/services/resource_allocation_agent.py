import csv
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.models.consideration_score import ConsiderationScore
from app.models.disaster_risk import DisasterRisk
from app.models.division import Division

_CSV_PATH = (
    Path(__file__).parents[2]
    / "Model Training and Validation"
    / "synthetic_resources_dataset(in).csv"
)

SYSTEM_PROMPT = """You are the Disaster Response Resource Allocation Agent for the Sri Lanka Disaster Management Centre (DMC).

Analyse the hazard conditions and available emergency resources across Sri Lankan administrative divisions, then produce a prioritised, actionable allocation plan that minimises casualties and suffering.

## Input Data

### 1. Division Resource Inventory
Static resource stocks per division. Columns: hospital_bed_capacity, emergency_shelters, ambulance_count, food_stock_tons, clean_water_capacity_liters, power_grid_resilience (0=fragile → 1=resilient). N/A = data not collected — assume worst-case scarcity.

### 2. Disaster Risk Assessment
Model output per division. Columns: disaster_type, risk_level (Normal→Moderate→Severe→Extreme), risk_score (0–1 model confidence), consideration_score (0–1 composite of hazard probability × severity multiplier × normalised population density — higher = more urgent).

### 3. Administrative Board Decisions
Mandatory constraints from the Disaster Management Board. When a directive conflicts with a model recommendation, the directive takes precedence. Apply every directive explicitly.

## Responsibilities
1. Rank all divisions by urgency using consideration_score and risk_level as primary signals.
2. Recommend specific redistribution of mobile resources (ambulances, food, water) from surplus low-risk divisions to high-risk deficit divisions — include quantities.
3. Flag divisions with critically insufficient resources relative to their hazard level.
4. Identify where national or international assistance is required.
5. Honour every administrative directive.

## Output Format

Respond with a single valid JSON object matching this schema exactly. No markdown, no prose outside the JSON.

```json
{
  "executive_summary": {
    "situation_overview": "<2–3 sentence overall picture of current hazard conditions and the most critical needs>",
    "top_priorities": ["<Division – one-line reason>"]
  },
  "tier1_immediate": [
    {
      "division": "<name>",
      "disaster_type": "<type>",
      "risk_level": "Extreme|Severe",
      "consideration_score": 0.0000,
      "resource_gaps": [
        {
          "resource": "<ambulance_count|food_stock_tons|clean_water_capacity_liters|hospital_bed_capacity|emergency_shelters|power_grid_resilience>",
          "current_value": "<value or null>",
          "assessment": "critical|insufficient|unknown"
        }
      ],
      "deployments": [
        {
          "resource": "<resource name>",
          "quantity": "<amount with unit>",
          "from_division": "<source division>",
          "rationale": "<one sentence>"
        }
      ]
    }
  ],
  "tier2_monitoring": [
    {
      "division": "<name>",
      "disaster_type": "<type>",
      "risk_level": "Moderate",
      "consideration_score": 0.0000,
      "recommended_actions": ["<concise action>"]
    }
  ],
  "tier3_stable": [
    {
      "division": "<name>",
      "surplus_resources": [
        {
          "resource": "<resource name>",
          "transferable_quantity": "<amount with unit>"
        }
      ]
    }
  ],
  "reallocation_plan": [
    {
      "from_division": "<name>",
      "to_division": "<name>",
      "resource": "<resource name>",
      "quantity": "<amount with unit>",
      "rationale": "<one sentence>"
    }
  ],
  "administrative_directives": [
    {
      "directive": "<verbatim or close paraphrase of the board decision>",
      "application": "<exactly how it shaped this plan>"
    }
  ],
  "escalation_flags": [
    {
      "division": "<name or null if national-level>",
      "resource": "<resource name>",
      "reason": "<why local capacity is insufficient>",
      "level": "national|international",
      "recommended_action": "<specific ask>"
    }
  ]
}
```

Rules:
- consideration_score must be a float (not a string).
- Do not invent resources or divisions not present in the input data.
- If no administrative directives were issued, return an empty array for administrative_directives.
- If no escalation is needed, return an empty array for escalation_flags.
- Omit a tier entirely from the array if no divisions qualify — do not include placeholder objects.
"""


def _load_csv() -> dict[str, dict[str, Any]]:
    """Return resources keyed by division name, with None for missing values."""
    resources: dict[str, dict[str, Any]] = {}
    if not _CSV_PATH.exists():
        return resources
    with open(_CSV_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row.get("division", "").strip()
            if not name:
                continue
            resources[name] = {
                "hospital_bed_capacity": row.get("hospital_bed_capacity") or None,
                "emergency_shelters": row.get("emergency_shelters") or None,
                "ambulance_count": row.get("ambulance_count") or None,
                "food_stock_tons": row.get("food_stock_tons") or None,
                "clean_water_capacity_liters": row.get("clean_water_capacity_liters") or None,
                "power_grid_resilience": row.get("power_grid_resilience") or None,
            }
    return resources


def _fmt(val: Any) -> str:
    return "N/A" if val is None or val == "" else str(val)


def _query_risk(db: Session, target_date: date | None) -> dict[str, list[dict]]:
    """Return {division_name: [{disaster_type, risk_level, score}]} from DB."""
    try:
        if target_date:
            rows = (
                db.query(Division.name, DisasterRisk)
                .join(DisasterRisk, Division.division_id == DisasterRisk.division_id)
                .filter(DisasterRisk.date == target_date)
                .all()
            )
        else:
            subq = (
                db.query(
                    DisasterRisk.division_id,
                    func.max(DisasterRisk.date).label("max_date"),
                )
                .group_by(DisasterRisk.division_id)
                .subquery()
            )
            rows = (
                db.query(Division.name, DisasterRisk)
                .join(DisasterRisk, Division.division_id == DisasterRisk.division_id)
                .join(
                    subq,
                    (DisasterRisk.division_id == subq.c.division_id)
                    & (DisasterRisk.date == subq.c.max_date),
                )
                .all()
            )
        result: dict[str, list[dict]] = {}
        for div_name, risk in rows:
            result.setdefault(div_name, []).append(
                {
                    "disaster_type": risk.disaster_type or "Unknown",
                    "risk_level": risk.risk_level or "Unknown",
                    "score": risk.score,
                }
            )
        return result
    except Exception:
        return {}


def _query_consideration_scores(db: Session) -> dict[str, list[tuple[str, float]]]:
    """Return {division_name: [(hazard_type, score)]} from DB."""
    try:
        rows = (
            db.query(Division.name, ConsiderationScore)
            .join(ConsiderationScore, Division.division_id == ConsiderationScore.division_id)
            .all()
        )
        result: dict[str, list[tuple[str, float]]] = {}
        for div_name, cs in rows:
            result.setdefault(div_name, []).append((cs.hazard_type, cs.consideration_score))
        return result
    except Exception:
        return {}


def _build_resources_table(resources: dict[str, dict[str, Any]]) -> str:
    header = (
        "Division | Hosp Beds | Shelters | Ambulances | Food (tons) | Water (L) | Power Resilience\n"
        "---|---|---|---|---|---|---"
    )
    lines = [header]
    for name in sorted(resources):
        r = resources[name]
        lines.append(
            f"{name} | {_fmt(r.get('hospital_bed_capacity'))} | "
            f"{_fmt(r.get('emergency_shelters'))} | "
            f"{_fmt(r.get('ambulance_count'))} | "
            f"{_fmt(r.get('food_stock_tons'))} | "
            f"{_fmt(r.get('clean_water_capacity_liters'))} | "
            f"{_fmt(r.get('power_grid_resilience'))}"
        )
    return "\n".join(lines)


def _build_risk_table(
    all_divisions: set[str],
    risk_data: dict[str, list[dict]],
    cs_lookup: dict[str, list[tuple[str, float]]],
) -> tuple[str, list[str]]:
    header = (
        "Division | Disaster Type | Risk Level | Risk Score | Consideration Score\n"
        "---|---|---|---|---"
    )
    lines = [header]
    high_risk: list[str] = []

    for name in sorted(all_divisions):
        hazards = risk_data.get(name, [])
        cs_list = cs_lookup.get(name, [])

        if not hazards and not cs_list:
            lines.append(f"{name} | N/A | N/A | N/A | N/A")
            continue

        if hazards:
            for h in hazards:
                cs_val = next(
                    (c for ht, c in cs_list if ht.lower() == h["disaster_type"].lower()),
                    None,
                )
                cs_str = f"{cs_val:.4f}" if cs_val is not None else "N/A"
                lines.append(
                    f"{name} | {h['disaster_type']} | {h['risk_level']} | "
                    f"{_fmt(h['score'])} | {cs_str}"
                )
                if h["risk_level"] in ("Severe", "Extreme") and name not in high_risk:
                    high_risk.append(name)
        else:
            for ht, c in cs_list:
                lines.append(f"{name} | {ht} | N/A | N/A | {c:.4f}")

    return "\n".join(lines), high_risk


def run_allocation_agent(
    db: Session,
    admin_decisions: str,
    target_date: date | None = None,
) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")

    resources = _load_csv()
    risk_data = _query_risk(db, target_date)
    cs_lookup = _query_consideration_scores(db)

    all_divisions = set(resources.keys()) | set(risk_data.keys())
    resources_table = _build_resources_table(resources)
    risk_table, high_risk = _build_risk_table(all_divisions, risk_data, cs_lookup)

    admin_text = (
        admin_decisions.strip()
        if admin_decisions.strip()
        else "No specific administrative directives have been issued at this time."
    )

    user_message = f"""## Division Resource Inventory

{resources_table}

## Current Disaster Risk Assessment

{risk_table}

## Administrative Board Decisions

{admin_text}

---

Based on the above data, produce the complete resource allocation plan now.
"""

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            response_mime_type="application/json",
        ),
        contents=user_message,
    )

    try:
        allocation_plan = json.loads(response.text)
    except (json.JSONDecodeError, TypeError):
        allocation_plan = {"raw": response.text}

    return {
        "allocation_plan": allocation_plan,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "divisions_analyzed": len(all_divisions),
        "high_risk_divisions": high_risk,
    }
