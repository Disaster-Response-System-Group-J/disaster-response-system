#!/usr/bin/env bash
# Kong setup script for Disaster Response System
# Run this any time you reset the environment: bash setup.sh
set -euo pipefail

KONG_ADMIN="${KONG_ADMIN:-http://localhost:8001}"

echo "==> Waiting for Kong to be ready..."
until curl -sf "$KONG_ADMIN" > /dev/null; do sleep 2; done
echo "    Kong is up."

# ── Services ─────────────────────────────────────────────────────────────────

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

# ── Routes ────────────────────────────────────────────────────────────────────
#
# J1 / J2 routes are coarse placeholders — those upstream containers don't
# run yet. J3 routes follow the API mapping confirmed with J3 on 2026-05-07
# (see j4-platform-security/docs/rbac-design.md). One Kong route per
# (path, method) group so future JWT/RBAC plugins can attach per-method.
#
# /api/activity is intended to terminate at j4-blockchain-audit eventually,
# but J3 currently has a stand-in handler at app/api/activity, so it's
# wired to j3-system-interaction for now and will be re-pointed once the
# audit service is deployed.

ROUTES=()
register_route() {
  local service="$1" name="$2" path="$3" methods="${4:-}"
  local args=(--data "name=$name" --data "paths[]=$path" --data strip_path=false)
  # Kong's form API takes methods as repeated `methods[]=X` entries, NOT a CSV
  # value. Sending `methods=GET,PATCH` makes Kong treat the whole string as a
  # single (invalid) method name — silent unless curl is run with -f.
  if [[ -n "$methods" ]]; then
    local IFS=','
    for m in $methods; do
      args+=(--data "methods[]=$m")
    done
  fi
  if curl -sf -X POST "$KONG_ADMIN/services/$service/routes" "${args[@]}" > /dev/null; then
    echo "    $name ($path${methods:+ [$methods]}) OK"
    ROUTES+=("$name")
  else
    echo "    $name ($path${methods:+ [$methods]}) FAILED" >&2
    return 1
  fi
}

echo ""
echo "==> Creating routes..."

# J1 / J2 placeholders
register_route j1-device-edge        j1-route /api/v1/devices
register_route j2-data-intelligence  j2-route /api/v1/intelligence

# J3 — per (path, method)
register_route j3-system-interaction j3-auth-login            /api/auth/login           POST
register_route j3-system-interaction j3-reports-post          /api/reports              POST
register_route j3-system-interaction j3-reports-rw            /api/reports              GET,PATCH
register_route j3-system-interaction j3-incidents-get         /api/incidents            GET
register_route j3-system-interaction j3-incidents-post        /api/incidents            POST
register_route j3-system-interaction j3-incidents-patch       /api/incidents            PATCH
register_route j3-system-interaction j3-relief-shelter-get    /api/relief/shelter       GET
register_route j3-system-interaction j3-relief-shelter-patch  /api/relief/shelter       PATCH
register_route j3-system-interaction j3-dashboard-overview    /api/dashboard/overview   GET
register_route j3-system-interaction j3-sensors               /api/sensors              GET
register_route j3-system-interaction j3-analytics-situation   /api/analytics/situation  GET
register_route j3-system-interaction j3-predictions           /api/predictions          GET
register_route j3-system-interaction j3-resources-list        /api/resources/list       GET,PATCH
register_route j3-system-interaction j3-divisions             /api/divisions
register_route j3-system-interaction j3-weather               /api/weather
register_route j3-system-interaction j3-alerts-get            /api/alerts               GET
register_route j3-system-interaction j3-alerts-post           /api/alerts               POST
register_route j3-system-interaction j3-activity              /api/activity             GET

# J4 audit
register_route j4-audit-api j4-audit-route /api/v1/audit

# ── Rate Limiting ─────────────────────────────────────────────────────────────

echo ""
echo "==> Applying rate limiting (100 req/min) to all routes..."

for route in "${ROUTES[@]}"; do
  curl -s -X POST "$KONG_ADMIN/routes/$route/plugins" \
    --data name=rate-limiting \
    --data config.minute=100 \
    --data config.policy=local > /dev/null && echo "    $route rate-limit OK"
done

echo ""
echo "==> Kong setup complete!"
echo "    Proxy: http://localhost:8000"
echo "    Admin: http://localhost:8001"
