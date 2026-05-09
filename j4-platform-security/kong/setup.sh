#!/usr/bin/env bash
# Kong setup script for Disaster Response System
# Run this any time you reset the environment: bash setup.sh
set -euo pipefail

KONG_ADMIN="${KONG_ADMIN:-http://localhost:8001}"

echo "==> Waiting for Kong to be ready..."
until curl -sf "$KONG_ADMIN" > /dev/null; do sleep 2; done
echo "    Kong is up."

# ── Services ────────────────────────────────────────────────────────────────

echo ""
echo "==> Registering services..."

curl -s -X POST "$KONG_ADMIN/services" \
  --data name=j1-device-edge \
  --data url=http://j1-device-edge:8081 > /dev/null && echo "    j1-device-edge OK"

curl -s -X POST "$KONG_ADMIN/services" \
  --data name=j2-data-intelligence \
  --data url=http://j2-data-intelligence:8082 > /dev/null && echo "    j2-data-intelligence OK"

curl -s -X POST "$KONG_ADMIN/services" \
  --data name=j3-system-interaction \
  --data url=http://j3-dms:3000 > /dev/null && echo "    j3-system-interaction OK"

curl -s -X POST "$KONG_ADMIN/services" \
  --data name=j4-audit-api \
  --data url=http://j4-audit-api:8084 > /dev/null && echo "    j4-audit-api OK"

# ── Routes ──────────────────────────────────────────────────────────────────

echo ""
echo "==> Creating routes..."

curl -s -X POST "$KONG_ADMIN/services/j1-device-edge/routes" \
  --data name=j1-route \
  --data "paths[]=/api/v1/devices" \
  --data strip_path=false > /dev/null && echo "    j1-route (/api/v1/devices) OK"

curl -s -X POST "$KONG_ADMIN/services/j2-data-intelligence/routes" \
  --data name=j2-route \
  --data "paths[]=/api/v1/intelligence" \
  --data strip_path=false > /dev/null && echo "    j2-route (/api/v1/intelligence) OK"

curl -s -X POST "$KONG_ADMIN/services/j3-system-interaction/routes" \
  --data name=j3-route \
  --data "paths[]=/api/v1/system" \
  --data strip_path=false > /dev/null && echo "    j3-route (/api/v1/system) OK"

curl -s -X POST "$KONG_ADMIN/services/j4-audit-api/routes" \
  --data name=j4-audit-route \
  --data "paths[]=/api/v1/audit" \
  --data strip_path=false > /dev/null && echo "    j4-audit-route (/api/v1/audit) OK"

# ── Rate Limiting ────────────────────────────────────────────────────────────

echo ""
echo "==> Applying rate limiting (100 req/min) to all routes..."

for route in j1-route j2-route j3-route j4-audit-route; do
  curl -s -X POST "$KONG_ADMIN/routes/$route/plugins" \
    --data name=rate-limiting \
    --data config.minute=100 \
    --data config.policy=local > /dev/null && echo "    $route rate-limit OK"
done

echo ""
echo "==> Kong setup complete!"
echo "    Proxy: http://localhost:8000"
echo "    Admin: http://localhost:8001"
