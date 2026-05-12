"""MQTT -> J1 HTTP forwarder for hardware sensor payloads.

Subscribes to Central Node MQTT topics and forwards raw JSON payloads to
J1 `/api/v1/ingest/sensor`, where they are normalized and relayed to J2.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import httpx
import paho.mqtt.client as mqtt

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("j1.mqtt_http_forwarder")

MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_TOPICS = [t.strip() for t in os.getenv("MQTT_TOPICS", "j1/disaster/#").split(",") if t.strip()]

J1_BASE_URL = os.getenv("J1_BASE_URL", "http://j1-bridge-api:8000")
J1_SENSOR_ENDPOINT = f"{J1_BASE_URL.rstrip('/')}/api/v1/ingest/sensor"
J1_TIMEOUT_SECONDS = float(os.getenv("J1_TIMEOUT_SECONDS", "8.0"))


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
        _forward_sensor_payload(sensor_payload)
    except Exception as exc:
        logger.error("Failed forwarding payload from topic=%s error=%s", msg.topic, exc)


def main() -> None:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="j1-mqtt-http-forwarder")
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

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
