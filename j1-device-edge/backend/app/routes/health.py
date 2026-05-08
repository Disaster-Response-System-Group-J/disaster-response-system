"""
J1 Bridge API - Health route.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..idempotency import idempotency_store
from ..kafka_producer import kafka_producer

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Return bridge health and local dependency status."""
    return {
        "status": "ok",
        "service": "j1-bridge-api",
        "kafka_connected": kafka_producer.is_connected,
        "idempotency_keys": idempotency_store.size(),
    }
