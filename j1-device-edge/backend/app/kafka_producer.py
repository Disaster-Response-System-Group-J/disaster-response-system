"""
J1 Bridge API - Kafka producer.

Single outbound data path for all J1 events.
SOS reports -> j1.sos.raw-reports
Sensor telemetry -> j1.sensor.telemetry
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from confluent_kafka import Producer

logger = logging.getLogger("j1.kafka")

_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
_TOPIC_SOS_REPORTS = os.getenv("KAFKA_TOPIC_SOS_REPORTS", "j1.sos.raw-reports")
_TOPIC_SENSOR_TELEMETRY = os.getenv("KAFKA_TOPIC_SENSOR_TELEMETRY", "j1.sensor.telemetry")


def _delivery_report(err, msg) -> None:
    if err is not None:
        logger.error("Kafka delivery failed: %s", err)
    else:
        logger.info(
            "Kafka delivered: topic=%s partition=%d offset=%d key=%s",
            msg.topic(),
            msg.partition(),
            msg.offset(),
            msg.key().decode("utf-8") if msg.key() else None,
        )


class KafkaProducerService:
    def __init__(self) -> None:
        self._producer = Producer({"bootstrap.servers": _BOOTSTRAP_SERVERS})
        logger.info("KafkaProducerService initialised: brokers=%s", _BOOTSTRAP_SERVERS)

    def publish_sos_report(self, payload: dict[str, Any]) -> None:
        event_id = payload.get("eventId", "")
        self._producer.produce(
            topic=_TOPIC_SOS_REPORTS,
            key=event_id.encode("utf-8"),
            value=json.dumps(payload).encode("utf-8"),
            callback=_delivery_report,
        )
        self._producer.flush(timeout=10)

    def publish_sensor_telemetry(self, payload: dict[str, Any]) -> None:
        event_id = payload.get("eventId", "")
        self._producer.produce(
            topic=_TOPIC_SENSOR_TELEMETRY,
            key=event_id.encode("utf-8"),
            value=json.dumps(payload).encode("utf-8"),
            callback=_delivery_report,
        )
        self._producer.flush(timeout=10)


kafka_producer = KafkaProducerService()
