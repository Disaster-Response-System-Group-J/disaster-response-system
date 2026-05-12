import json
import os
import uuid
from datetime import datetime, timezone
from confluent_kafka import Producer

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "j2.engine.risk-alerts")
ALERT_THRESHOLD = float(os.getenv("KAFKA_ALERT_THRESHOLD", "0.3"))

SEVERITY_LABELS = {
    "prob_normal": "Normal",
    "prob_moderate": "Moderate",
    "prob_severe": "Severe",
    "prob_extreme": "Extreme",
}

HAZARD_LABELS = {
    "flood": "Flood",
    "landslide": "Landslide",
    "drought": "Drought",
}

conf = {
    'bootstrap.servers': KAFKA_BROKER,
    'client.id': 'j2-data-intelligence'
}

_producer = None

def get_producer():
    global _producer
    if _producer is None:
        try:
            _producer = Producer(conf)
        except Exception as e:
            print(f"Failed to connect to Kafka: {e}")
    return _producer

def _as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _build_timestamp(prediction):
    timestamp_source = prediction.get("predicted_for_date") or prediction.get("feature_date") or prediction.get("date")
    if isinstance(timestamp_source, datetime):
        return timestamp_source.isoformat()
    if hasattr(timestamp_source, "year") and hasattr(timestamp_source, "month") and hasattr(timestamp_source, "day"):
        return datetime.combine(timestamp_source, datetime.min.time()).isoformat()
    return datetime.utcnow().isoformat()


def build_prediction_message(prediction):
    severity_probabilities = {
        label: _as_float(prediction.get(field))
        for field, label in SEVERITY_LABELS.items()
    }
    hazard_probabilities = {
        label: _as_float(prediction.get(field))
        for field, label in HAZARD_LABELS.items()
    }

    has_severity_probabilities = any(value > 0 for value in severity_probabilities.values())
    prediction_kind = "severity" if has_severity_probabilities else "hazard"

    if prediction_kind == "severity":
        category_probabilities = severity_probabilities
        category_label = prediction.get("predicted_severity_label")
        if not category_label:
            category_field = max(SEVERITY_LABELS, key=lambda field: _as_float(prediction.get(field)))
            category_label = SEVERITY_LABELS[category_field]
        category_probability = max(category_probabilities.values())
    else:
        category_probabilities = hazard_probabilities
        category_label = prediction.get("dominant_hazard") or max(category_probabilities, key=category_probabilities.get)
        category_probability = prediction.get("dominant_hazard_probability")
        if category_probability is None:
            category_probability = max(category_probabilities.values())

    consideration_score = _as_float(prediction.get("consideration_score"))
    alert_strength = max(category_probability, consideration_score)

    if alert_strength >= 0.75:
        dashboard_severity = "CRITICAL"
    elif alert_strength >= 0.5:
        dashboard_severity = "HIGH"
    elif alert_strength >= ALERT_THRESHOLD:
        dashboard_severity = "MEDIUM"
    else:
        dashboard_severity = "LOW"

    division_name = prediction.get("division_name") or prediction.get("divisionName") or f"Division {prediction.get('division_id')}"
    district = prediction.get("district") or division_name
    forecast_date = prediction.get("predicted_for_date") or prediction.get("date")
    if hasattr(forecast_date, "isoformat"):
        forecast_date = forecast_date.isoformat()

    top_probability_key = max(category_probabilities, key=category_probabilities.get)

    feature_date = prediction.get("feature_date")
    if hasattr(feature_date, "isoformat"):
        feature_date = feature_date.isoformat()

    resource_summary = prediction.get("resource_summary") or {}
    total_resources = _as_float(resource_summary.get("totalResources"))
    available_resources = _as_float(resource_summary.get("availableResources"))
    resource_pressure = 0.0
    if total_resources > 0:
        resource_pressure = max(0.0, min(1.0, 1.0 - (available_resources / total_resources)))

    return {
        "eventId": prediction.get("eventId") or f"pred-{prediction.get('division_id')}-{forecast_date}-{category_label}",
        "eventType": "risk-alert",
        "timestamp": _build_timestamp(prediction),
        "payload": {
            "alertId": prediction.get("alertId") or f"ALT-{prediction.get('division_id')}-{forecast_date}",
            "type": "RISK_ALERT",
            "severity": dashboard_severity,
            "title": f"{category_label} risk forecast for {division_name}",
            "description": (
                f"Highest predicted category: {category_label} at {category_probability:.3f}. "
                f"Consideration score: {consideration_score:.3f}. "
                f"Available resources in {district}: {resource_summary.get('availableResources', 0)}."
            ),
            "district": district,
            "divisionId": prediction.get("division_id"),
            "divisionName": division_name,
            "forecastDate": forecast_date,
            "predictionKind": prediction_kind,
            "predictionCategory": category_label,
            "predictionProbability": category_probability,
            "topProbabilityKey": top_probability_key,
            "probabilities": category_probabilities,
            "considerationScore": consideration_score,
            "resourcePressure": resource_pressure,
            "hazardType": prediction.get("dominant_hazard") if prediction_kind == "hazard" else None,
            "predictedSeverityLabel": prediction.get("predicted_severity_label") if prediction_kind == "severity" else None,
            "featureDate": feature_date,
            "resourceSummary": resource_summary,
        },
    }

def publish_predictions(predictions):
    producer = get_producer()
    if not producer:
        return

    for pred in predictions:
        message = build_prediction_message(pred)
        if not message:
            continue

        if (
            _as_float(message["payload"].get("considerationScore")) < ALERT_THRESHOLD
            and _as_float(message["payload"].get("predictionProbability")) < ALERT_THRESHOLD
            and _as_float(message["payload"].get("resourcePressure")) < ALERT_THRESHOLD
        ):
            continue

        producer.produce(
            KAFKA_TOPIC,
            key=str(pred.get("division_id")),
            value=json.dumps(message),
        )

    producer.flush()


def publish_prediction(division: dict, prediction: dict) -> bool:
    """Publish a single prediction event to Kafka. Returns True if published."""
    producer = get_producer()
    if not producer:
        return False
    merged = {**prediction, **division}
    message = build_prediction_message(merged)
    try:
        producer.produce(
            KAFKA_TOPIC,
            key=str(prediction.get("division_id", "")),
            value=json.dumps(message),
        )
        producer.flush()
        return True
    except Exception as exc:
        print(f"[kafka] publish_prediction failed: {exc}")
        return False


def publish_recommendation(division: dict, recommendation: dict) -> bool:
    """Publish a resource recommendation event to Kafka. Returns True if published."""
    producer = get_producer()
    if not producer:
        return False
    try:
        envelope = {
            "eventId": f"rec-{recommendation.get('recommendation_id', '')}",
            "eventType": "resource-recommendation",
            "timestamp": datetime.utcnow().isoformat(),
            "payload": {
                "divisionId": recommendation.get("division_id"),
                "divisionName": division.get("division_name"),
                "district": division.get("district"),
                "hazardType": recommendation.get("hazard_type"),
                "riskCategory": recommendation.get("risk_category"),
                "considerationScore": recommendation.get("consideration_score"),
                "recommendationText": recommendation.get("recommendation_text"),
                "resourceAllocation": recommendation.get("resource_allocation", {}),
            },
        }
        producer.produce(
            KAFKA_TOPIC,
            key=str(recommendation.get("division_id", "")),
            value=json.dumps(envelope),
        )
        producer.flush()
        return True
    except Exception as exc:
        print(f"[kafka] publish_recommendation failed: {exc}")
        return False


KAFKA_TOPIC_ALLOCATION = os.getenv("KAFKA_TOPIC_ALLOCATION", "j2.engine.allocation-plan")


def publish_allocation_plan(
    plan: dict,
    divisions_analyzed: int,
    high_risk_divisions: list,
    generated_at: str,
) -> bool:
    """Publish a resource allocation plan to Kafka (used by resource_allocation_agent)."""
    try:
        producer = get_producer()
        if not producer:
            return False
        envelope = {
            "eventId": str(uuid.uuid4()),
            "eventType": "allocation-plan",
            "timestamp": datetime.utcnow().isoformat(),
            "payload": {
                "generated_at": generated_at,
                "divisions_analyzed": divisions_analyzed,
                "high_risk_divisions": high_risk_divisions,
                "allocation_plan": plan,
            },
        }
        producer.produce(
            topic=KAFKA_TOPIC_ALLOCATION,
            key="allocation-plan",
            value=json.dumps(envelope),
        )
        producer.flush()
        return True
    except Exception as exc:
        print(f"[kafka] Failed to publish allocation plan: {exc}")
        return False
