"""
J1 Bridge API - FastAPI application entry point.

Data flow: Flutter mobile app / IoT sensors -> J1 Bridge API -> Kafka
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import debug, events, health, resources

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-12s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("j1.main")

app = FastAPI(
    title="J1 Device-Edge Bridge API",
    description="Bridge between J1 field devices and the Kafka event bus.",
    version="2.0.0",
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
app.include_router(debug.router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "j1-bridge-api",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "ingest_report": "POST /api/v1/ingest/report",
            "ingest_sensor": "POST /api/v1/ingest/sensor",
            "resources": "GET /api/v1/resources",
            "kafka_test": "GET /api/v1/debug/kafka-test",
        },
    }
