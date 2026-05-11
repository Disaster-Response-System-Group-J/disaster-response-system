import json
from typing import Dict, List, Optional

from confluent_kafka import Consumer, KafkaError
from sqlalchemy.orm import Session

from app.services.kafka_producer import publish_prediction
from app.services.risk_pipeline import create_prediction, resolve_division, store_raw_reading


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

    def process_sensor_message(self, db: Session, message_value: Dict[str, object]) -> Dict[str, object]:
        hazard_type = str(message_value.get("type", "")).upper()
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

        store_raw_reading(db, message_value)
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
        return self.process_sensor_message(db, message_value)

    def close(self) -> None:
        if self.consumer:
            self.consumer.close()


def create_kafka_consumer_config(bootstrap_servers: str, group_id: str = "j2-sensor-consumer") -> Dict[str, object]:
    return {
        "bootstrap.servers": bootstrap_servers,
        "group.id": group_id,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
        "session.timeout.ms": 30000,
    }
