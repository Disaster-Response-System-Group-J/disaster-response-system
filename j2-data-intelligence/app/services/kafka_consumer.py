import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
from confluent_kafka import Consumer, KafkaError
from sqlalchemy.orm import Session

from app.db.models import IncomingReport
from app.services.kafka_producer import publish_prediction
from app.services.risk_pipeline import create_prediction, resolve_division, store_raw_telemetry

logger = logging.getLogger(__name__)

_SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qfhmczryyyddgitnlndy.supabase.co")
_SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")

_DISASTER_TYPE_MAP = {"FLOOD": "FLOOD", "LANDSLIDE": "LANDSLIDE"}


class SensorDataConsumer:
    def __init__(self, kafka_config: Dict[str, object]):
        self.kafka_config = kafka_config
        self.consumer: Optional[Consumer] = None

    def connect(self) -> None:
        self.consumer = Consumer(self.kafka_config)

    def subscribe_to_topics(self, topics: List[str]) -> None:
        if not self.consumer:
            raise RuntimeError("Consumer not connected. Call connect() first.")
        self.consumer.subscribe(topics)

    @staticmethod
    def _infer_hazard_type(message_value: Dict[str, object], kafka_topic: str = "") -> str:
        """Resolve hazard type from payload field first, then fall back to Kafka topic suffix."""
        candidate = str(message_value.get("type", "") or message_value.get("hazard_type", "")).upper()
        if candidate in {"FLOOD", "LANDSLIDE", "DROUGHT"}:
            return candidate
        topic = kafka_topic.lower()
        if topic.endswith(".flood") or topic.endswith("/flood"):
            return "FLOOD"
        if topic.endswith(".landslide") or topic.endswith("/landslide"):
            return "LANDSLIDE"
        if topic.endswith(".drought") or topic.endswith("/drought"):
            return "DROUGHT"
        return candidate  # will fail validation below, preserving the original error message

    def process_sensor_message(self, db: Session, message_value: Dict[str, object], kafka_topic: str = "") -> Dict[str, object]:
        hazard_type = self._infer_hazard_type(message_value, kafka_topic)
        if hazard_type not in {"FLOOD", "LANDSLIDE", "DROUGHT"}:
            raise ValueError("type must be one of FLOOD, LANDSLIDE, DROUGHT")

        device_id = str(message_value.get("id", ""))
        if not device_id:
            raise ValueError("Missing id in message")

        division = resolve_division(
            db,
            division_id=message_value.get("division_id"),
            device_id=device_id,
            latitude=message_value.get("latitude"),
            longitude=message_value.get("longitude"),
        )
        if not division:
            raise ValueError("Could not resolve division for message")

        store_raw_telemetry(db, message_value, division.division_id, hazard_type)
        prediction = create_prediction(db, division=division, hazard_type=hazard_type, payload=message_value)
        db.commit()

        pred_data = {
            "prediction_id": prediction.prediction_id,
            "division_id": prediction.division_id,
            "hazard_type": prediction.hazard_type,
            "prob_normal": float(prediction.prob_normal or 0.0),
            "prob_moderate": float(prediction.prob_moderate or 0.0),
            "prob_severe": float(prediction.prob_severe or 0.0),
            "prob_extreme": float(prediction.prob_extreme or 0.0),
            "predicted_severity": prediction.predicted_severity,
            "predicted_severity_label": prediction.predicted_severity_label,
            "prediction_probability": float(
                max(
                    prediction.prob_normal or 0.0,
                    prediction.prob_moderate or 0.0,
                    prediction.prob_severe or 0.0,
                    prediction.prob_extreme or 0.0,
                )
            ),
            "feature_date": prediction.feature_date.isoformat(),
            "predicted_for_date": prediction.predicted_for_date.isoformat(),
            "horizon": prediction.horizon,
        }

        division_payload = {
            "division_name": division.division_name,
            "district": division.district,
            "latitude": float(division.latitude) if division.latitude is not None else None,
            "longitude": float(division.longitude) if division.longitude is not None else None,
        }
        published = publish_prediction(division=division_payload, prediction=pred_data)

        return {
            "division_id": division.division_id,
            "prediction": pred_data,
            "kafka_published": published,
        }

    def consume_once(self, db: Session, timeout: float = 1.0) -> Optional[Dict[str, object]]:
        if not self.consumer:
            raise RuntimeError("Consumer not connected. Call connect() first.")

        msg = self.consumer.poll(timeout=timeout)
        if msg is None:
            return None

        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                return None
            raise RuntimeError(f"Kafka error: {msg.error()}")

        message_value = json.loads(msg.value().decode("utf-8"))
        result = self.process_sensor_message(db, message_value, kafka_topic=msg.topic())
        self.consumer.commit(message=msg)  # Only commit after successful DB write
        return result

    def close(self) -> None:
        if self.consumer:
            self.consumer.close()


def create_kafka_consumer_config(bootstrap_servers: str, group_id: str = "j2-sensor-consumer") -> Dict[str, object]:
    return {
        "bootstrap.servers": bootstrap_servers,
        "group.id": group_id,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,  # Manual commit after successful DB write prevents data loss on crash
        "session.timeout.ms": 30000,
    }


class SOSRequestConsumer:
    def __init__(self, kafka_config: Dict[str, object]):
        self.kafka_config = kafka_config
        self.consumer: Optional[Consumer] = None

    def connect(self) -> None:
        self.consumer = Consumer(self.kafka_config)

    def subscribe_to_topics(self, topics: List[str]) -> None:
        if not self.consumer:
            raise RuntimeError("Consumer not connected. Call connect() first.")
        self.consumer.subscribe(topics)

    def _write_to_supabase(self, record: Dict[str, object]) -> None:
        if not _SUPABASE_URL or not _SUPABASE_KEY:
            logger.warning("Supabase credentials not configured — skipping remote write")
            return
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{_SUPABASE_URL}/rest/v1/IncomingReport",
                    json=record,
                    headers={
                        "apikey": _SUPABASE_KEY,
                        "Authorization": f"Bearer {_SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    },
                )
                if resp.status_code not in (200, 201):
                    logger.error("Supabase write failed: %s %s", resp.status_code, resp.text)
                else:
                    logger.info("Supabase write OK (status %s)", resp.status_code)
        except Exception as exc:
            logger.error("Supabase write error: %s", exc)

    def process_sos_message(self, db: Session, message_value: Dict[str, object]) -> None:
        event_id = str(message_value.get("eventId", "") or "").strip() or None
        payload = message_value.get("payload") or {}

        if event_id:
            existing = db.query(IncomingReport).filter(IncomingReport.event_id == event_id).first()
            if existing:
                return

        latitude_raw = payload.get("latitude") or message_value.get("latitude")
        longitude_raw = payload.get("longitude") or message_value.get("longitude")
        sos_type_raw = (
            payload.get("sosType")
            or message_value.get("sosType")
            or payload.get("disasterType")
            or message_value.get("disasterType")
            or ""
        )
        district = str(payload.get("district") or message_value.get("district") or "Unknown")
        description = str(payload.get("description") or message_value.get("description") or "")
        media_url = payload.get("mediaUrl") or message_value.get("mediaUrl")
        contact_info = payload.get("contactInfo") or message_value.get("contactInfo")

        latitude = float(latitude_raw) if latitude_raw is not None else 0.0
        longitude = float(longitude_raw) if longitude_raw is not None else 0.0
        disaster_type = _DISASTER_TYPE_MAP.get(str(sos_type_raw).upper(), "OTHER")

        report = IncomingReport(
            event_id=event_id,
            source_channel="J1_SOS_APP",
            status="PENDING_REVIEW",
            sos_type=disaster_type,
            district=district,
            latitude=latitude,
            longitude=longitude,
            description=description,
            media_url=str(media_url) if media_url else None,
            contact_info=str(contact_info) if contact_info else None,
            raw_payload=json.dumps(message_value),
            received_at=datetime.now(timezone.utc),
        )
        db.add(report)
        db.commit()

        supabase_record: Dict[str, object] = {
            "source": "J1_SOS_APP",
            "disasterType": disaster_type,
            "district": district,
            "latitude": latitude,
            "longitude": longitude,
            "description": description,
            "mediaUrls": [],
        }
        if event_id:
            supabase_record["sosId"] = event_id
        if contact_info:
            supabase_record["contact"] = str(contact_info)

        self._write_to_supabase(supabase_record)

    def consume_once(self, db: Session, timeout: float = 1.0) -> None:
        if not self.consumer:
            raise RuntimeError("Consumer not connected. Call connect() first.")

        msg = self.consumer.poll(timeout=timeout)
        if msg is None:
            return

        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                return
            raise RuntimeError(f"Kafka error: {msg.error()}")

        message_value = json.loads(msg.value().decode("utf-8"))
        self.process_sos_message(db, message_value)
        self.consumer.commit(message=msg)  # Only commit after successful DB write

    def close(self) -> None:
        if self.consumer:
            self.consumer.close()
