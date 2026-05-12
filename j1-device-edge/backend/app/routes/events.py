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
from ..supabase_storage import upload_bytes_as_public_url
import httpx

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

    # Transform payload.image (single image reference) -> payload.mediaUrls using Supabase Storage
    # Supports: HTTP(S) URLs, data URIs. Local device paths are skipped.
    # Always uses mediaUrls array format for consistency with J2/J3.
    try:
        payload = event_dict.get("payload") or {}

        # If mediaUrls already present (from mobile upload), do nothing
        if payload.get("mediaUrls"):
            logger.debug("Payload already contains mediaUrls; leaving unchanged")
        # If single mediaUrl present, convert to array
        elif payload.get("mediaUrl"):
            payload["mediaUrls"] = [payload.get("mediaUrl")]
            if "mediaUrl" in payload:
                payload.pop("mediaUrl", None)
        # Handle single image reference (e.g., HTTP, data URI, or local path)
        elif payload.get("image"):
            img_ref_str = str(payload.get("image")).strip()
            if not img_ref_str:
                logger.info("Empty image reference; skipping")
                if "image" in payload:
                    payload.pop("image", None)
            elif img_ref_str.startswith("http://") or img_ref_str.startswith("https://"):
                # Remote URL: download and re-upload to Supabase
                logger.info("Processing remote image URL: %s", img_ref_str)
                try:
                    async with httpx.AsyncClient(timeout=20.0) as client:
                        resp = await client.get(img_ref_str)
                    if resp.status_code == 200:
                        content_type = resp.headers.get("content-type")
                        url = await upload_bytes_as_public_url(
                            resp.content, original_filename=None, content_type=content_type
                        )
                        if url:
                            payload["mediaUrls"] = [url]
                            logger.info("Image uploaded to Supabase: %s", url)
                        else:
                            logger.warning("Supabase upload returned no URL for %s", img_ref_str)
                    else:
                        logger.warning("Failed to download image %s: HTTP %s", img_ref_str, resp.status_code)
                except Exception as exc:
                    logger.exception("Error downloading/uploading image: %s", exc)
                if "image" in payload:
                    payload.pop("image", None)
            elif img_ref_str.startswith("data:"):
                # Data URI: decode and upload to Supabase
                logger.info("Processing data URI image")
                try:
                    header, b64data = img_ref_str.split(",", 1)
                    mime = header.split(";")[0].split(":", 1)[1] if ":" in header else None
                    import base64

                    content = base64.b64decode(b64data)
                    url = await upload_bytes_as_public_url(content, original_filename=None, content_type=mime)
                    if url:
                        payload["mediaUrls"] = [url]
                        logger.info("Data URI image uploaded to Supabase: %s", url)
                except Exception as exc:
                    logger.exception("Failed to decode/upload data URI image: %s", exc)
                if "image" in payload:
                    payload.pop("image", None)
            else:
                # Local device path (e.g., /storage/emulated/0/DCIM/...) — cannot access; skip
                logger.warning("Local device path not accessible from bridge; skipping: %s", img_ref_str)
                if "image" in payload:
                    payload.pop("image", None)

        # Remove any local image references to avoid leaking paths in Kafka
        if "image" in payload:
            payload.pop("image", None)
        if "images" in payload:
            payload.pop("images", None)

        # Write back transformed payload
        event_dict["payload"] = payload

    except Exception as exc:
        logger.exception("Error during payload image transformation: %s", exc)

    # Ensure Kafka receives only URLs (no binary, local paths, or base64)
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
