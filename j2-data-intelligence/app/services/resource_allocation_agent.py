import csv
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

Your role is to analyse current hazard conditions and available emergency resources across Sri Lankan administrative divisions, then produce a prioritised, actionable allocation plan that minimises casualties and suffering.

## Data You Will Receive

Each request contains three structured inputs:

### 1. Division Resource Inventory
A table of each division's current static resource stocks:

| Column | Meaning |
|---|---|
| hospital_bed_capacity | Total hospital beds available |
| emergency_shelters | Number of functioning emergency shelters |
| ambulance_count | Ambulances stationed in the division |
| food_stock_tons | Food reserves in metric tons |
| clean_water_capacity_liters | Clean water storage capacity in litres |
| power_grid_resilience | Power grid resilience: 0 = fully fragile, 1 = fully resilient |

Values shown as N/A mean the data has not yet been collected — treat them conservatively (assume worst-case scarcity).

### 2. Current Disaster Risk Assessment
Latest predictive model output per division:

| Column | Meaning |
|---|---|
| disaster_type | Hazard category (Flood, Landslide, Drought, etc.) |
| risk_level | Predicted severity class: Normal → Moderate → Severe → Extreme |
| risk_score | Model confidence in that class (0–1) |
| consideration_score | Composite priority score (0–1) combining hazard probability, severity class multiplier, and normalised population density. Higher = more urgent. |

### 3. Administrative Board Decisions
Official directives from the Disaster Management Board. These are mandatory constraints — every allocation decision must comply with them. When a directive conflicts with a model recommendation, the directive takes precedence.

## Your Responsibilities

1. Rank all divisions by urgency, using consideration_score and risk_level as the primary signals.
2. Recommend specific redistribution of mobile resources (ambulances, food, water) from low-risk surplus divisions to high-risk deficit divisions — include quantities wherever possible.
3. Flag divisions with critically insufficient resources relative to their hazard level.
4. Identify resource categories or divisions requiring national-level or international assistance.
5. Incorporate every administrative board decision explicitly.
6. Provide clear, concise reasoning for every major allocation or reallocation decision.

## Output Format

### EXECUTIVE SUMMARY
2–3 sentences covering the overall situation and top priorities.

### PRIORITY TIER 1 — IMMEDIATE ACTION (Extreme / Severe)
For each critical division:
- Division | District | Risk profile
- Resource gaps identified
- Recommended deployment (with specific quantities)
- Source of reallocated resources

### PRIORITY TIER 2 — ACTIVE MONITORING (Moderate)
Divisions needing standby preparation and pre-positioned resources.

### PRIORITY TIER 3 — STABLE (Normal / no data)
Divisions safe to draw surplus resources from.

### RESOURCE REALLOCATION TABLE
| From Division | To Division | Resource | Quantity | Rationale |
|---|---|---|---|---|

### ADMINISTRATIVE DIRECTIVES — HOW APPLIED
For each board directive, state exactly how it was incorporated into the plan.

### ESCALATION FLAGS
Resource categories or divisions where local capacity is insufficient and national or international escalation is required.
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
        ),
        contents=user_message,
    )

    return {
        "allocation_plan": response.text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "divisions_analyzed": len(all_divisions),
        "high_risk_divisions": high_risk,
    }
