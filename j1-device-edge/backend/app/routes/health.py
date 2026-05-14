"""
J1 Bridge API - Health route.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..idempotency import idempotency_store

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Return bridge health and local dependency status."""
    return {
        "status": "ok",
        "service": "j1-bridge-api",
        "idempotency_keys": idempotency_store.size(),
    }
