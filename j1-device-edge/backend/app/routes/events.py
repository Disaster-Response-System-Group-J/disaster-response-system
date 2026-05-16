"""
J1 Bridge API - Events routes.

POST /api/v1/ingest/report  - Receive SOS report from mobile app -> Kafka
POST /api/v1/ingest/sensor  - Receive sensor telemetry from mobile/IoT -> Kafka
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from ..idempotency import idempotency_store
from ..kafka_producer import kafka_producer
from ..models import ApiResponse, ReportIngestPayload
from ..validation import ReportIngestionValidator, SensorIngestionValidator, ValidationError

logger = logging.getLogger("j1.events")

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingestion"])


@router.post("/report", response_model=ApiResponse, status_code=201)
async def ingest_report(
    payload: ReportIngestPayload,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """
    Ingest a disaster report from the mobile app and publish to Kafka.

    Returns:
        201 Created: Report published to Kafka
        400 Bad Request: Idempotency-Key mismatch
        409 Conflict: Duplicate report (eventId already processed)
        422 Unprocessable Entity: Validation error
    """
    idem_key = idempotency_key or payload.eventId

    if idem_key != payload.eventId:
        logger.warning("Idempotency-Key mismatch: %s != %s", idem_key, payload.eventId)
        raise HTTPException(
            status_code=400,
            detail=ApiResponse(
                success=False,
                error="Idempotency-Key header must match eventId in payload",
            ).model_dump(),
        )

    if idempotency_store.contains(idem_key):
        logger.info("Duplicate report rejected: %s", idem_key)
        raise HTTPException(
            status_code=409,
            detail=ApiResponse(
                success=False,
                error=f"Duplicate report: {idem_key}",
            ).model_dump(),
        )

    try:
        normalized_payload = ReportIngestionValidator.validate(payload.model_dump())
    except ValidationError as e:
        logger.warning("Report validation error: %s.%s", e.field, e.reason)
        raise HTTPException(
            status_code=422,
            detail=ApiResponse(
                success=False,
                error="Validation failed",
                errors=[{"field": e.field, "reason": e.reason}],
            ).model_dump(),
        )

    normalized_payload["eventId"] = payload.eventId
    normalized_payload["source"] = "J1_SOS_APP"
    normalized_payload["createdAt"] = datetime.now(timezone.utc).isoformat()

    kafka_producer.publish_sos_report(normalized_payload)
    idempotency_store.add(idem_key)

    logger.info("Report published: eventId=%s district=%s", payload.eventId, payload.district)
    return ApiResponse(
        success=True,
        data={"eventId": payload.eventId, "status": "PUBLISHED"},
    )


@router.post("/sensor", response_model=ApiResponse, status_code=201)
async def ingest_sensor(
    payload: dict[str, Any],
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """
    Ingest sensor telemetry from an IoT device or mobile app and publish to Kafka.

    Returns:
        201 Created: Telemetry published to Kafka
        400 Bad Request: Idempotency-Key mismatch
        409 Conflict: Duplicate reading (eventId already processed)
        422 Unprocessable Entity: Validation error
    """
    try:
        normalized_payload = SensorIngestionValidator.validate(payload)
    except ValidationError as e:
        logger.warning("Sensor validation error: %s.%s", e.field, e.reason)
        raise HTTPException(
            status_code=422,
            detail=ApiResponse(
                success=False,
                error="Validation failed",
                errors=[{"field": e.field, "reason": e.reason}],
            ).model_dump(),
        )

    event_id = normalized_payload["eventId"]
    idem_key = idempotency_key or event_id

    if idem_key != event_id:
        logger.warning("Idempotency-Key mismatch for sensor: %s != %s", idem_key, event_id)
        raise HTTPException(
            status_code=400,
            detail=ApiResponse(
                success=False,
                error="Idempotency-Key header must match eventId in payload",
            ).model_dump(),
        )

    if idempotency_store.contains(idem_key):
        logger.info("Duplicate sensor reading rejected: %s", idem_key)
        raise HTTPException(
            status_code=409,
            detail=ApiResponse(
                success=False,
                error=f"Duplicate reading: {idem_key}",
            ).model_dump(),
        )

    kafka_producer.publish_sensor_telemetry(normalized_payload)
    idempotency_store.add(idem_key)

    logger.info(
        "Sensor telemetry published: eventId=%s deviceId=%s hazardType=%s",
        event_id,
        normalized_payload.get("deviceId"),
        normalized_payload.get("hazardType"),
    )
    return ApiResponse(
        success=True,
        data={"eventId": event_id, "status": "PUBLISHED"},
    )
