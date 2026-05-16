"""
J1 Bridge API - Debug routes.

GET /api/v1/debug/kafka-test  — publish one test message to each Kafka topic
                                and return confirmation. No auth required.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..kafka_producer import kafka_producer

logger = logging.getLogger("j1.debug")

router = APIRouter(prefix="/api/v1/debug", tags=["Debug"])

_SOS_TOPIC = "j1.sos.raw-reports"
_SENSOR_TOPIC = "j1.sensor.telemetry"


@router.get("/kafka-test")
async def kafka_test():
    """
    Publish one test message to each Kafka topic and return confirmation.

    Returns 200 on success, 500 if the producer raises.
    """
    now = datetime.now(timezone.utc).isoformat()

    sos_payload = {
        "eventId": "kafka-test-sos-001",
        "source": "J1_KAFKA_TEST",
        "disasterType": "FLOOD",
        "district": "Colombo",
        "latitude": 6.9271,
        "longitude": 79.8612,
        "description": "Kafka connectivity test from J1 bridge API",
        "contact": "+94000000000",
        "mediaUrls": [],
        "deviceId": "TEST_DEVICE",
        "createdAt": now,
    }

    sensor_payload = {
        "eventId": "kafka-test-sensor-001",
        "deviceId": "J1_TX_01",
        "hazardType": "FLOOD",
        "temp": 28.5,
        "hum": 65.0,
        "depth": 1.23,
        "moist": None,
        "ax": None,
        "ay": None,
        "az": None,
        "gx": None,
        "gy": None,
        "gz": None,
        "latitude": 6.9271,
        "longitude": 79.8612,
        "timestamp": now,
    }

    try:
        kafka_producer.publish_sos_report(sos_payload)
        logger.info("kafka-test: published SOS test message")

        kafka_producer.publish_sensor_telemetry(sensor_payload)
        logger.info("kafka-test: published sensor test message")
    except Exception as exc:
        logger.error("kafka-test failed: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "detail": str(exc)},
        )

    return {
        "status": "ok",
        "published": {
            "sos_topic": _SOS_TOPIC,
            "sensor_topic": _SENSOR_TOPIC,
        },
        "timestamp": now,
    }
