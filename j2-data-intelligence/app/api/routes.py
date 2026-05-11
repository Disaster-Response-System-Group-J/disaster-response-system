import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import DisasterPrediction
from app.services.feature_engineering import build_computed_features
from app.services.kafka_producer import publish_prediction, publish_recommendation
from app.services.recommendation_service import build_recommendation
from app.services.risk_pipeline import create_prediction, resolve_division, store_raw_telemetry

router = APIRouter(prefix="/api/v1", tags=["j2-data-intelligence"])


class J1ReadingIn(BaseModel):
    id: str = Field(..., description="J1 device id")
    type: str = Field(..., description="FLOOD|LANDSLIDE|DROUGHT")
    temp: Optional[float] = None
    hum: Optional[float] = None
    depth: Optional[float] = None
    moist: Optional[float] = None
    ax: Optional[float] = None
    ay: Optional[float] = None
    az: Optional[float] = None
    gx: Optional[float] = None
    gy: Optional[float] = None
    gz: Optional[float] = None
    division_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@router.get("/intelligence")
def intelligence_info() -> Dict[str, str]:
    return {
        "service": "j2-data-intelligence",
        "status": "ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/ingest-and-predict")
def ingest_and_predict(payload: J1ReadingIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    payload_dict = payload.model_dump()
    hazard_type = payload.type.upper()
    if hazard_type not in {"FLOOD", "LANDSLIDE", "DROUGHT"}:
        raise HTTPException(status_code=400, detail="type must be one of FLOOD, LANDSLIDE, DROUGHT")

    division = resolve_division(
        db,
        division_id=payload.division_id,
        device_id=payload.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    if not division:
        raise HTTPException(
            status_code=404,
            detail="Could not resolve division. Provide division_id, registered IoT_Device, or latitude/longitude.",
        )

    telemetry = store_raw_telemetry(db, payload_dict, division.division_id, hazard_type)
    feature_row = build_computed_features(db, telemetry, division)
    prediction = create_prediction(
        db,
        division=division,
        hazard_type=hazard_type,
        payload=payload_dict,
        features={
            "rain_lag_1": feature_row.rain_lag_1,
            "rain_rolling_3d": feature_row.rain_rolling_3d,
            "rain_rolling_7d": feature_row.rain_rolling_7d,
            "month_sin": feature_row.month_sin,
            "month_cos": feature_row.month_cos,
            "spi": feature_row.spi,
            "division_encoded": feature_row.division_encoded,
            "level_difference": feature_row.level_difference,
        },
    )
    db.commit()

    pred_data = {
        "prediction_id": prediction.prediction_id,
        "division_id": prediction.division_id,
        "hazard_type": prediction.hazard_type,
        "prob_normal": float(prediction.prob_normal or 0.0),
        "prob_moderate": float(prediction.prob_moderate or 0.0),
        "prob_severe": float(prediction.prob_severe or 0.0),
        "prob_extreme": float(prediction.prob_extreme or 0.0),
        "predicted_severity": prediction.predicted_severity,
        "predicted_severity_label": prediction.predicted_severity_label,
        "prediction_probability": float(
            max(
                prediction.prob_normal or 0.0,
                prediction.prob_moderate or 0.0,
                prediction.prob_severe or 0.0,
                prediction.prob_extreme or 0.0,
            )
        ),
        "feature_date": prediction.feature_date.isoformat() if prediction.feature_date else None,
        "predicted_for_date": prediction.predicted_for_date.isoformat() if prediction.predicted_for_date else None,
        "horizon": prediction.horizon,
    }
    population = float(division.division_population or 0.0)
    population_factor = min(population / 1000000.0, 1.0) if population > 0 else 0.0
    consideration_score = float(pred_data["prediction_probability"] * population_factor)
    pred_data["consideration_score"] = consideration_score

    division_payload = {
        "division_name": division.division_name,
        "district": division.district,
        "latitude": float(division.latitude) if division.latitude is not None else None,
        "longitude": float(division.longitude) if division.longitude is not None else None,
    }
    kafka_published = publish_prediction(division=division_payload, prediction=pred_data)

    recommendation = build_recommendation(
        db,
        division=division,
        hazard_type=hazard_type,
        severity=pred_data["predicted_severity_label"],
        prediction_probability=pred_data["prediction_probability"],
        consideration_score=consideration_score,
    )
    db.commit()
    recommendation_payload = {
        "recommendation_id": recommendation.recommendation_id,
        "division_id": recommendation.division_id,
        "hazard_type": recommendation.hazard_type,
        "risk_category": recommendation.risk_category,
        "consideration_score": float(recommendation.consideration_score or 0.0),
        "recommendation_text": recommendation.recommendation_text,
        "resource_allocation": json.loads(recommendation.resource_allocation_json or "{}"),
        "model_name": recommendation.model_name,
        "created_at": recommendation.created_at.isoformat() if recommendation.created_at else None,
    }
    recommendation_published = publish_recommendation(division=division_payload, recommendation=recommendation_payload)

    return {
        "status": "processed",
        "kafka_published": kafka_published,
        "recommendation_published": recommendation_published,
        "division": {
            "division_id": division.division_id,
            "division_name": division.division_name,
            "district": division.district,
            "latitude": division_payload["latitude"],
            "longitude": division_payload["longitude"],
        },
        "prediction": pred_data,
        "recommendation": recommendation_payload,
    }


@router.get("/predictions/latest")
def latest_predictions(limit: int = 20, db: Session = Depends(get_db)) -> Dict[str, List[Dict[str, Any]]]:
    rows = (
        db.query(DisasterPrediction)
        .order_by(DisasterPrediction.run_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )

    return {
        "predictions": [
            {
                "prediction_id": row.prediction_id,
                "division_id": row.division_id,
                "hazard_type": row.hazard_type,
                "predicted_severity": row.predicted_severity,
                "predicted_severity_label": row.predicted_severity_label,
                "prob_normal": float(row.prob_normal or 0.0),
                "prob_moderate": float(row.prob_moderate or 0.0),
                "prob_severe": float(row.prob_severe or 0.0),
                "prob_extreme": float(row.prob_extreme or 0.0),
                "run_at": row.run_at.isoformat() if row.run_at else None,
            }
            for row in rows
        ]
    }
