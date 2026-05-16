#!/bin/bash
# Run J1 backend locally for development (no Docker needed)
# Requires: pip install -r requirements.txt
# Requires: root platform Kafka running (docker-compose up kafka from root)

set -e

echo "Starting J1 bridge API on port 8081..."
echo "Kafka broker: ${KAFKA_BOOTSTRAP_SERVERS:-localhost:9092}"
echo ""
echo "To override Kafka broker:"
echo "  KAFKA_BOOTSTRAP_SERVERS=localhost:9092 ./run_local.sh"
echo ""

export KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS:-localhost:9092}
export KAFKA_TOPIC_SOS_REPORTS=${KAFKA_TOPIC_SOS_REPORTS:-j1.sos.raw-reports}
export KAFKA_TOPIC_SENSOR_TELEMETRY=${KAFKA_TOPIC_SENSOR_TELEMETRY:-j1.sensor.telemetry}
export API_HOST=${API_HOST:-0.0.0.0}
export API_PORT=${API_PORT:-8081}

uvicorn app.main:app \
  --host "$API_HOST" \
  --port "$API_PORT" \
  --reload \
  --log-level info
