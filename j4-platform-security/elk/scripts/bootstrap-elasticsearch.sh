#!/bin/sh
set -eu

apk add --no-cache curl >/dev/null

RETENTION_DAYS="${ELK_LOG_RETENTION_DAYS:-14}"

echo "Waiting for Elasticsearch..."
until curl -sf http://elasticsearch:9200 >/dev/null 2>&1; do
  sleep 3
done

echo "Applying ILM policy drs-logs-ilm (delete after ${RETENTION_DAYS}d)..."
curl -sf -X PUT "http://elasticsearch:9200/_ilm/policy/drs-logs-ilm" \
  -H 'Content-Type: application/json' \
  -d "{\"policy\":{\"phases\":{\"hot\":{\"actions\":{}},\"delete\":{\"min_age\":\"${RETENTION_DAYS}d\",\"actions\":{\"delete\":{}}}}}}" >/dev/null

echo "Applying index template drs-logs-template..."
curl -sf -X PUT "http://elasticsearch:9200/_index_template/drs-logs-template" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_patterns": ["drs-logs-*"],
    "template": {
      "settings": {
        "index.lifecycle.name": "drs-logs-ilm",
        "number_of_shards": 1,
        "number_of_replicas": 0
      },
      "mappings": {
        "dynamic": true,
        "properties": {
          "service_name": { "type": "keyword" },
          "request_id": { "type": "keyword" },
          "trace": {
            "properties": {
              "id": { "type": "keyword" }
            }
          },
          "log": {
            "properties": {
              "level": { "type": "keyword" }
            }
          }
        }
      }
    },
    "priority": 501
  }' >/dev/null

echo "Elasticsearch bootstrap complete"
