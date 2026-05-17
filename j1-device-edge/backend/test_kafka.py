"""
Standalone Kafka publish test — run outside Docker to verify broker connectivity.
Usage: python test_kafka.py --broker <host:port>
Example (root platform Kafka exposed on host): python test_kafka.py --broker localhost:9092
"""

import argparse
import json
import sys
from datetime import datetime, timezone

from confluent_kafka import Producer


def delivery_report(err, msg):
    if err:
        print(f"FAILED  {msg.topic()} — {err}")
        sys.exit(1)
    else:
        print(f"OK      {msg.topic()} partition={msg.partition()} offset={msg.offset()}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--broker", default="localhost:9092")
    args = parser.parse_args()

    print(f"Connecting to broker: {args.broker}")
    producer = Producer({"bootstrap.servers": args.broker})

    now = datetime.now(timezone.utc).isoformat()

    sos_payload = {
        "eventId": "standalone-test-001",
        "source": "J1_STANDALONE_TEST",
        "disasterType": "FLOOD",
        "district": "Colombo",
        "latitude": 6.9271,
        "longitude": 79.8612,
        "description": "Standalone Kafka test",
        "createdAt": now,
    }

    sensor_payload = {
        "eventId": "standalone-test-002",
        "deviceId": "J1_TX_01",
        "hazardType": "FLOOD",
        "temp": 28.5,
        "hum": 65.0,
        "depth": 1.23,
        "timestamp": now,
    }

    print("\nPublishing to j1.sos.raw-reports...")
    producer.produce(
        "j1.sos.raw-reports",
        key="standalone-test-001",
        value=json.dumps(sos_payload).encode("utf-8"),
        on_delivery=delivery_report,
    )

    print("Publishing to j1.sensor.telemetry...")
    producer.produce(
        "j1.sensor.telemetry",
        key="standalone-test-002",
        value=json.dumps(sensor_payload).encode("utf-8"),
        on_delivery=delivery_report,
    )

    remaining = producer.flush(timeout=10)
    if remaining > 0:
        print(f"TIMEOUT — {remaining} messages not delivered")
        sys.exit(1)

    print("\nAll messages delivered successfully.")


if __name__ == "__main__":
    main()
