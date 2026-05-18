"""Standalone example for OpenMeteo-based anomaly filtering.

This file is intentionally not wired into the rest of the codebase.
It shows one simple approach: compare device readings against the
matching OpenMeteo reference values and discard the device record if
the relative difference exceeds a 5 percent tolerance.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Optional

import httpx


OPENMETEO_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_TOLERANCE = 0.05


@dataclass(frozen=True)
class AnomalyDecision:
    """Result of comparing one device payload to OpenMeteo data."""

    accepted: bool
    reason: str
    mismatches: Dict[str, float]
    reference: Dict[str, float]


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _relative_difference(observed: float, reference: float) -> float:
    """Return absolute relative difference as a fraction.

    Example: observed=105, reference=100 -> 0.05
    """

    if reference == 0:
        return abs(observed - reference)
    return abs(observed - reference) / abs(reference)


def _forecast_to_reference(daily_payload: Dict[str, Any]) -> Dict[str, float]:
    """Reduce an OpenMeteo response to a single reference snapshot.

    For the demo, we use the first daily values returned by OpenMeteo.
    A production version would align timestamps more carefully.
    """

    daily = daily_payload.get("daily", {})
    reference = {
        "rain_sum": _safe_float((daily.get("rain_sum") or [None])[0]) or 0.0,
        "temperature_2m_max": _safe_float((daily.get("temperature_2m_max") or [None])[0]) or 0.0,
        "temperature_2m_min": _safe_float((daily.get("temperature_2m_min") or [None])[0]) or 0.0,
        "soil_moisture_0_to_1cm": _safe_float(
            ((daily_payload.get("hourly") or {}).get("soil_moisture_0_to_1cm") or [None])[0]
        ) or 0.0,
    }
    return reference


async def fetch_openmeteo_reference(latitude: float, longitude: float, target_date: date) -> Dict[str, float]:
    """Fetch a minimal OpenMeteo snapshot for anomaly comparison."""

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": target_date.isoformat(),
        "end_date": target_date.isoformat(),
        "daily": ["rain_sum", "temperature_2m_max", "temperature_2m_min"],
        "hourly": ["soil_moisture_0_to_1cm"],
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(OPENMETEO_URL, params=params)
        response.raise_for_status()
        data = response.json()

    return _forecast_to_reference(data)


def compare_device_reading(
    device_reading: Dict[str, Any],
    openmeteo_reference: Dict[str, float],
    tolerance: float = DEFAULT_TOLERANCE,
) -> AnomalyDecision:
    """Compare one device payload to OpenMeteo values.

    If any monitored field differs by more than the tolerance, the payload
    is treated as an anomaly and should be discarded.
    """

    monitored_fields = {
        "rain_sum": "rain_sum",
        "temp": "temperature_2m_max",
        "moist": "soil_moisture_0_to_1cm",
    }

    mismatches: Dict[str, float] = {}

    for device_field, reference_field in monitored_fields.items():
        device_value = _safe_float(device_reading.get(device_field))
        reference_value = _safe_float(openmeteo_reference.get(reference_field))

        if device_value is None or reference_value is None:
            continue

        diff_ratio = _relative_difference(device_value, reference_value)
        if diff_ratio > tolerance:
            mismatches[device_field] = diff_ratio

    if mismatches:
        return AnomalyDecision(
            accepted=False,
            reason=f"discarded: device reading exceeded {tolerance:.0%} tolerance versus OpenMeteo reference",
            mismatches=mismatches,
            reference=openmeteo_reference,
        )

    return AnomalyDecision(
        accepted=True,
        reason="accepted: device reading stayed within tolerance",
        mismatches={},
        reference=openmeteo_reference,
    )


def filter_device_payload(
    device_reading: Dict[str, Any],
    openmeteo_reference: Dict[str, float],
    tolerance: float = DEFAULT_TOLERANCE,
) -> Optional[Dict[str, Any]]:
    """Return the payload if valid, otherwise None.

    This is the simplest shape for a pipeline step that wants to drop
    anomalous device data before storing or predicting on it.
    """

    decision = compare_device_reading(device_reading, openmeteo_reference, tolerance=tolerance)
    if not decision.accepted:
        return None
    return device_reading


async def example_pipeline_step(
    device_reading: Dict[str, Any],
    latitude: float,
    longitude: float,
    target_date: date,
) -> AnomalyDecision:
    """Example end-to-end flow for documentation or local experimentation."""

    reference = await fetch_openmeteo_reference(latitude, longitude, target_date)
    return compare_device_reading(device_reading, reference)
