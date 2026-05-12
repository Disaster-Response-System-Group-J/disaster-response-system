"""
J1 Bridge API - J2 Service Client.

HTTP client to forward normalized ingestions to J2 with retry logic and backoff.
Replaces Kafka producer with direct HTTP ingestion.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger("j1.j2_client")


class J2Client:
    """Async HTTP client for J2 Service integration."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._max_retries = 3
        self._base_backoff = 1.0  # seconds

    async def connect(self) -> None:
        """Initialize the async HTTP client."""
        self._client = httpx.AsyncClient(
            base_url=settings.J2_BASE_URL,
            timeout=settings.J2_REQUEST_TIMEOUT,
            headers={
                "Authorization": f"Bearer {settings.J2_SECRET_TOKEN}",
                "Content-Type": "application/json",
            },
        )
        logger.info("J2 client connected to %s", settings.J2_BASE_URL)

    async def disconnect(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            logger.info("J2 client disconnected")

    async def ingest_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Forward a normalized report to J2 with retry logic.

        Args:
            payload: Normalized report payload

        Returns:
            Response from J2 service

        Raises:
            httpx.HTTPError: If all retries exhausted
        """
        endpoint = "/api/v1/ingest/report"
        return await self._post_with_retry(endpoint, payload)

    async def ingest_sensor(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Forward a normalized sensor reading to J2 with retry logic.

        Args:
            payload: Normalized sensor payload

        Returns:
            Response from J2 service

        Raises:
            httpx.HTTPError: If all retries exhausted
        """
        endpoint = "/api/v1/ingest/sensor"
        return await self._post_with_retry(endpoint, payload)

    async def _post_with_retry(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        POST to J2 with exponential backoff retry.

        Retries on:
        - Connection errors
        - 503 Service Unavailable
        - 504 Gateway Timeout
        - 408 Request Timeout

        Returns after:
        - 201 Created
        - 409 Conflict
        - 422 Unprocessable Entity
        - 400 Bad Request
        - Any other 4xx (client error, no retry)

        Raises on:
        - 5xx errors after max retries
        - Connection timeout after max retries
        """
        if not self._client:
            raise RuntimeError("J2 client not connected")

        last_error = None

        for attempt in range(self._max_retries):
            try:
                logger.debug(
                    "J2 request attempt %d/%d: POST %s",
                    attempt + 1,
                    self._max_retries,
                    endpoint,
                )

                response = await self._client.post(endpoint, json=payload)

                # Success or client error (no retry needed)
                if response.status_code < 500 or response.status_code in (400, 409, 422):
                    logger.info(
                        "J2 response: %d for %s (eventId=%s)",
                        response.status_code,
                        endpoint,
                        payload.get("eventId", "unknown"),
                    )
                    return response.json()

                # Server error: retry
                logger.warning(
                    "J2 server error: %d %s (attempt %d/%d)",
                    response.status_code,
                    response.reason_phrase,
                    attempt + 1,
                    self._max_retries,
                )

                if attempt < self._max_retries - 1:
                    await self._backoff(attempt)
                    continue

                # Max retries exhausted
                raise httpx.HTTPStatusError(
                    f"J2 {response.status_code}: {response.text}",
                    request=response.request,
                    response=response,
                )

            except (httpx.ConnectError, httpx.TimeoutException) as e:
                last_error = e
                logger.warning(
                    "J2 connection error: %s (attempt %d/%d)",
                    type(e).__name__,
                    attempt + 1,
                    self._max_retries,
                )

                if attempt < self._max_retries - 1:
                    await self._backoff(attempt)
                    continue

                raise httpx.NetworkError(f"J2 unreachable after {self._max_retries} attempts") from e

            except Exception as e:
                logger.error("J2 unexpected error: %s", e)
                raise

        # Should not reach here
        if last_error:
            raise last_error
        raise RuntimeError("J2 client exhausted retries")

    async def _backoff(self, attempt: int) -> None:
        """Exponential backoff: 1s, 2s, 4s."""
        wait_time = self._base_backoff * (2 ** attempt)
        logger.info("Retrying J2 request in %.1f seconds", wait_time)
        await asyncio.sleep(wait_time)

    async def is_healthy(self) -> bool:
        """Check if J2 service is healthy."""
        if not self._client:
            return False

        try:
            response = await self._client.get("/api/v1/health", timeout=2.0)
            return response.status_code == 200
        except Exception as e:
            logger.debug("J2 health check failed: %s", e)
            return False


# Global J2 client instance
j2_client = J2Client()
