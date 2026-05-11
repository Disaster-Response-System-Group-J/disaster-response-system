import json
import uuid
from datetime import datetime, timezone
from typing import Any

from confluent_kafka import Producer

from app.core.config import KAFKA_BROKER, KAFKA_TOPIC_ALLOCATION

_producer: Producer | None = None


def _get_producer() -> Producer:
    global _producer
    if _producer is None:
        _producer = Producer({
            "bootstrap.servers": KAFKA_BROKER,
            "client.id": "j2-data-intelligence",
        })
    return _producer


def publish_allocation_plan(
    plan: dict[str, Any],
    divisions_analyzed: int,
    high_risk_divisions: list[str],
    generated_at: str,
) -> bool:
    try:
        producer = _get_producer()
        envelope = {
            "eventId": str(uuid.uuid4()),
            "eventType": "allocation-plan",
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
            value=json.dumps(envelope).encode("utf-8"),
        )
        producer.flush(timeout=5)
        return True
    except Exception as exc:
        print(f"[kafka] Failed to publish allocation plan: {exc}")
        return False
