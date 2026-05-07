#!/bin/sh
set -eu

apk add --no-cache curl >/dev/null

KIBANA=http://kibana:5601

# Wait for Kibana
until curl -sf "$KIBANA/api/status" >/dev/null 2>&1; do
  sleep 3
done

create_rule() {
  rule_name="$1"
  rule_json="$2"
  response_file="$(mktemp)"
  http_code="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$KIBANA/api/alerting/rule" \
    -H 'kbn-xsrf: true' \
    -H 'Content-Type: application/json' \
    -d "$rule_json" || true)"

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "$rule_name created"
  else
    echo "$rule_name creation returned HTTP $http_code"
    cat "$response_file"
    echo
  fi
  rm -f "$response_file"
}

echo "Creating Kong 5xx spike alert (best-effort)..."
create_rule "Kong 5xx Spike Alert" '{
  "name":"Kong 5xx Spike Alert",
  "rule_type_id":".es-query",
  "consumer":"alerts",
  "schedule":{"interval":"1m"},
  "params":{
    "index":["drs-logs-*"],
    "timeField":"@timestamp",
    "esQuery":"{\"query\":{\"bool\":{\"filter\":[{\"query_string\":{\"query\":\"service_name:disaster-kong AND http.response.status_code >= 500\"}}]}}}",
    "size":100,
    "threshold":[5],
    "thresholdComparator":">",
    "timeWindowSize":5,
    "timeWindowUnit":"m"
  },
  "tags":["kong","errors"],
  "actions":[]
}'

echo "Creating missing trace/request ID alert (best-effort)..."
create_rule "Missing Trace/Request ID Spike" '{
  "name":"Missing Trace/Request ID Spike",
  "rule_type_id":".es-query",
  "consumer":"alerts",
  "schedule":{"interval":"5m"},
  "params":{
    "index":["drs-logs-*"],
    "timeField":"@timestamp",
    "esQuery":"{\"query\":{\"bool\":{\"filter\":[{\"query_string\":{\"query\":\"NOT trace.id:* AND NOT request_id:*\"}}]}}}",
    "size":100,
    "threshold":[20],
    "thresholdComparator":">",
    "timeWindowSize":10,
    "timeWindowUnit":"m"
  },
  "tags":["observability","trace-id"],
  "actions":[]
}'

echo "Alert creation script completed (responses may indicate unsupported rule types)."
