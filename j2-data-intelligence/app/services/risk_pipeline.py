import math
import json
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session
import sqlalchemy as sa

from app.db.models import DisasterPrediction, Division, IoTDevice, RawTelemetry
from app.services.iot_predictor import predict_flood, predict_landslide, label_to_probabilities, label_to_severity_index

SEVERITY_LABELS = ["NORMAL", "MODERATE", "SEVERE", "EXTREME"]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def resolve_division(db: Session, *, division_id: Optional[int], device_id: str, latitude: Optional[float], longitude: Optional[float]) -> Optional[Division]:
    if division_id is not None:
        return db.query(Division).filter(Division.division_id == division_id).first()

    device = db.query(IoTDevice).filter(IoTDevice.device_id == device_id).first()
    if device and device.division_id is not None:
        return db.query(Division).filter(Division.division_id == device.division_id).first()

    if latitude is None or longitude is None:
        return None

    divisions = db.query(Division).filter(Division.latitude.isnot(None), Division.longitude.isnot(None)).all()
    if not divisions:
        return None

    nearest = min(divisions, key=lambda d: _haversine_km(latitude, longitude, float(d.latitude), float(d.longitude)))
    return nearest


def store_raw_telemetry(
    db: Session,
    payload: Dict[str, float],
    division_id: Optional[int],
    hazard_type: str,
) -> RawTelemetry:
    reading = RawTelemetry(
        device_id=str(payload.get("id")),
        division_id=division_id,
        hazard_type=hazard_type.upper(),
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        temp=payload.get("temp"),
        hum=payload.get("hum"),
        depth=payload.get("depth"),
        moist=payload.get("moist"),
        ax=payload.get("ax"),
        ay=payload.get("ay"),
        az=payload.get("az"),
        gx=payload.get("gx"),
        gy=payload.get("gy"),
        gz=payload.get("gz"),
        raw_payload=json.dumps(payload),
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(reading)
    db.flush()
    return reading


def _get_prev_flood_depth(db: Session, current_telemetry_id: int) -> float:
    """Look up the depth from the raw_telemetry row immediately before this one."""
    row = db.execute(sa.text("""
        SELECT depth FROM raw_telemetry
        WHERE hazard_type = 'FLOOD'
          AND depth IS NOT NULL
          AND telemetry_id < :current_id
        ORDER BY telemetry_id DESC
        LIMIT 1
    """), {"current_id": current_telemetry_id}).fetchone()
    return float(row.depth) if row and row.depth is not None else 0.0


def _drought_heuristic_score(payload: Dict, spi: float = 0.0) -> float:
    """Simple heuristic for drought (no IoT-specific model available)."""
    temp = float(payload.get("temp") or 0.0)
    hum  = float(payload.get("hum")  or 0.0)
    temp_norm = _clamp((temp - 10.0) / 30.0)
    hum_norm  = _clamp(hum / 100.0)
    dry_air   = 1.0 - hum_norm
    spi_norm  = _clamp(abs(spi) / 3.0)
    return _clamp(0.45 * temp_norm + 0.35 * dry_air + 0.20 * spi_norm)


def _score_to_probs(score: float) -> Dict[str, float]:
    centers = {"NORMAL": 0.10, "MODERATE": 0.35, "SEVERE": 0.65, "EXTREME": 0.90}
    sigma = 0.18
    weights = {k: math.exp(-((score - c) ** 2) / (2 * sigma * sigma)) for k, c in centers.items()}
    total = sum(weights.values()) or 1.0
    return {k: v / total for k, v in weights.items()}


def create_prediction(
    db: Session,
    *,
    division: Division,
    hazard_type: str,
    payload: Dict[str, float],
    features: Optional[Dict[str, float]] = None,
    telemetry: Optional[RawTelemetry] = None,
) -> DisasterPrediction:
    hazard = hazard_type.upper()
    now = datetime.now(timezone.utc)

    if hazard == "FLOOD":
        depth_prev = _get_prev_flood_depth(db, telemetry.telemetry_id) if telemetry else 0.0
        label = predict_flood(
            temp=float(payload.get("temp") or 0.0),
            hum=float(payload.get("hum") or 0.0),
            depth_prev=depth_prev,
            depth=float(payload.get("depth") or 0.0),
        )
        probs = label_to_probabilities(label)
        severity_idx = label_to_severity_index(label)
        severity_label = label.upper()

    elif hazard == "LANDSLIDE":
        label = predict_landslide(
            temp=float(payload.get("temp")  or 0.0),
            hum=float(payload.get("hum")    or 0.0),
            moist=float(payload.get("moist") or 0.0),
            ax=float(payload.get("ax") or 0.0),
            ay=float(payload.get("ay") or 0.0),
            az=float(payload.get("az") or 0.0),
            gx=float(payload.get("gx") or 0.0),
            gy=float(payload.get("gy") or 0.0),
            gz=float(payload.get("gz") or 0.0),
        )
        probs = label_to_probabilities(label)
        severity_idx = label_to_severity_index(label)
        severity_label = label.upper()

    else:
        # DROUGHT — use heuristic (no IoT sensor model trained for drought)
        score = _drought_heuristic_score(payload, spi=float((features or {}).get("spi") or 0.0))
        raw_probs = _score_to_probs(score)
        probs = {k.lower(): v for k, v in raw_probs.items()}
        top_label = max(raw_probs, key=raw_probs.get)
        severity_idx = SEVERITY_LABELS.index(top_label)
        severity_label = top_label

    prediction = DisasterPrediction(
        division_id=division.division_id,
        feature_date=now.date(),
        predicted_for_date=now.date(),
        horizon=1,
        hazard_type=hazard,
        prob_normal=probs.get("normal", 0.0),
        prob_moderate=probs.get("moderate", 0.0),
        prob_severe=probs.get("severe", 0.0),
        prob_extreme=probs.get("extreme", 0.0),
        predicted_severity=severity_idx,
        predicted_severity_label=severity_label,
        run_at=now,
    )
    db.add(prediction)
    db.flush()
    return prediction
