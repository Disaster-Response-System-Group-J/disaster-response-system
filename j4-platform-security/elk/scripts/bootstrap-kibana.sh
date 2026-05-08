#!/bin/sh
set -eu

apk add --no-cache curl >/dev/null

echo "Waiting for Kibana..."
until curl -sf http://kibana:5601/api/status >/dev/null 2>&1; do
  sleep 5
done

echo "Creating/updating data view drs-logs-data-view..."
curl -sS -X POST "http://kibana:5601/api/saved_objects/index-pattern/drs-logs-data-view?overwrite=true" \
  -H 'kbn-xsrf: true' \
  -H 'Content-Type: application/json' \
  -d '{"attributes":{"title":"drs-logs-*","name":"DRS Logs","timeFieldName":"@timestamp"}}'

echo "Importing DRS logs dashboard objects..."
curl -sS -X POST "http://kibana:5601/api/saved_objects/_import?overwrite=true" \
  -H 'kbn-xsrf: true' \
  --form file=@/setup/drs-logs-dashboard.ndjson
if [ -f /setup/drs-kong-dashboard.ndjson ]; then
  echo "Importing DRS Kong dashboard objects..."
  curl -sS -X POST "http://kibana:5601/api/saved_objects/_import?overwrite=true" \
    -H 'kbn-xsrf: true' \
    --form file=@/setup/drs-kong-dashboard.ndjson || true
fi
if [ -f /setup/drs-missing-trace-search.ndjson ]; then
  echo "Importing saved search for missing trace IDs..."
  curl -sS -X POST "http://kibana:5601/api/saved_objects/_import?overwrite=true" \
    -H 'kbn-xsrf: true' \
    --form file=@/setup/drs-missing-trace-search.ndjson || true
fi

echo "Kibana bootstrap complete"
if [ -f /setup/create-kibana-alerts.sh ]; then
  echo "Creating Kibana alerts (best-effort)..."
  sh /setup/create-kibana-alerts.sh || true
fi
