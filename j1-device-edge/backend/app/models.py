"""
J1 Bridge API - Pydantic models.

These schemas match the event envelope that the Flutter mobile app sends from
SyncService._sendEvent.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field



class EventPayload(BaseModel):
    """Event envelope sent by the mobile app (legacy, kept for compatibility)."""

    eventId: str = Field(..., description="UUID v4 generated on the mobile device")
    eventType: str = Field(..., description="REPORT_INGEST or SENSOR_INGEST")
    timestamp: str = Field(..., description="ISO 8601 timestamp from the device")
    deviceId: str = Field(..., description="Device ID from mobile")
    payload: dict[str, Any] = Field(..., description="Normalized payload")


class ReportIngestPayload(BaseModel):
    """Report ingestion from mobile app (REPORT_INGEST event type)."""

    eventId: str = Field(..., description="UUID v4 for deduplication")
    timestamp: str = Field(..., description="ISO 8601 timestamp from device")
    deviceId: str = Field(..., description="Mobile user device ID")
    disasterType: str = Field(..., description="FLOOD | LANDSLIDE | DROUGHT")
    district: str = Field(..., description="District name")
    latitude: float = Field(..., description="Geographic latitude")
    longitude: float = Field(..., description="Geographic longitude")
    description: str = Field(..., description="Report details (min 10 chars)")
    contact: str | None = Field(default=None, description="Reporter contact (phone)")
    mediaUrls: list[str] | None = Field(default=None, description="HTTPS URLs to media")


class SensorIngestPayload(BaseModel):
    """Sensor ingestion from IoT device (SENSOR_INGEST event type)."""

    eventId: str = Field(..., description="UUID v4 for deduplication")
    timestamp: str = Field(..., description="ISO 8601 timestamp from device")
    deviceId: str = Field(..., description="Sensor device ID")
    hazardType: str = Field(..., description="FLOOD | LANDSLIDE | DROUGHT")
    depth: float | None = Field(default=None, description="Water depth in meters")
    temperature: float | None = Field(default=None, description="Temperature in Celsius")
    humidity: float | None = Field(default=None, description="Humidity percentage")
    moisture: float | None = Field(default=None, description="Soil moisture percentage")
    latitude: float | None = Field(default=None, description="Geographic latitude")
    longitude: float | None = Field(default=None, description="Geographic longitude")
    division_id: int | None = Field(default=None, description="Division ID for lookup")
class ApiResponse(BaseModel):
    """Standard response envelope used by the bridge API."""

    success: bool
    data: Any | None = None
    error: str | None = None

    errors: list[dict[str, str]] | None = Field(default=None, description="Field-level errors for validation")

class ResourceResponse(BaseModel):
    """Emergency resource returned to the mobile app for local caching."""

    id: str
    type: str
    name: str
    district: str
    status: str
    latitude: float | None = None
    longitude: float | None = None
    capacity: int | None = None
    currentLoad: int | None = None
    lastUpdated: str
