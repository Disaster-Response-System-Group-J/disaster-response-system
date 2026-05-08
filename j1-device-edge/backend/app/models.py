"""
J1 Bridge API - Pydantic models.

These schemas match the event envelope that the Flutter mobile app sends from
SyncService._sendEvent.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EventPayload(BaseModel):
    """Event envelope sent by the mobile app."""

    eventId: str = Field(..., description="UUID v4 generated on the mobile device")
    eventType: str = Field(..., description="HELP_REQUEST or DATA_REPORT")
    eventVersion: str = Field(default="1.0")
    timestamp: str = Field(..., description="ISO 8601 timestamp from the device")
    userId: str = Field(..., description="Local user ID from SQLite")
    deviceId: str = Field(..., description="Device UUID from app_meta table")
    payload: dict[str, Any] = Field(..., description="Form data payload")
    metadata: dict[str, Any] | None = Field(default=None)


class ApiResponse(BaseModel):
    """Standard response envelope used by the bridge API."""

    success: bool
    data: Any | None = None
    error: str | None = None


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
