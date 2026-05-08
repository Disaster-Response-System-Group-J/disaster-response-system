"""
J1 Bridge API - Kafka producer wrapper.

Uses confluent-kafka to publish mobile events to the j1.events topic. Produces
are flushed per request so the HTTP 202 response means Kafka accepted the
message for this local bridge flow.
"""

from __future__ import annotations

import json
import logging
from threading import Event
from typing import Any

from confluent_kafka import KafkaError, Producer
from confluent_kafka.admin import AdminClient, NewTopic

from .config import settings

logger = logging.getLogger("j1.kafka")


class KafkaProducerWrapper:
    """Manages a Kafka producer connection with topic creation."""

    def __init__(self) -> None:
        self._producer: Producer | None = None
        self._connected = False

    def connect(self) -> None:
        """Initialize the Kafka producer and ensure the topic exists."""
        conf = {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "client.id": "j1-bridge-api",
            "acks": "all",
            "retries": 3,
            "retry.backoff.ms": 500,
            "message.timeout.ms": settings.KAFKA_PRODUCER_TIMEOUT * 1000,
        }
        self._producer = Producer(conf)
        self._ensure_topic_exists()
        self._connected = True
        logger.info("Kafka producer connected to %s", settings.KAFKA_BOOTSTRAP_SERVERS)

    def _ensure_topic_exists(self) -> None:
        """Create the events topic if it does not already exist."""
        try:
            admin = AdminClient({"bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS})
            topic = NewTopic(settings.KAFKA_TOPIC_EVENTS, num_partitions=3, replication_factor=1)
            futures = admin.create_topics([topic])
            for topic_name, future in futures.items():
                try:
                    future.result()
                    logger.info("Created Kafka topic: %s", topic_name)
                except Exception as exc:
                    if "TOPIC_ALREADY_EXISTS" in str(exc):
                        logger.info("Kafka topic already exists: %s", topic_name)
                    else:
                        logger.warning("Topic creation warning for %s: %s", topic_name, exc)
        except Exception as exc:
            logger.warning("Could not ensure Kafka topic exists: %s", exc)

    def produce(self, event: dict[str, Any], event_id: str) -> None:
        """Produce an event to Kafka and wait for its delivery callback."""
        if not self._producer or not self._connected:
            raise RuntimeError("Kafka producer is not connected")

        delivered = Event()
        delivery_error: list[KafkaError | None] = [None]

        def delivery_callback(err: KafkaError | None, msg) -> None:
            delivery_error[0] = err
            if err is None:
                logger.info(
                    "Event delivered: topic=%s partition=%s offset=%s key=%s",
                    msg.topic(),
                    msg.partition(),
                    msg.offset(),
                    msg.key().decode("utf-8") if msg.key() else None,
                )
            else:
                logger.error("Kafka delivery failed for %s: %s", event_id, err)
            delivered.set()

        self._producer.produce(
            topic=settings.KAFKA_TOPIC_EVENTS,
            key=event_id.encode("utf-8"),
            value=json.dumps(event).encode("utf-8"),
            callback=delivery_callback,
        )
        remaining = self._producer.flush(settings.KAFKA_PRODUCER_TIMEOUT)
        if remaining > 0:
            raise TimeoutError(f"Kafka delivery timed out for event {event_id}")
        if not delivered.is_set():
            raise RuntimeError(f"Kafka delivery callback did not run for event {event_id}")
        if delivery_error[0] is not None:
            raise RuntimeError(str(delivery_error[0]))

    def flush(self, timeout: float = 5.0) -> None:
        """Flush any buffered messages."""
        if self._producer:
            remaining = self._producer.flush(timeout)
            if remaining > 0:
                logger.warning("%d Kafka messages were not delivered", remaining)

    @property
    def is_connected(self) -> bool:
        return self._connected

    def disconnect(self) -> None:
        """Flush and disconnect the producer."""
        self.flush()
        self._connected = False
        self._producer = None
        logger.info("Kafka producer disconnected")


kafka_producer = KafkaProducerWrapper()
