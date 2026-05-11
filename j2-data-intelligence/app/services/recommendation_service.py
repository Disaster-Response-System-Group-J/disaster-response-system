import json
import os
from datetime import datetime, timezone
from typing import Dict, Optional

import httpx
from sqlalchemy.orm import Session

from app.db.models import Division, DivisionResource, ResourceRecommendation

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


def _resource_profile(db: Session, division: Division) -> Dict[str, object]:
    resource_row = db.query(DivisionResource).filter(DivisionResource.division_id == division.division_id).first()
    if not resource_row:
        return {
            "hospital_bed_capacity": None,
            "emergency_shelters": None,
            "ambulance_count": None,
            "food_stock_tons": None,
            "clean_water_capacity_liters": None,
            "power_grid_resilience": None,
        }

    return {
        "hospital_bed_capacity": resource_row.hospital_bed_capacity,
        "emergency_shelters": resource_row.emergency_shelters,
        "ambulance_count": resource_row.ambulance_count,
        "food_stock_tons": resource_row.food_stock_tons,
        "clean_water_capacity_liters": resource_row.clean_water_capacity_liters,
        "power_grid_resilience": resource_row.power_grid_resilience,
    }


def _fallback_recommendation(division: Division, hazard_type: str, severity: str, consideration_score: float, resource_profile: Dict[str, object]) -> Dict[str, object]:
    priority = "LOW"
    ambulance = 1
    shelters = 1
    if consideration_score >= 0.75 or severity == "EXTREME":
        priority = "CRITICAL"
        ambulance = 3
        shelters = 3
    elif consideration_score >= 0.5 or severity == "SEVERE":
        priority = "HIGH"
        ambulance = 2
        shelters = 2
    elif consideration_score >= 0.25 or severity == "MODERATE":
        priority = "MEDIUM"

    text = (
        f"{priority} response for {division.division_name}: deploy {ambulance} ambulance(s), "
        f"prepare {shelters} shelter(s), assign district officer to monitor {hazard_type.lower()} risk, "
        f"and pre-position food, water, and medical support based on current capacity."
    )

    allocation = {
        "priority": priority,
        "ambulances": ambulance,
        "shelters": shelters,
        "food_support_tons": 1.0 if priority in {"HIGH", "CRITICAL"} else 0.25,
        "water_liters": 5000 if priority in {"HIGH", "CRITICAL"} else 1500,
        "field_officers": 2 if priority in {"HIGH", "CRITICAL"} else 1,
        "notes": "Fallback heuristic recommendation because Gemini API is unavailable.",
        "resource_profile": resource_profile,
    }
    return {"recommendation_text": text, "resource_allocation": allocation, "model_name": "heuristic-fallback"}


def _prompt_payload(division: Division, hazard_type: str, severity: str, prediction_probability: float, consideration_score: float, resource_profile: Dict[str, object]) -> str:
    return json.dumps(
        {
            "division": {
                "id": division.division_id,
                "name": division.division_name,
                "district": division.district,
                "population": division.division_population,
                "latitude": division.latitude,
                "longitude": division.longitude,
            },
            "hazard_type": hazard_type,
            "severity": severity,
            "prediction_probability": prediction_probability,
            "consideration_score": consideration_score,
            "resource_profile": resource_profile,
            "required_output": {
                "recommendation_text": "string",
                "resource_allocation": {
                    "priority": "LOW|MEDIUM|HIGH|CRITICAL",
                    "ambulances": "integer",
                    "shelters": "integer",
                    "food_support_tons": "number",
                    "water_liters": "number",
                    "field_officers": "integer"
                }
            }
        },
        indent=2,
    )


def _gemini_recommendation(division: Division, hazard_type: str, severity: str, prediction_probability: float, consideration_score: float, resource_profile: Dict[str, object]) -> Optional[Dict[str, object]]:
    if not GEMINI_API_KEY:
        return None

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "You are an emergency operations officer assistant. "
                            "Return only valid JSON with keys recommendation_text and resource_allocation. "
                            "Make the recommendation practical, concise, and focused on immediate response actions. "
                            "Use the provided division, hazard, probability, consideration score, and resource profile.\n\n"
                            + _prompt_payload(division, hazard_type, severity, prediction_probability, consideration_score, resource_profile)
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.9,
            "maxOutputTokens": 512,
        },
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                f"{GEMINI_ENDPOINT}?key={GEMINI_API_KEY}",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            recommendation_text = str(parsed.get("recommendation_text") or "")
            resource_allocation = parsed.get("resource_allocation") or {}
            return {
                "recommendation_text": recommendation_text,
                "resource_allocation": resource_allocation,
                "model_name": GEMINI_MODEL,
            }
    except Exception:
        return None


def build_recommendation(db: Session, *, division: Division, hazard_type: str, severity: str, prediction_probability: float, consideration_score: float) -> ResourceRecommendation:
    resource_profile = _resource_profile(db, division)
    recommendation = _gemini_recommendation(
        division,
        hazard_type,
        severity,
        prediction_probability,
        consideration_score,
        resource_profile,
    )
    if recommendation is None:
        recommendation = _fallback_recommendation(division, hazard_type, severity, consideration_score, resource_profile)

    record = ResourceRecommendation(
        division_id=division.division_id,
        hazard_type=hazard_type.upper(),
        risk_category=severity.upper(),
        consideration_score=consideration_score,
        recommendation_text=recommendation["recommendation_text"],
        resource_allocation_json=json.dumps(recommendation["resource_allocation"]),
        model_name=recommendation["model_name"],
        created_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.flush()
    return record
