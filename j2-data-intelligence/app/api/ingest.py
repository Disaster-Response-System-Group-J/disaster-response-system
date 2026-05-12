"""
J2 Data & Intelligence - Ingestion Endpoints.

POST /api/v1/ingest/report  - Receive normalized report from J1
POST /api/v1/ingest/sensor  - Receive normalized sensor data from J1

These endpoints write to Postgres with idempotency constraints.
Replaces Kafka consumer with direct HTTP ingestion.
"""

import logging
import os
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.db.database import get_db

logger = logging.getLogger("j2.ingest")

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingestion"])
INTERNAL_TOKEN = os.getenv("J1_INTERNAL_TOKEN", "dev-secret-token")


def verify_internal_auth(authorization: str | None = Header(default=None, alias="Authorization")) -> None:
    """Basic internal token guard for J1 -> J2 calls."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"success": False, "error": "Missing bearer token"})

    token = authorization.split(" ", 1)[1].strip()
    if token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail={"success": False, "error": "Invalid internal token"})


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
    payload: ReportIngestRequest,
    _: None = Depends(verify_internal_auth),
    db: Session = Depends(get_db),
) -> IngestResponse:
    """
    Ingest a disaster report from J1 service.

    Idempotent on existing schema: duplicate eventId maps to IncomingReport.sosId.

    Returns:
        201 Created: Report inserted
        409 Conflict: Duplicate eventId
        503 Service Unavailable: transient DB failure
    """
    try:
        duplicate_check = db.execute(
            text(
                """
                SELECT id
                FROM public."IncomingReport"
                WHERE "sosId" = :eventId
                LIMIT 1;
                """
            ),
            {"eventId": payload.eventId},
        ).fetchone()

        if duplicate_check:
            logger.warning("Duplicate report rejected: eventId=%s", payload.eventId)
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate report: {payload.eventId}"
                ).model_dump(),
            )

        # Use existing IncomingReport columns only; do not require schema changes.
        query = text("""
            INSERT INTO public."IncomingReport"
            (id, source, "disasterType", district, latitude, longitude, 
             description, contact, "mediaUrls", "verificationStatus", "deviceId", "createdAt", "sosId")
            VALUES
            (:id, :source, :disasterType, :district, :latitude, :longitude,
             :description, :contact, :mediaUrls, :verificationStatus, :deviceId, :createdAt, :sosId)
            RETURNING id;
        """)

        report_id = str(uuid4())

        result = db.execute(
            query,
            {
                "id": report_id,
                "source": payload.source,
                "disasterType": payload.disasterType,
                "district": payload.district,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "description": payload.description,
                "contact": payload.contact,
                "mediaUrls": payload.mediaUrls,
                "verificationStatus": "PENDING_REVIEW",
                "deviceId": payload.deviceId,
                "createdAt": payload.createdAt,
                "sosId": payload.eventId,
            },
        )

        db.commit()

        inserted_id = result.scalar()
        if inserted_id is None:
            raise HTTPException(
                status_code=503,
                detail=IngestResponse(
                    success=False, error="Report insert failed unexpectedly"
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

    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error("Integrity error in report ingest: %s", e)
        db.rollback()
        if "sosId" in str(e):
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate report: {payload.eventId}"
                ).model_dump(),
            )
        raise HTTPException(
            status_code=503,
            detail=IngestResponse(success=False, error="Database error").model_dump(),
        )
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=IngestResponse(success=False, error="Database temporarily unavailable").model_dump(),
        )
    except Exception as e:
        logger.error("Unexpected error in report ingest: %s", e)
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=IngestResponse(success=False, error=str(e)).model_dump(),
        )


@router.post("/sensor", response_model=IngestResponse, status_code=201)
async def ingest_sensor(
    payload: SensorIngestRequest,
    _: None = Depends(verify_internal_auth),
    db: Session = Depends(get_db),
) -> IngestResponse:
    """
    Ingest sensor data from J1 service.

    Idempotent on current schema: duplicate = same deviceId + recorded_at + type.
    Checks sensor thresholds → may generate alerts.

    Returns:
        201 Created: Sensor data inserted
        409 Conflict: Duplicate reading
        503 Service Unavailable: transient DB failure
    """
    try:
        duplicate_check = db.execute(
            text(
                """
                SELECT row_id
                FROM public."iot_rainfall_data"
                WHERE id = :device_id
                  AND recorded_at = :recorded_at
                  AND type = :hazard_type
                LIMIT 1;
                """
            ),
            {
                "device_id": payload.deviceId,
                "recorded_at": payload.recorded_at,
                "hazard_type": payload.type,
            },
        ).fetchone()

        if duplicate_check:
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

        query = text("""
            INSERT INTO public."iot_rainfall_data"
            (id, type, temp, hum, depth, recorded_at)
            VALUES
            (:id, :type, :temp, :hum, :depth, :recorded_at)
            RETURNING row_id;
        """)

        result = db.execute(
            query,
            {
                "id": payload.deviceId,
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
            raise HTTPException(
                status_code=503,
                detail=IngestResponse(
                    success=False, error="Sensor insert failed unexpectedly"
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

    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error("Integrity error in sensor ingest: %s", e)
        db.rollback()
        if "recorded_at" in str(e):
            raise HTTPException(
                status_code=409,
                detail=IngestResponse(
                    success=False, error=f"Duplicate reading: {payload.eventId}"
                ).model_dump(),
            )
        raise HTTPException(
            status_code=503,
            detail=IngestResponse(success=False, error="Database error").model_dump(),
        )
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=IngestResponse(success=False, error="Database temporarily unavailable").model_dump(),
        )
    except Exception as e:
        logger.error("Unexpected error in sensor ingest: %s", e)
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=IngestResponse(success=False, error=str(e)).model_dump(),
        )
