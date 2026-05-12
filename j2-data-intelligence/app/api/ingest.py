"""
J2 Data & Intelligence - Ingestion Endpoints.

POST /api/v1/ingest/report  - Receive normalized report from J1
POST /api/v1/ingest/sensor  - Receive normalized sensor data from J1

These endpoints write to Postgres with idempotency constraints.
Replaces Kafka consumer with direct HTTP ingestion.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db

logger = logging.getLogger("j2.ingest")

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingestion"])


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class ReportIngestRequest(BaseModel):
    """Normalized report received from J1."""

    eventId: str = Field(..., description="UUID for deduplication")
    source: str = Field(..., description="MOBILE_APP | IOT_SENSOR | OFFICER_ENTRY")
    disasterType: str = Field(..., description="FLOOD | LANDSLIDE | DROUGHT")
    district: str = Field(...)
    latitude: float = Field(...)
    longitude: float = Field(...)
    description: str = Field(...)
    contact: Optional[str] = None
    mediaUrls: List[str] | None = None
    deviceId: Optional[str] = None
    createdAt: str = Field(..., description="ISO 8601 timestamp")


class SensorIngestRequest(BaseModel):
    """Normalized sensor data received from J1."""

    eventId: str = Field(..., description="UUID for deduplication")
    deviceId: str = Field(...)
    type: str = Field(..., description="FLOOD | LANDSLIDE | DROUGHT")
    depth: Optional[float] = None
    temp: Optional[float] = None
    hum: Optional[float] = None
    moist: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    division_id: Optional[int] = None
    recorded_at: str = Field(..., description="ISO 8601 timestamp")
    source: Optional[str] = Field(default="IOT_DEVICE")


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class IngestResponse(BaseModel):
    """Standard response for ingestion endpoints."""

    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ============================================================================
# ENDPOINTS
# ============================================================================


@router.post("/report", response_model=IngestResponse, status_code=201)
async def ingest_report(
    payload: ReportIngestRequest, db: Session = Depends(get_db)
) -> IngestResponse:
    """
    Ingest a disaster report from J1 service.

    Idempotent: duplicate eventId → 409 Conflict (not inserted).

    Returns:
        201 Created: Report inserted
        409 Conflict: Duplicate eventId
        500 Internal Server Error: DB error (unexpected)
    """
    try:
        # Insert into IncomingReport (idempotent on eventId)
        # Note: eventId is UNIQUE constraint in DB
        query = text("""
            INSERT INTO public."IncomingReport"
            (id, "eventId", source, "disasterType", district, latitude, longitude, 
             description, contact, "mediaUrls", "verificationStatus", "deviceId", "createdAt")
            VALUES
            (:id, :eventId, :source, :disasterType, :district, :latitude, :longitude,
             :description, :contact, :mediaUrls, :verificationStatus, :deviceId, :createdAt)
            ON CONFLICT ("eventId") DO NOTHING
            RETURNING id;
        """)

        # Prepare parameters
        report_id = str(uuid4())
        media_urls_json = None
        if payload.mediaUrls:
            media_urls_json = json.dumps(payload.mediaUrls)

        result = db.execute(
            query,
            {
                "id": report_id,
                "eventId": payload.eventId,
                "source": payload.source,
                "disasterType": payload.disasterType,
                "district": payload.district,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "description": payload.description,
                "contact": payload.contact,
                "mediaUrls": media_urls_json,
                "verificationStatus": "PENDING_REVIEW",
                "deviceId": payload.deviceId,
                "createdAt": payload.createdAt,
            },
        )

        db.commit()

        # Check if inserted (RETURNING returns a row if inserted, None if duplicate)
        inserted_id = result.scalar()
        if inserted_id is None:
            logger.warning("Duplicate report rejected: eventId=%s", payload.eventId)
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate report: {payload.eventId}"
                ).model_dump(),
            )

        logger.info(
            "Report ingested: id=%s eventId=%s district=%s type=%s",
            report_id,
            payload.eventId,
            payload.district,
            payload.disasterType,
        )

        return IngestResponse(
            success=True,
            data={
                "id": report_id,
                "eventId": payload.eventId,
                "status": "PENDING_REVIEW",
            },
        )

    except IntegrityError as e:
        logger.error("Integrity error in report ingest: %s", e)
        db.rollback()
        if "eventId" in str(e):
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate report: {payload.eventId}"
                ).model_dump(),
            )
        raise HTTPException(
            status_code=500,
            detail=IngestResponse(success=False, error="Database error").model_dump(),
        )
    except Exception as e:
        logger.error("Unexpected error in report ingest: %s", e)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=IngestResponse(success=False, error=str(e)).model_dump(),
        )


@router.post("/sensor", response_model=IngestResponse, status_code=201)
async def ingest_sensor(
    payload: SensorIngestRequest, db: Session = Depends(get_db)
) -> IngestResponse:
    """
    Ingest sensor data from J1 service.

    Idempotent: duplicate (id, recorded_at) → 409 Conflict.
    Checks sensor thresholds → may generate alerts.

    Returns:
        201 Created: Sensor data inserted
        409 Conflict: Duplicate reading
        500 Internal Server Error: DB error
    """
    try:
        # Insert into iot_rainfall_data
        query = text("""
            INSERT INTO public."iot_rainfall_data"
            (id, type, temp, hum, depth, recorded_at)
            VALUES
            (:id, :type, :temp, :hum, :depth, :recorded_at)
            ON CONFLICT (id, recorded_at) DO NOTHING
            RETURNING row_id;
        """)

        result = db.execute(
            query,
            {
                "id": payload.eventId,
                "type": payload.type,
                "temp": payload.temp,
                "hum": payload.hum,
                "depth": payload.depth,
                "recorded_at": payload.recorded_at,
            },
        )

        db.commit()

        row_id = result.scalar()
        if row_id is None:
            logger.warning(
                "Duplicate sensor reading rejected: eventId=%s deviceId=%s",
                payload.eventId,
                payload.deviceId,
            )
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate reading: {payload.eventId}"
                ).model_dump(),
            )

        # Check thresholds → generate alert if needed
        alert_triggered = False
        alert_data = None

        if payload.depth is not None and payload.depth > 1.0:  # Example threshold: 1.0m
            alert_triggered = True
            alert_data = {
                "type": "FLOOD_THRESHOLD_EXCEEDED",
                "severity": "HIGH" if payload.depth > 1.5 else "MEDIUM",
                "message": f"Water depth {payload.depth}m exceeds threshold at {payload.deviceId}",
            }
            logger.warning(
                "Flood threshold exceeded: deviceId=%s depth=%.2fm", payload.deviceId, payload.depth
            )

        logger.info(
            "Sensor reading ingested: row_id=%d eventId=%s deviceId=%s depth=%s alert=%s",
            row_id,
            payload.eventId,
            payload.deviceId,
            payload.depth,
            alert_triggered,
        )

        return IngestResponse(
            success=True,
            data={
                "row_id": row_id,
                "deviceId": payload.deviceId,
                "alert_triggered": alert_triggered,
                "alert": alert_data,
            },
        )

    except IntegrityError as e:
        logger.error("Integrity error in sensor ingest: %s", e)
        db.rollback()
        if "iot_rainfall_data_dedup" in str(e) or "recorded_at" in str(e):
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate reading: {payload.eventId}"
                ).model_dump(),
            )
        raise HTTPException(
            status_code=500,
            detail=IngestResponse(success=False, error="Database error").model_dump(),
        )
    except Exception as e:
        logger.error("Unexpected error in sensor ingest: %s", e)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=IngestResponse(success=False, error=str(e)).model_dump(),
        )
