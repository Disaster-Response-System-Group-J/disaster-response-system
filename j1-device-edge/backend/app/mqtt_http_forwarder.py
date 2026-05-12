"""MQTT -> J1 HTTP forwarder for hardware sensor payloads.

Subscribes to Central Node MQTT topics and forwards raw JSON payloads to
J1 `/api/v1/ingest/sensor`, where they are normalized and relayed to J2.
"""

from __future__ import annotations

import json
import logging
import os
import ssl
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx
import paho.mqtt.client as mqtt
try:
    import psycopg2
    from psycopg2.extras import Json
except Exception:  # pragma: no cover
    psycopg2 = None  # type: ignore[assignment]
    Json = None  # type: ignore[assignment]

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("j1.mqtt_http_forwarder")

MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_TOPICS = [t.strip() for t in os.getenv("MQTT_TOPICS", "j1/disaster/#").split(",") if t.strip()]

# Optional TLS for cloud brokers (e.g., HiveMQ Cloud)
MQTT_TLS = os.getenv("MQTT_TLS", "").strip().lower() in ("1", "true", "yes", "on")
MQTT_TLS_INSECURE = os.getenv("MQTT_TLS_INSECURE", "").strip().lower() in ("1", "true", "yes", "on")

J1_BASE_URL = os.getenv("J1_BASE_URL", "http://j1-bridge-api:8000")
J1_SENSOR_ENDPOINT = f"{J1_BASE_URL.rstrip('/')}/api/v1/ingest/sensor"
J1_TIMEOUT_SECONDS = float(os.getenv("J1_TIMEOUT_SECONDS", "8.0"))

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_SSLMODE = os.getenv("DB_SSLMODE", "require").strip() or "require"

# Supabase REST API (PostgREST) — avoids direct Postgres connectivity.
# Example: https://<project-ref>.supabase.co
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
# Prefer service role key (bypasses RLS). Use anon key only if your table RLS allows inserts.
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_SCHEMA = os.getenv("SUPABASE_SCHEMA", "public").strip() or "public"
SUPABASE_REST_TIMEOUT_SECONDS = float(os.getenv("SUPABASE_REST_TIMEOUT_SECONDS", "8.0"))


def _db_enabled() -> bool:
    return bool(DATABASE_URL)


def _supabase_rest_enabled() -> bool:
    return bool(SUPABASE_URL) and bool(SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)


_db_conn: psycopg2.extensions.connection | None = None


def _get_db_conn() -> psycopg2.extensions.connection:
    global _db_conn
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is not installed")

    if _db_conn is not None and _db_conn.closed == 0:
        return _db_conn

    _db_conn = psycopg2.connect(DATABASE_URL, sslmode=DB_SSLMODE)
    _db_conn.autocommit = True
    return _db_conn


def _ensure_iot_tables() -> None:
    if not _db_enabled():
        return

    if psycopg2 is None:
        raise RuntimeError("psycopg2 is not installed")

    conn = _get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS public.iot_flood (
              row_id BIGSERIAL PRIMARY KEY,
              device_id TEXT NOT NULL,
              topic TEXT NOT NULL,
              type TEXT,
              temp DOUBLE PRECISION,
              hum DOUBLE PRECISION,
              depth DOUBLE PRECISION,
              raw_payload JSONB NOT NULL,
              recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS public.iot_landslide (
              row_id BIGSERIAL PRIMARY KEY,
              device_id TEXT NOT NULL,
              topic TEXT NOT NULL,
              type TEXT,
              temp DOUBLE PRECISION,
              hum DOUBLE PRECISION,
              moist DOUBLE PRECISION,
              ax DOUBLE PRECISION,
              ay DOUBLE PRECISION,
              az DOUBLE PRECISION,
              gx DOUBLE PRECISION,
              gy DOUBLE PRECISION,
              gz DOUBLE PRECISION,
              raw_payload JSONB NOT NULL,
              recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )


def _parse_recorded_at(payload: dict[str, Any]) -> datetime | None:
    value = payload.get("recorded_at") or payload.get("recordedAt") or payload.get("timestamp")
    if not value:
        return None

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None

    if isinstance(value, str):
        try:
            # Accept ISO8601 like 2026-05-12T12:34:56Z
            cleaned = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    return None


def _route_table_for_topic(topic: str) -> str | None:
    normalized = (topic or "").strip().lower()
    if normalized == "j1/disaster/flood":
        return "iot_flood"
    if normalized == "j1/disaster/landslide":
        return "iot_landslide"
    return None


def _insert_to_supabase(topic: str, payload: dict[str, Any]) -> None:
    table = _route_table_for_topic(topic)
    if table is None:
        return

    device_id = (payload.get("id") or payload.get("deviceId") or payload.get("device_id") or "").strip()
    if not device_id:
        logger.warning("DB insert skipped (missing device id) topic=%s", topic)
        return

    hazard_type = payload.get("type")
    recorded_at = _parse_recorded_at(payload)

    # Prefer Supabase REST if configured.
    if _supabase_rest_enabled():
        _insert_via_supabase_rest(table, topic, device_id, hazard_type, recorded_at, payload)
        return

    # Fallback: direct Postgres insert if configured.
    if _db_enabled():
        _insert_via_postgres(table, topic, device_id, hazard_type, recorded_at, payload)


def _supabase_headers() -> dict[str, str]:
    key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=minimal",
        # Ensure the correct schema is used when not default.
        "Content-Profile": SUPABASE_SCHEMA,
        "Accept-Profile": SUPABASE_SCHEMA,
    }


def _insert_via_supabase_rest(
    table: str,
    topic: str,
    device_id: str,
    hazard_type: Any,
    recorded_at: datetime | None,
    payload: dict[str, Any],
) -> None:
    base = f"{SUPABASE_URL}/rest/v1"
    url = f"{base}/{table}"

    body: dict[str, Any] = {
        "id": str(uuid4()),
        "device_id": device_id,
        "topic": topic,
        "type": hazard_type,
        "raw_payload": payload,
    }

    # Common fields
    if "temp" in payload:
        body["temp"] = payload.get("temp")
    if "hum" in payload:
        body["hum"] = payload.get("hum")
    if recorded_at is not None:
        body["recorded_at"] = recorded_at.isoformat()

    # Hazard-specific fields
    if table == "iot_flood":
        if "depth" in payload:
            body["depth"] = payload.get("depth")
    elif table == "iot_landslide":
        for key in ("moist", "ax", "ay", "az", "gx", "gy", "gz"):
            if key in payload:
                body[key] = payload.get(key)

    with httpx.Client(timeout=SUPABASE_REST_TIMEOUT_SECONDS) as client:
        resp = client.post(url, headers=_supabase_headers(), json=body)

    if resp.status_code not in (201, 200, 204):
        preview = resp.text[:300] if resp.text else ""
        logger.error("Supabase REST insert failed table=%s status=%s body=%s", table, resp.status_code, preview)
        return

    logger.info("Inserted MQTT payload into %s via Supabase REST device_id=%s", table, device_id)


def _insert_via_postgres(
    table: str,
    topic: str,
    device_id: str,
    hazard_type: Any,
    recorded_at: datetime | None,
    payload: dict[str, Any],
) -> None:
    if psycopg2 is None or Json is None:
        raise RuntimeError("psycopg2 is not installed")

    conn = _get_db_conn()
    with conn.cursor() as cur:
        if table == "iot_flood":
            cur.execute(
                """
                INSERT INTO public.iot_flood
                  (device_id, topic, type, temp, hum, depth, raw_payload, recorded_at)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, COALESCE(%s, NOW()));
                """,
                (
                    device_id,
                    topic,
                    hazard_type,
                    payload.get("temp"),
                    payload.get("hum"),
                    payload.get("depth"),
                    Json(payload),
                    recorded_at,
                ),
            )
        elif table == "iot_landslide":
            cur.execute(
                """
                INSERT INTO public.iot_landslide
                  (device_id, topic, type, temp, hum, moist, ax, ay, az, gx, gy, gz, raw_payload, recorded_at)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, NOW()));
                """,
                (
                    device_id,
                    topic,
                    hazard_type,
                    payload.get("temp"),
                    payload.get("hum"),
                    payload.get("moist"),
                    payload.get("ax"),
                    payload.get("ay"),
                    payload.get("az"),
                    payload.get("gx"),
                    payload.get("gy"),
                    payload.get("gz"),
                    Json(payload),
                    recorded_at,
                ),
            )

    logger.info("Inserted MQTT payload into %s via Postgres device_id=%s", table, device_id)


def _safe_json_loads(payload_text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(payload_text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        return None
    return None


def _forward_sensor_payload(payload: dict[str, Any]) -> None:
    with httpx.Client(timeout=J1_TIMEOUT_SECONDS) as client:
        resp = client.post(J1_SENSOR_ENDPOINT, json=payload)

    if resp.status_code not in (201, 409):
        logger.error("Forward failed status=%s body=%s", resp.status_code, resp.text)
        return

    logger.info("Forwarded sensor payload id=%s type=%s status=%s",
                payload.get("id") or payload.get("deviceId"),
                payload.get("type") or payload.get("hazardType"),
                resp.status_code)


def on_connect(client: mqtt.Client, userdata: Any, flags: dict[str, Any], reason_code: int, properties: Any = None):
    if reason_code != 0:
        logger.error("MQTT connect failed with code=%s", reason_code)
        return

    logger.info("Connected to MQTT broker %s:%s", MQTT_BROKER, MQTT_PORT)
    for topic in MQTT_TOPICS:
        client.subscribe(topic)
        logger.info("Subscribed topic=%s", topic)


def on_message(client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage):
    payload_text = msg.payload.decode("utf-8", errors="ignore").strip()
    if not payload_text:
        return

    sensor_payload = _safe_json_loads(payload_text)
    if sensor_payload is None:
        logger.warning("Ignoring non-JSON payload from topic=%s", msg.topic)
        return

    try:
        # 1) Persist to Supabase tables when configured.
        _insert_to_supabase(msg.topic, sensor_payload)
        # 2) Keep forwarding to J1 bridge (for J2 ingestion pipeline).
        _forward_sensor_payload(sensor_payload)
    except Exception as exc:
        logger.error("Failed forwarding payload from topic=%s error=%s", msg.topic, exc)


def main() -> None:
    rest_enabled = _supabase_rest_enabled()
    logger.info(
        "Supabase REST writer %s (SUPABASE_URL + key)",
        "enabled" if rest_enabled else "disabled",
    )

    # If REST is enabled, skip Postgres init entirely. This avoids failures on
    # IPv6-only Supabase DB hosts (port 5432) when the local network lacks IPv6.
    if not rest_enabled:
        if _db_enabled():
            try:
                _ensure_iot_tables()
                logger.info("DB writer enabled (DATABASE_URL set)")
            except Exception as exc:
                logger.error("Failed DB initialization (continuing without DB writes): %s", exc)
        else:
            logger.info("DB writer disabled (DATABASE_URL not set)")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="j1-mqtt-http-forwarder")
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    # If the broker uses TLS (common for cloud brokers), enable TLS.
    tls_required = MQTT_TLS or MQTT_PORT in (8883, 8884)
    if tls_required:
        try:
            client.tls_set(
                ca_certs=None,
                certfile=None,
                keyfile=None,
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLS_CLIENT,
            )
            client.tls_insecure_set(MQTT_TLS_INSECURE)
            logger.info("MQTT TLS enabled (insecure=%s)", MQTT_TLS_INSECURE)
        except Exception as exc:
            logger.error("Failed enabling MQTT TLS: %s", exc)

    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            logger.info("Connecting to MQTT broker %s:%s", MQTT_BROKER, MQTT_PORT)
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception as exc:
            logger.error("MQTT loop error: %s. Reconnecting in 5s", exc)
            time.sleep(5)


if __name__ == "__main__":
    main()
