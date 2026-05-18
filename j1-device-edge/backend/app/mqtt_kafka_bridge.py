"""MQTT -> Kafka bridge for hardware sensor payloads.

Subscribes to HiveMQ Cloud topics over TLS, normalises each raw JSON payload
into the standard sensor telemetry shape, and publishes to j1.sensor.telemetry.

Run standalone: python -m app.mqtt_kafka_bridge
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import ssl
import time
from datetime import datetime, timezone
from typing import Any

import paho.mqtt.client as mqtt

from .kafka_producer import kafka_producer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("j1.mqtt_kafka_bridge")

MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_TLS = os.getenv("MQTT_TLS", "").strip().lower() in ("1", "true", "yes", "on")

RECONNECT_DELAY = 5  # seconds


def _hash8(payload: dict[str, Any]) -> str:
    """Return first 8 hex chars of the MD5 of the canonical JSON representation."""
    canonical = json.dumps(payload, sort_keys=True)
    return hashlib.md5(canonical.encode("utf-8")).hexdigest()[:8]


def _normalise_payload(payload: dict[str, Any], topic: str) -> dict[str, Any]:
    """Normalise a raw hardware payload into the standard sensor telemetry shape."""
    device_id = (
        payload.get("id") or payload.get("deviceId") or payload.get("device_id") or "unknown"
    ).strip()

    now = datetime.now(timezone.utc).isoformat()
    event_id = f"{device_id}-{now}-{_hash8(payload)}"

    hazard_type = (payload.get("type") or payload.get("hazardType") or "").upper()

    return {
        "eventId": event_id,
        "deviceId": device_id,
        "hazardType": hazard_type,
        "temp": payload.get("temp"),
        "hum": payload.get("hum"),
        "depth": payload.get("depth"),
        "moist": payload.get("moist"),
        "ax": payload.get("ax"),
        "ay": payload.get("ay"),
        "az": payload.get("az"),
        "gx": payload.get("gx"),
        "gy": payload.get("gy"),
        "gz": payload.get("gz"),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "timestamp": now,
        "raw_payload": payload,
    }


def on_connect(client: mqtt.Client, userdata: Any, flags: Any, rc: Any, properties: Any = None) -> None:
    if rc != 0:
        logger.error("HiveMQ connect failed rc=%s", rc)
        return

    logger.info("Connected to HiveMQ %s:%s", MQTT_BROKER, MQTT_PORT)
    client.subscribe("j1/disaster/flood")
    client.subscribe("j1/disaster/landslide")
    logger.info("Subscribed: j1/disaster/flood, j1/disaster/landslide")


def on_disconnect(client: mqtt.Client, userdata: Any, rc: Any, properties: Any = None) -> None:
    logger.warning("Disconnected rc=%s — will auto-reconnect", rc)


def on_message(client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
    try:
        raw = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Ignoring non-JSON payload from topic=%s: %s", msg.topic, exc)
        return

    if not isinstance(raw, dict):
        logger.warning("Ignoring non-object payload from topic=%s", msg.topic)
        return

    try:
        normalised = _normalise_payload(raw, msg.topic)
        kafka_producer.publish_sensor_telemetry(normalised)
        logger.info(
            "Published sensor telemetry: topic=%s deviceId=%s hazardType=%s eventId=%s",
            msg.topic,
            normalised["deviceId"],
            normalised["hazardType"],
            normalised["eventId"],
        )
    except Exception as exc:
        logger.error("Failed publishing from topic=%s: %s", msg.topic, exc)


def main() -> None:
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id="j1-forwarder",
        protocol=mqtt.MQTTv5,
    )
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    tls_required = MQTT_TLS or MQTT_PORT in (8883, 8884)
    if tls_required:
        client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
        client.tls_insecure_set(False)
        logger.info("TLS enabled — connecting to %s:%s", MQTT_BROKER, MQTT_PORT)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    while True:
        try:
            logger.info("Connecting to %s:%s", MQTT_BROKER, MQTT_PORT)
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception as exc:
            logger.error("MQTT connection error: %s", exc)
            logger.info("Retrying in %ss...", RECONNECT_DELAY)
            time.sleep(RECONNECT_DELAY)


if __name__ == "__main__":
    main()
