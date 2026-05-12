"""
J1 Bridge API - FastAPI application entry point.

Data flow: Flutter mobile app -> FastAPI bridge -> J2 HTTP ingestion API.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .j2_client import j2_client
from .routes import events, health, resources

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-12s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("j1.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle for the FastAPI application."""
    logger.info("Starting J1 Bridge API")
    logger.info("J2 service: %s", settings.J2_BASE_URL)

    try:
        await j2_client.connect()
        logger.info("J2 client connected")
    except Exception as exc:
        logger.warning("J2 client failed to connect: %s", exc)

    yield

    logger.info("Shutting down J1 Bridge API")
    await j2_client.disconnect()
    logger.info("Shutdown complete")


app = FastAPI(
    title="J1 Device-Edge Bridge API",
    description="Bridge between the J1 Flutter mobile app and J2 core service.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(events.router)
app.include_router(resources.router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "j1-bridge-api",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "ingest_report": "POST /api/v1/ingest/report",
            "ingest_sensor": "POST /api/v1/ingest/sensor",
            "resources": "GET /api/v1/resources",
            "health": "GET /health",
        },
    }
