"""
J1 Bridge API - Events routes.

POST /api/v1/ingest/report  - Receive report from mobile app
POST /api/v1/ingest/sensor  - Receive sensor data from mobile/IoT

Both forward to J2 service via HTTP with idempotency and retry logic.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException

from ..idempotency import idempotency_store
from ..j2_client import j2_client
from ..models import ApiResponse, ReportIngestPayload, SensorIngestPayload
from ..validation import ReportIngestionValidator, SensorIngestionValidator, ValidationError

logger = logging.getLogger("j1.events")

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingestion"])


@router.post("/report", response_model=ApiResponse, status_code=201)
async def ingest_report(
    payload: ReportIngestPayload,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """
    Ingest a disaster report from the mobile app.

    Validates, normalizes, and forwards to J2 service with retry logic.

    Returns:
        201 Created: Report accepted
        409 Conflict: Duplicate report (eventId already exists)
        422 Unprocessable Entity: Validation error (field + reason)
        503 Service Unavailable: J2 is down, retry later
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
        logger.info("Duplicate report rejected (local): %s", idem_key)
        raise HTTPException(
            status_code=409,
            detail=ApiResponse(
                success=False,
                error=f"Duplicate report: {idem_key}",
            ).model_dump(),
        )

    # Validate payload
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

    # Forward to J2
    normalized_payload["source"] = "MOBILE_APP"
    normalized_payload["createdAt"] = datetime.now(timezone.utc).isoformat()

    try:
        response = await j2_client.ingest_report(normalized_payload)
    except Exception as e:
        logger.error("J2 forward failed for report %s: %s", payload.eventId, e)
        raise HTTPException(
            status_code=503,
            detail=ApiResponse(
                success=False,
                error="J2 service unavailable. Please retry in 5 seconds.",
            ).model_dump(),
        )

    # Record in idempotency store
    idempotency_store.add(idem_key)

    logger.info("Report accepted: eventId=%s district=%s", payload.eventId, payload.district)

    return ApiResponse(
        success=True,
        data={
            "eventId": payload.eventId,
            "status": "ACCEPTED",
            "id": response.get("data", {}).get("id") if response.get("success") else None,
        },
    )


@router.post("/sensor", response_model=ApiResponse, status_code=201)
async def ingest_sensor(
    payload: SensorIngestPayload,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """
    Ingest sensor data from IoT device or mobile app.

    Validates, normalizes, and forwards to J2 service with retry logic.

    Returns:
        201 Created: Sensor data accepted
        409 Conflict: Duplicate reading (eventId already exists)
        422 Unprocessable Entity: Validation error
        503 Service Unavailable: J2 is down, retry later
    """
    idem_key = idempotency_key or payload.eventId

    if idem_key != payload.eventId:
        logger.warning("Idempotency-Key mismatch for sensor: %s != %s", idem_key, payload.eventId)
        raise HTTPException(
            status_code=400,
            detail=ApiResponse(
                success=False,
                error="Idempotency-Key header must match eventId in payload",
            ).model_dump(),
        )

    # Check local idempotency store
    if idempotency_store.contains(idem_key):
        logger.info("Duplicate sensor reading rejected (local): %s", idem_key)
        raise HTTPException(
            status_code=409,
            detail=ApiResponse(
                success=False,
                error=f"Duplicate reading: {idem_key}",
            ).model_dump(),
        )

    # Validate payload
    try:
        normalized_payload = SensorIngestionValidator.validate(payload.model_dump())
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

    # Forward to J2
    normalized_payload["recorded_at"] = payload.timestamp
    normalized_payload["source"] = "IOT_DEVICE"

    try:
        response = await j2_client.ingest_sensor(normalized_payload)
    except Exception as e:
        logger.error("J2 forward failed for sensor %s: %s", payload.eventId, e)
        raise HTTPException(
            status_code=503,
            detail=ApiResponse(
                success=False,
                error="J2 service unavailable. Please retry in 5 seconds.",
            ).model_dump(),
        )

    # Record in idempotency store
    idempotency_store.add(idem_key)

    logger.info("Sensor reading accepted: eventId=%s deviceId=%s type=%s", 
                payload.eventId, payload.deviceId, payload.hazardType)

    return ApiResponse(
        success=True,
        data={
            "eventId": payload.eventId,
            "deviceId": payload.deviceId,
            "status": "ACCEPTED",
            "alert_triggered": response.get("data", {}).get("alert_triggered", False),
        },
    )


@router.get("", response_model=ApiResponse, tags=["Debug"])
async def list_recent_ingestions():
    """
    Return recent ingestion metrics (for debugging).

    Useful for monitoring and local testing.
    """
    return ApiResponse(
        success=True,
        data={
            "idempotency_store_size": idempotency_store.size(),
            "message": "J2 HTTP ingestion active",
        },
    )
