import math
import json
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.db.models import DisasterPrediction, Division, IoTDevice, RawTelemetry

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


def _risk_score(hazard: str, payload: Dict[str, float], features: Optional[Dict[str, float]] = None) -> float:
    temp = float(payload.get("temp") or 0.0)
    hum = float(payload.get("hum") or 0.0)
    depth = float(payload.get("depth") or 0.0)
    moist = float(payload.get("moist") or 0.0)
    ax = float(payload.get("ax") or 0.0)
    ay = float(payload.get("ay") or 0.0)
    az = float(payload.get("az") or 0.0)

    temp_norm = _clamp((temp - 10.0) / 30.0)
    hum_norm = _clamp(hum / 100.0)
    features = features or {}
    rain_lag_1 = float(features.get("rain_lag_1") or 0.0)
    rain_rolling_3d = float(features.get("rain_rolling_3d") or 0.0)
    rain_rolling_7d = float(features.get("rain_rolling_7d") or 0.0)
    spi = float(features.get("spi") or 0.0)
    level_difference = float(features.get("level_difference") or 0.0)

    hazard = hazard.upper()
    if hazard == "FLOOD":
        depth_norm = _clamp(depth / 2.0)
        rolling_norm = _clamp((rain_rolling_3d + rain_rolling_7d) / 30.0)
        spike_norm = _clamp(abs(level_difference) / 3.0)
        spi_norm = _clamp(abs(spi) / 3.0)
        return _clamp(0.45 * depth_norm + 0.20 * hum_norm + 0.15 * rolling_norm + 0.10 * spike_norm + 0.10 * spi_norm)

    if hazard == "LANDSLIDE":
        moist_norm = _clamp(moist / 1023.0)
        accel = math.sqrt(ax * ax + ay * ay + az * az)
        accel_delta_norm = _clamp(abs(accel - 9.81) / 5.0)
        return _clamp(0.50 * moist_norm + 0.25 * accel_delta_norm + 0.15 * hum_norm + 0.10 * _clamp(abs(spi) / 3.0))

    if hazard == "DROUGHT":
        dry_air = 1.0 - hum_norm
        return _clamp(0.45 * temp_norm + 0.35 * dry_air + 0.20 * _clamp(abs(spi) / 3.0))

    return 0.5


def _risk_to_class_probabilities(score: float) -> Dict[str, float]:
    centers = {
        "NORMAL": 0.10,
        "MODERATE": 0.35,
        "SEVERE": 0.65,
        "EXTREME": 0.90,
    }
    sigma = 0.18

    weights: Dict[str, float] = {}
    for label, center in centers.items():
        exponent = -((score - center) ** 2) / (2 * sigma * sigma)
        weights[label] = math.exp(exponent)

    total = sum(weights.values()) or 1.0
    return {label: value / total for label, value in weights.items()}


def create_prediction(db: Session, *, division: Division, hazard_type: str, payload: Dict[str, float], features: Optional[Dict[str, float]] = None) -> DisasterPrediction:
    score = _risk_score(hazard_type, payload, features)
    probs = _risk_to_class_probabilities(score)
    top_label = max(probs, key=probs.get)

    prediction = DisasterPrediction(
        division_id=division.division_id,
        feature_date=datetime.now(timezone.utc).date(),
        predicted_for_date=datetime.now(timezone.utc).date(),
        horizon=1,
        hazard_type=hazard_type.upper(),
        prob_normal=probs["NORMAL"],
        prob_moderate=probs["MODERATE"],
        prob_severe=probs["SEVERE"],
        prob_extreme=probs["EXTREME"],
        predicted_severity=SEVERITY_LABELS.index(top_label),
        predicted_severity_label=top_label,
        run_at=datetime.now(timezone.utc),
    )
    db.add(prediction)
    db.flush()
    return prediction
