"""
Moratuwa IoT-triggered resource planner.

Flow triggered after each new IoT prediction (iot_flood / iot_landslide):
  1. Skip if predicted status is Normal (no LLM call needed).
  2. Fetch Moratuwa's population from Division table (division_id = MORATUWA_DIVISION_ID).
  3. Fetch Moratuwa's resource inventory from DivisionResources (same division_id).
  4. Compute consideration_score = status_probability × (population / 1_000_000), capped at 1.
  5. Call Gemini with a focused single-division prompt.
  6. Insert a DRAFT ResourcePlan row directly into the DB (no Kafka).

MORATUWA_DIVISION_ID = 121 matches the DivisionResources row for Moratuwa.
The IoT sensors (iot_flood / iot_landslide) are physically located in Moratuwa and
are therefore mapped to this division.
"""

import json
import logging
import time
from typing import Any

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import GEMINI_API_KEY, GEMINI_MODEL
from app.db.models import Division
from app.models.division_resources import DivisionResources
from app.models.resource_plan import ResourcePlan

logger = logging.getLogger(__name__)

MORATUWA_DIVISION_ID = 121

_STATUS_PROBABILITY: dict[str, float] = {
    "Normal":   0.10,
    "Moderate": 0.45,
    "Severe":   0.75,
    "Extreme":  0.95,
}

_SYSTEM_PROMPT = """You are a disaster resource allocation AI for the Sri Lanka Disaster Management Centre (DMC), focused on Moratuwa city.

Given the division's current disaster risk assessment and its resource inventory, produce a concise, actionable allocation plan.

Output ONLY a valid JSON object — no markdown fences, no prose outside JSON.

Required schema:
{
  "situation_summary": "<2 sentences: current risk level and most critical need>",
  "risk_level": "<Normal|Moderate|Severe|Extreme>",
  "consideration_score": 0.0000,
  "immediate_actions": ["<specific action>"],
  "resource_assessment": {
    "hospital_bed_capacity":      {"value": <int|null>,   "status": "<adequate|insufficient|critical|unknown>"},
    "emergency_shelters":         {"value": <int|null>,   "status": "<adequate|insufficient|critical|unknown>"},
    "ambulance_count":            {"value": <int|null>,   "status": "<adequate|insufficient|critical|unknown>"},
    "food_stock_tons":            {"value": <float|null>, "status": "<adequate|insufficient|critical|unknown>"},
    "clean_water_capacity_liters":{"value": <float|null>, "status": "<adequate|insufficient|critical|unknown>"},
    "power_grid_resilience":      {"value": <float|null>, "status": "<adequate|insufficient|critical|unknown>"}
  },
  "external_assistance_required": true|false,
  "escalation_reason": "<null or one sentence if external_assistance_required is true>"
}

Rules:
- consideration_score must be a float between 0 and 1.
- Do not invent resource values not present in the input.
- immediate_actions must contain at least one entry.
"""


def _fmt(val: Any) -> str:
    return "N/A" if val is None else str(val)


def trigger_moratuwa_resource_plan(
    db: Session,
    disaster_type: str,
    predicted_status: str,
) -> None:
    """
    Called by iot_event_handler after each new IoT row is processed.
    Silently skips for Normal status to avoid unnecessary LLM spend.
    Writes one DRAFT ResourcePlan row to the DB on success.
    """
    if predicted_status == "Normal":
        return

    if not GEMINI_API_KEY:
        logger.warning("[MoratuwaPlanner] GEMINI_API_KEY not set — skipping resource plan.")
        return

    try:
        division = (
            db.query(Division)
            .filter(Division.division_id == MORATUWA_DIVISION_ID)
            .first()
        )
        population = int(getattr(division, "population", None) or 0)

        resources = (
            db.query(DivisionResources)
            .filter(DivisionResources.division_id == MORATUWA_DIVISION_ID)
            .first()
        )

        prob = _STATUS_PROBABILITY.get(predicted_status, 0.10)
        population_factor = min(population / 1_000_000.0, 1.0)
        consideration_score = round(prob * population_factor, 4)

        division_name = getattr(division, "division_name", None) or "Moratuwa"

        user_message = (
            f"Division: {division_name} (division_id={MORATUWA_DIVISION_ID})\n"
            f"Disaster type: {disaster_type}\n"
            f"Predicted status: {predicted_status}\n"
            f"Consideration score: {consideration_score}\n"
            f"Population: {population}\n"
            f"\n"
            f"Resource inventory:\n"
            f"  Hospital beds:            {_fmt(resources.hospital_bed_capacity if resources else None)}\n"
            f"  Emergency shelters:       {_fmt(resources.emergency_shelters if resources else None)}\n"
            f"  Ambulances:               {_fmt(resources.ambulance_count if resources else None)}\n"
            f"  Food stock (tons):        {_fmt(resources.food_stock_tons if resources else None)}\n"
            f"  Clean water (liters):     {_fmt(resources.clean_water_capacity_liters if resources else None)}\n"
            f"  Power grid resilience:    {_fmt(resources.power_grid_resilience if resources else None)}\n"
            f"\n"
            f"Produce the allocation plan now."
        )

        client = genai.Client(api_key=GEMINI_API_KEY)
        _RETRY_DELAYS = [4, 10, 20]
        response = None
        for attempt, delay in enumerate([0] + _RETRY_DELAYS):
            if delay:
                logger.info(f"[MoratuwaPlanner] Retrying Gemini in {delay}s (attempt {attempt + 1})")
                time.sleep(delay)
            try:
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    config=types.GenerateContentConfig(
                        system_instruction=_SYSTEM_PROMPT,
                        temperature=0.2,
                        response_mime_type="application/json",
                    ),
                    contents=user_message,
                )
                break
            except Exception as exc:
                is_rate_limit = "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)
                if is_rate_limit and attempt < len(_RETRY_DELAYS):
                    logger.warning(f"[MoratuwaPlanner] Gemini rate limited: {exc}")
                    continue
                raise

        try:
            plan_json = json.loads(response.text)
        except (json.JSONDecodeError, TypeError):
            plan_json = {"raw": response.text}

        plan = ResourcePlan(
            status="DRAFT",
            plan_json=plan_json,
            divisions_analyzed=1,
        )
        db.add(plan)
        db.commit()

        logger.info(
            f"[MoratuwaPlanner] ResourcePlan saved — type={disaster_type} "
            f"status={predicted_status} score={consideration_score}"
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"[MoratuwaPlanner] Failed to create ResourcePlan: {exc}")
