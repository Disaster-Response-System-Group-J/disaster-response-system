"""
J1 Bridge API - Payload Validation.

Strict validation for report and sensor ingestions.
Returns field-level errors for client resolution.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class HazardType(str, Enum):
    """Valid hazard types."""

    FLOOD = "FLOOD"
    LANDSLIDE = "LANDSLIDE"
    DROUGHT = "DROUGHT"


class ValidationError(Exception):
    """Raised when validation fails."""

    def __init__(self, field: str, reason: str):
        self.field = field
        self.reason = reason
        super().__init__(f"{field}: {reason}")


def validate_required_string(value: Any, field_name: str, min_length: int = 1) -> str:
    """Validate required string field."""
    if value is None:
        raise ValidationError(field_name, "Required")
    if not isinstance(value, str):
        raise ValidationError(field_name, "Must be a string")
    if len(value.strip()) < min_length:
        raise ValidationError(field_name, f"Minimum {min_length} characters")
    return value.strip()


def validate_enum(value: Any, field_name: str, enum_class: type[Enum]) -> str:
    """Validate enum field."""
    if value is None:
        raise ValidationError(field_name, "Required")

    # Try direct match
    try:
        return enum_class(value.upper()).value
    except (ValueError, AttributeError):
        valid_values = [e.value for e in enum_class]
        raise ValidationError(field_name, f"Must be one of: {', '.join(valid_values)}")


def validate_coordinates(
    latitude: Any, longitude: Any, field_lat: str = "latitude", field_lon: str = "longitude"
) -> tuple[float, float]:
    """Validate latitude and longitude."""
    if latitude is None:
        raise ValidationError(field_lat, "Required")
    if longitude is None:
        raise ValidationError(field_lon, "Required")

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (ValueError, TypeError):
        raise ValidationError(field_lat, "Must be numeric")

    if not (-90 <= lat <= 90):
        raise ValidationError(field_lat, "Must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise ValidationError(field_lon, "Must be between -180 and 180")

    return lat, lon


def validate_optional_urls(urls: Any, field_name: str = "mediaUrls", max_count: int = 5) -> list[str]:
    """Validate optional list of URLs."""
    if urls is None:
        return []

    if not isinstance(urls, list):
        raise ValidationError(field_name, "Must be an array")

    if len(urls) > max_count:
        raise ValidationError(field_name, f"Maximum {max_count} URLs")

    https_pattern = re.compile(r"^https://", re.IGNORECASE)
    validated = []

    for i, url in enumerate(urls):
        if not isinstance(url, str):
            raise ValidationError(field_name, f"Item {i} must be a string")
        if not https_pattern.match(url):
            raise ValidationError(field_name, f"Item {i} must be HTTPS URL")
        validated.append(url)

    return validated


def validate_iso8601_timestamp(value: Any, field_name: str = "timestamp") -> str:
    """Validate ISO 8601 timestamp."""
    if value is None:
        raise ValidationError(field_name, "Required")

    if not isinstance(value, str):
        raise ValidationError(field_name, "Must be ISO 8601 string")

    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValidationError(field_name, "Must be valid ISO 8601 format (e.g., 2026-05-12T14:30:00Z)")

    return value


def validate_optional_phone(phone: Optional[str], field_name: str = "contact") -> Optional[str]:
    """Validate optional phone number."""
    if phone is None:
        return None

    if not isinstance(phone, str):
        raise ValidationError(field_name, "Must be a string")

    # Basic: must have at least 5 digits
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) < 5:
        raise ValidationError(field_name, "Must contain at least 5 digits")

    return phone.strip()


def validate_optional_numeric(
    value: Any, field_name: str, min_value: Optional[float] = None, max_value: Optional[float] = None
) -> Optional[float]:
    """Validate optional numeric field."""
    if value is None:
        return None

    try:
        num = float(value)
    except (ValueError, TypeError):
        raise ValidationError(field_name, "Must be numeric")

    if min_value is not None and num < min_value:
        raise ValidationError(field_name, f"Must be >= {min_value}")

    if max_value is not None and num > max_value:
        raise ValidationError(field_name, f"Must be <= {max_value}")

    return num


class ReportIngestionValidator:
    """Validates report ingestion payloads."""

    @staticmethod
    def validate(payload: dict[str, Any]) -> dict[str, Any]:
        """
        Validate a report ingestion payload.

        Returns normalized payload if valid.
        Raises ValidationError if any field is invalid.
        """
        errors = []

        try:
            device_id = validate_required_string(payload.get("deviceId"), "deviceId")
        except ValidationError as e:
            errors.append(e)

        try:
            disaster_type = validate_enum(payload.get("disasterType"), "disasterType", HazardType)
        except ValidationError as e:
            errors.append(e)

        try:
            district = validate_required_string(payload.get("district"), "district")
        except ValidationError as e:
            errors.append(e)

        try:
            latitude, longitude = validate_coordinates(payload.get("latitude"), payload.get("longitude"))
        except ValidationError as e:
            errors.append(e)

        try:
            description = validate_required_string(payload.get("description"), "description", min_length=10)
        except ValidationError as e:
            errors.append(e)

        try:
            timestamp = validate_iso8601_timestamp(payload.get("timestamp"))
        except ValidationError as e:
            errors.append(e)

        if errors:
            raise errors[0]  # Return first error

        # Optional fields
        contact = validate_optional_phone(payload.get("contact"))
        media_urls = validate_optional_urls(payload.get("mediaUrls"))

        return {
            "deviceId": device_id,
            "disasterType": disaster_type,
            "district": district,
            "latitude": latitude,
            "longitude": longitude,
            "description": description,
            "timestamp": timestamp,
            "contact": contact,
            "mediaUrls": media_urls,
        }


class SensorIngestionValidator:
    """Validates sensor ingestion payloads."""

    @staticmethod
    def validate(payload: dict[str, Any]) -> dict[str, Any]:
        """
        Validate a sensor ingestion payload.

        Returns normalized payload if valid.
        Raises ValidationError if any field is invalid.
        """
        errors = []

        # Accept both mobile schema and raw hardware schema.
        device_raw = payload.get("deviceId") or payload.get("id")
        hazard_raw = payload.get("hazardType") or payload.get("type")
        timestamp_raw = payload.get("timestamp") or payload.get("recorded_at")

        if not timestamp_raw:
            timestamp_raw = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

        event_id = payload.get("eventId")
        if not event_id:
            ts_key = timestamp_raw.replace(":", "").replace("-", "").replace("T", "").replace("Z", "")
            event_id = f"{device_raw or 'sensor'}-{ts_key}-{uuid4().hex[:8]}"

        try:
            device_id = validate_required_string(device_raw, "deviceId")
        except ValidationError as e:
            errors.append(e)

        try:
            hazard_type = validate_enum(hazard_raw, "hazardType", HazardType)
        except ValidationError as e:
            errors.append(e)

        try:
            timestamp = validate_iso8601_timestamp(timestamp_raw)
        except ValidationError as e:
            errors.append(e)

        if errors:
            raise errors[0]

        # At least one sensor reading required
        depth = validate_optional_numeric(payload.get("depth"), "depth", min_value=0)
        temp = validate_optional_numeric(
            payload.get("temperature") if payload.get("temperature") is not None else payload.get("temp"),
            "temperature",
            min_value=-50,
            max_value=60,
        )
        humidity = validate_optional_numeric(
            payload.get("humidity") if payload.get("humidity") is not None else payload.get("hum"),
            "humidity",
            min_value=0,
            max_value=100,
        )
        moisture = validate_optional_numeric(
            payload.get("moisture") if payload.get("moisture") is not None else payload.get("moist"),
            "moisture",
            min_value=0,
            max_value=100,
        )

        if all(v is None for v in [depth, temp, humidity, moisture]):
            raise ValidationError("sensor_reading", "At least one of: depth, temperature, humidity, moisture")

        # Optional location
        latitude = None
        longitude = None
        if payload.get("latitude") is not None or payload.get("longitude") is not None:
            try:
                latitude, longitude = validate_coordinates(payload.get("latitude"), payload.get("longitude"))
            except ValidationError as e:
                errors.append(e)
                raise e

        division_id = None
        if payload.get("division_id") is not None:
            try:
                division_id = int(payload.get("division_id"))
                if division_id <= 0:
                    raise ValidationError("division_id", "Must be positive")
            except (ValueError, TypeError):
                raise ValidationError("division_id", "Must be integer")

        return {
            "eventId": event_id,
            "deviceId": device_id,
            "hazardType": hazard_type,
            "timestamp": timestamp,
            "depth": depth,
            "temperature": temp,
            "humidity": humidity,
            "moisture": moisture,
            "latitude": latitude,
            "longitude": longitude,
            "division_id": division_id,
        }
