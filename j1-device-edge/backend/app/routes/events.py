"""
J1 Bridge API - Events routes.

POST /api/v1/events/ingest receives mobile events, enforces idempotency, and
produces accepted events to Kafka. GET /api/v1/events lists recent events for
local debugging.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from ..idempotency import idempotency_store
from ..kafka_producer import kafka_producer
from ..models import ApiResponse, EventPayload

logger = logging.getLogger("j1.events")

router = APIRouter(prefix="/api/v1/events", tags=["Events"])

_recent_events: list[dict[str, Any]] = []
_MAX_RECENT_EVENTS = 200


@router.post("/ingest", response_model=ApiResponse, status_code=202)
async def ingest_event(
    event: EventPayload,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Receive an event from the mobile app and produce it to Kafka."""
    idem_key = idempotency_key or event.eventId

    if idem_key != event.eventId:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "data": None, "error": "Idempotency-Key must match eventId"},
        )

    if idempotency_store.contains(idem_key):
        logger.info("Duplicate event rejected: %s", idem_key)
        raise HTTPException(
            status_code=409,
            detail={"success": False, "data": None, "error": f"Duplicate event: {idem_key}"},
        )

    if not kafka_producer.is_connected:
        raise HTTPException(
            status_code=503,
            detail={"success": False, "data": None, "error": "Kafka producer is not connected"},
        )

    event_dict = event.model_dump()
    event_dict["receivedAt"] = datetime.now(timezone.utc).isoformat()
    event_dict["source"] = "J1_SOS_APP"

    try:
        kafka_producer.produce(event_dict, event.eventId)
    except Exception as exc:
        logger.error("Kafka produce failed for %s: %s", event.eventId, exc)
        raise HTTPException(
            status_code=503,
            detail={"success": False, "data": None, "error": f"Failed to produce event: {exc}"},
        ) from exc

    idempotency_store.add(idem_key)

    _recent_events.append(event_dict)
    if len(_recent_events) > _MAX_RECENT_EVENTS:
        _recent_events.pop(0)

    logger.info("Event accepted: eventId=%s type=%s userId=%s", event.eventId, event.eventType, event.userId)
    return ApiResponse(
        success=True,
        data={"eventId": event.eventId, "status": "ACCEPTED", "kafkaConnected": True},
    )


@router.get("", response_model=ApiResponse)
async def list_events():
    """Return recently received events for local debugging."""
    return ApiResponse(
        success=True,
        data={
            "count": len(_recent_events),
            "events": _recent_events[-50:],
            "idempotencyStoreSize": idempotency_store.size(),
        },
    )
