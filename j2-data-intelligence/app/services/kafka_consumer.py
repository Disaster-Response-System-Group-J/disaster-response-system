"""
J2 Kafka Consumers.

Two independent background threads:

  1. SensorConsumer  — j1.sensor.telemetry
       → INSERT into iot_flood or iot_landslide
       → APScheduler (every 30s) runs ML model on new rows
       → writes iot_predictions, publishes j2.engine.risk-alerts

  2. ReportConsumer  — j1.sos.raw-reports
       → INSERT into public."IncomingReport"
       → idempotent on sosId (duplicate eventId skipped)
"""

from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from confluent_kafka import Consumer, KafkaError
from sqlalchemy import text

from app.core import config
from app.db.database import SessionLocal

logger = logging.getLogger("j2.kafka_consumer")

# ── Sensor INSERT statements ───────────────────────────────────────────────────

_INSERT_FLOOD = text("""
    INSERT INTO iot_flood
        (id, type, temp, hum, depth, device_id, recorded_at)
    VALUES
        (:id, :type, :temp, :hum, :depth, :device_id, :recorded_at)
    ON CONFLICT (id) DO NOTHING
""")

_INSERT_LANDSLIDE = text("""
    INSERT INTO iot_landslide
        (id, type, temp, hum, moist, ax, ay, az, gx, gy, gz,
         device_id, recorded_at)
    VALUES
        (:id, :type, :temp, :hum, :moist, :ax, :ay, :az, :gx, :gy, :gz,
         :device_id, :recorded_at)
    ON CONFLICT (id) DO NOTHING
""")

# ── SOS report INSERT statement ────────────────────────────────────────────────

_INSERT_REPORT = text("""
    INSERT INTO public."IncomingReport"
        (id, source, "disasterType", district, latitude, longitude,
         description, contact, "mediaUrls", "verificationStatus",
         "deviceId", "createdAt", "sosId")
    VALUES
        (:id, :source, :disasterType, :district, :latitude, :longitude,
         :description, :contact, :mediaUrls, :verificationStatus,
         :deviceId, :createdAt, :sosId)
    ON CONFLICT ("sosId") DO NOTHING
""")

_CHECK_DUPLICATE_REPORT = text("""
    SELECT id FROM public."IncomingReport"
    WHERE "sosId" = :sosId
    LIMIT 1
""")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_timestamp(ts: Any) -> datetime:
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


# ── Sensor ingest ──────────────────────────────────────────────────────────────

def ingest_sensor_message(db, msg: dict[str, Any]) -> None:
    """Write one j1.sensor.telemetry message to iot_flood or iot_landslide."""
    hazard = (msg.get("hazardType") or "").upper()
    if hazard not in ("FLOOD", "LANDSLIDE"):
        logger.warning("Skipping unsupported hazardType=%s", hazard)
        return

    row_id      = str(uuid.uuid4())
    device_id   = msg.get("deviceId") or ""
    recorded_at = _parse_timestamp(msg.get("timestamp"))

    if hazard == "FLOOD":
        db.execute(_INSERT_FLOOD, {
            "id":          row_id,
            "type":        "FLOOD",
            "temp":        msg.get("temp"),
            "hum":         msg.get("hum"),
            "depth":       msg.get("depth"),
            "device_id":   device_id,
            "recorded_at": recorded_at,
        })
        logger.info("iot_flood inserted: device=%s depth=%s", device_id, msg.get("depth"))

    elif hazard == "LANDSLIDE":
        db.execute(_INSERT_LANDSLIDE, {
            "id":          row_id,
            "type":        "LANDSLIDE",
            "temp":        msg.get("temp"),
            "hum":         msg.get("hum"),
            "moist":       msg.get("moist"),
            "ax":  msg.get("ax"),  "ay": msg.get("ay"),  "az": msg.get("az"),
            "gx":  msg.get("gx"),  "gy": msg.get("gy"),  "gz": msg.get("gz"),
            "device_id":   device_id,
            "recorded_at": recorded_at,
        })
        logger.info("iot_landslide inserted: device=%s moist=%s", device_id, msg.get("moist"))

    db.commit()


# ── SOS report ingest ──────────────────────────────────────────────────────────

def ingest_sos_report(db, msg: dict[str, Any]) -> None:
    """Write one j1.sos.raw-reports message to IncomingReport. Idempotent on sosId."""
    event_id = msg.get("eventId") or ""
    if not event_id:
        logger.warning("SOS report missing eventId — skipping")
        return

    # Idempotency check — skip if already stored
    existing = db.execute(_CHECK_DUPLICATE_REPORT, {"sosId": event_id}).fetchone()
    if existing:
        logger.debug("Duplicate SOS report skipped: sosId=%s", event_id)
        return

    media_urls = msg.get("mediaUrls") or []
    created_at = _parse_timestamp(msg.get("createdAt") or msg.get("timestamp"))

    db.execute(_INSERT_REPORT, {
        "id":                 str(uuid.uuid4()),
        "source":             msg.get("source") or "J1_SOS_APP",
        "disasterType":       (msg.get("disasterType") or "FLOOD").upper(),
        "district":           msg.get("district") or "Unknown",
        "latitude":           msg.get("latitude"),
        "longitude":          msg.get("longitude"),
        "description":        msg.get("description") or "",
        "contact":            msg.get("contact"),
        "mediaUrls":          media_urls,
        "verificationStatus": "PENDING_REVIEW",
        "deviceId":           msg.get("deviceId"),
        "createdAt":          created_at,
        "sosId":              event_id,
    })
    db.commit()

    logger.info(
        "IncomingReport inserted: sosId=%s district=%s type=%s",
        event_id,
        msg.get("district"),
        msg.get("disasterType"),
    )


# ── Consumer loops ─────────────────────────────────────────────────────────────

def _sensor_consumer_loop() -> None:
    consumer = Consumer({
        "bootstrap.servers":  config.KAFKA_BROKER,
        "group.id":           config.KAFKA_CONSUMER_GROUP,
        "auto.offset.reset":  "earliest",
        "enable.auto.commit": True,
    })
    consumer.subscribe([config.KAFKA_TOPIC_SENSOR])
    logger.info(
        "Sensor consumer started: broker=%s topic=%s group=%s",
        config.KAFKA_BROKER, config.KAFKA_TOPIC_SENSOR, config.KAFKA_CONSUMER_GROUP,
    )

    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                logger.error("Sensor consumer Kafka error: %s", msg.error())
            continue

        db = SessionLocal()
        try:
            data = json.loads(msg.value().decode("utf-8"))
            ingest_sensor_message(db, data)
        except Exception as exc:
            logger.error("Sensor ingest failed: %s", exc)
            db.rollback()
        finally:
            db.close()


def _report_consumer_loop() -> None:
    consumer = Consumer({
        "bootstrap.servers":  config.KAFKA_BROKER,
        "group.id":           "j2-report-consumer",
        "auto.offset.reset":  "earliest",
        "enable.auto.commit": True,
    })
    consumer.subscribe([config.KAFKA_TOPIC_SOS_REPORTS])
    logger.info(
        "Report consumer started: broker=%s topic=%s group=j2-report-consumer",
        config.KAFKA_BROKER, config.KAFKA_TOPIC_SOS_REPORTS,
    )

    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                logger.error("Report consumer Kafka error: %s", msg.error())
            continue

        db = SessionLocal()
        try:
            data = json.loads(msg.value().decode("utf-8"))
            ingest_sos_report(db, data)
        except Exception as exc:
            logger.error("Report ingest failed: %s", exc)
            db.rollback()
        finally:
            db.close()


# ── Public startup functions ───────────────────────────────────────────────────

def start_sensor_consumer() -> threading.Thread:
    thread = threading.Thread(
        target=_sensor_consumer_loop,
        name="j2-sensor-consumer",
        daemon=True,
    )
    thread.start()
    logger.info("Sensor consumer thread started.")
    return thread


def start_report_consumer() -> threading.Thread:
    thread = threading.Thread(
        target=_report_consumer_loop,
        name="j2-report-consumer",
        daemon=True,
    )
    thread.start()
    logger.info("Report consumer thread started.")
    return thread
