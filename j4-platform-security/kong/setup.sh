#!/usr/bin/env bash
# Kong setup script for Disaster Response System
# Run this any time you reset the environment: bash setup.sh
set -euo pipefail

KONG_ADMIN="${KONG_ADMIN:-http://localhost:8001}"
# KC_REALM_URL is where this script *fetches* the realm public key from —
# may need to be the docker-internal hostname when run as a compose sidecar.
KC_REALM_URL="${KC_REALM_URL:-http://localhost:8180/realms/disaster-response}"
# KC_ISSUER is what gets stored as the Kong jwt credential's `key` field.
# It must match the `iss` claim in tokens Kong will validate. Defaults to
# KC_REALM_URL — host-running case where fetch URL == issuer URL — but the
# compose sidecar overrides this to the host-facing URL because real users
# mint tokens via the published port, not the docker-internal hostname.
KC_ISSUER="${KC_ISSUER:-$KC_REALM_URL}"
KC_CONSUMER="${KC_CONSUMER:-keycloak-disaster-app}"

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required (apt install jq / brew install jq)" >&2; exit 1; }

echo "==> Waiting for Kong to be ready..."
until curl -sf "$KONG_ADMIN" > /dev/null; do sleep 2; done
echo "    Kong is up."

echo "==> Waiting for Keycloak realm at $KC_REALM_URL..."
until curl -sf -H 'X-Forwarded-Proto: https' "$KC_REALM_URL" > /dev/null; do sleep 2; done
echo "    Realm reachable."

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

# ── Keycloak JWT consumer ─────────────────────────────────────────────────────
#
# Kong's jwt plugin looks up the credential by the token's `iss` claim, then
# verifies the signature with the credential's RSA public key. We register
# one consumer carrying one credential whose `key` is the realm's iss URL
# and `rsa_public_key` is the realm's RS256 public key fetched from Keycloak
# at script run time.

echo ""
echo "==> Setting up Keycloak JWT consumer..."

# X-Forwarded-Proto: https + KC_PROXY_HEADERS=xforwarded gets us past the
# master realm's sslRequired=external default. The disaster-response realm
# itself probably doesn't need it, but matching keycloak/setup.sh is cheaper
# than auditing per-realm policy.
KC_PUB_B64=$(curl -sf -H 'X-Forwarded-Proto: https' "$KC_REALM_URL" | jq -r '.public_key // empty')
if [[ -z "$KC_PUB_B64" ]]; then
  echo "ERROR: failed to fetch realm public key from $KC_REALM_URL" >&2
  exit 1
fi
KC_PUB_KEY=$'-----BEGIN PUBLIC KEY-----\n'"$KC_PUB_B64"$'\n-----END PUBLIC KEY-----'

curl -s -X POST "$KONG_ADMIN/consumers" \
  --data "username=$KC_CONSUMER" > /dev/null && echo "    consumer $KC_CONSUMER OK"

curl -sf -X POST "$KONG_ADMIN/consumers/$KC_CONSUMER/jwt" \
  --data "key=$KC_ISSUER" \
  --data 'algorithm=RS256' \
  --data-urlencode "rsa_public_key=$KC_PUB_KEY" > /dev/null \
  && echo "    JWT credential ($KC_ISSUER) OK"

# ── Route helpers ─────────────────────────────────────────────────────────────

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

# Shorthand expansion for role allow-lists. Per rbac-design.md:
#   OPS_*  → OPERATIONS_OFFICER_{ZONAL,NATIONAL}
#   IC_*   → INCIDENT_COMMANDER_{ZONAL,NATIONAL}
#   RM_*   → RESOURCE_MANAGEMENT_{ZONAL,NATIONAL}
# This bakes the "NATIONAL implies ZONAL" decision in at config time —
# anywhere we want both, we list both. SYSTEM_ADMIN bypass is not in the
# allow-list; it's handled in the Lua below.
expand_roles() {
  local in="$1"
  in="${in//OPS_\*/OPERATIONS_OFFICER_ZONAL,OPERATIONS_OFFICER_NATIONAL}"
  in="${in//IC_\*/INCIDENT_COMMANDER_ZONAL,INCIDENT_COMMANDER_NATIONAL}"
  in="${in//RM_\*/RESOURCE_MANAGEMENT_ZONAL,RESOURCE_MANAGEMENT_NATIONAL}"
  echo "$in"
}

# Lua RBAC template. {{ALLOWED}} expands to a Lua-table literal of role
# names; {{ANY}} is `true` (any authenticated, no role check) or `false`.
# Attached as a post-function plugin (priority -1000) so it runs *after*
# the jwt plugin (priority 1450). pre-function (priority 1000000) runs
# before jwt and would see an empty ctx — verified empirically.
# Kong 3.7's jwt plugin stores the *raw* JWT string (not the decoded
# object) at kong.ctx.shared.authenticated_jwt_token. We decode the
# payload inline; the `require "cjson.safe"` only works because the
# Kong service has KONG_UNTRUSTED_LUA_SANDBOX_REQUIRES=cjson.safe set
# in docker-compose.yml. Signature was already verified by the jwt
# plugin, so this decode is read-only.
LUA_RBAC_TEMPLATE='local cjson = require "cjson.safe"
local token = kong.ctx.shared.authenticated_jwt_token
if not token then return kong.response.exit(401, { message = "missing token" }) end
local _, payload_b64 = token:match("([^%.]+)%.([^%.]+)%.")
if not payload_b64 then return kong.response.exit(401, { message = "bad token" }) end
-- base64url → standard base64 (replace -/_ then re-pad)
local std = payload_b64:gsub("-", "+"):gsub("_", "/")
local pad = #std % 4
if pad > 0 then std = std .. string.rep("=", 4 - pad) end
local payload_str = ngx.decode_base64(std)
if not payload_str then return kong.response.exit(401, { message = "bad token" }) end
local claims = cjson.decode(payload_str)
if type(claims) ~= "table" then
  return kong.response.exit(401, { message = "bad token" })
end
local roles = (claims.realm_access or {}).roles
if type(roles) ~= "table" or #roles == 0 then
  return kong.response.exit(403, { message = "no realm_access.roles" })
end
local any_auth = {{ANY}}
if any_auth then return end
local allowed = { {{ALLOWED}} }
for _, role in ipairs(roles) do
  if role == "SYSTEM_ADMIN" or allowed[role] then return end
end
return kong.response.exit(403, { message = "role not allowed" })'

attach_jwt() {
  curl -sf -X POST "$KONG_ADMIN/routes/$1/plugins" --data 'name=jwt' > /dev/null \
    || { echo "    jwt for $1 FAILED" >&2; return 1; }
}

attach_rbac() {
  local route="$1" allowed_csv="$2" any_auth="${3:-false}"
  local allowed_lua=""
  if [[ -n "$allowed_csv" ]]; then
    local IFS=','
    for r in $allowed_csv; do
      allowed_lua+="[\"$r\"]=true,"
    done
  fi
  local lua="${LUA_RBAC_TEMPLATE//\{\{ANY\}\}/$any_auth}"
  lua="${lua//\{\{ALLOWED\}\}/$allowed_lua}"
  curl -sf -X POST "$KONG_ADMIN/routes/$route/plugins" \
    --data 'name=post-function' \
    --data-urlencode "config.access[1]=$lua" > /dev/null \
    || { echo "    rbac for $route FAILED" >&2; return 1; }
}

# Gated route: registers the route, then attaches jwt + per-route RBAC.
# Roles arg semantics:
#   "any"             → any authenticated user (JWT must be valid + non-empty roles)
#   ""                → SYSTEM_ADMIN only (via bypass; allow-list is empty)
#   "ROLE_A,ROLE_B"   → those roles (plus SYSTEM_ADMIN bypass)
gated_route() {
  local svc="$1" name="$2" path="$3" methods="$4" allowed="${5:-}"
  register_route "$svc" "$name" "$path" "$methods"
  attach_jwt "$name"
  if [[ "$allowed" == "any" ]]; then
    attach_rbac "$name" "" "true"
  else
    attach_rbac "$name" "$(expand_roles "$allowed")" "false"
  fi
}

# ── Routes ────────────────────────────────────────────────────────────────────
#
# J1/J2 routes are coarse placeholders — upstream containers don't run yet.
# J3 routes follow the API mapping confirmed with J3 on 2026-05-07
# (see j4-platform-security/docs/rbac-design.md). One Kong route per
# (path, method) group; the four public rows go through register_route
# (no JWT plugin), the rest through gated_route. /api/activity is wired
# to j3-system-interaction for now (J3 has a stand-in handler) and will
# move to j4-blockchain-audit when that service is deployed.

echo ""
echo "==> Creating routes..."

# J1 / J2 placeholders — no auth wired yet (no real upstream)
register_route j1-device-edge        j1-route /api/v1/devices
register_route j2-data-intelligence  j2-route /api/v1/intelligence

# J3 — public (no JWT)
register_route j3-system-interaction j3-auth-login            /api/auth/login           POST
register_route j3-system-interaction j3-reports-post          /api/reports              POST
register_route j3-system-interaction j3-incidents-get         /api/incidents            GET
register_route j3-system-interaction j3-relief-shelter-get    /api/relief/shelter       GET

# J3 — gated
gated_route j3-system-interaction j3-reports-rw            /api/reports              GET,PATCH  OPS_*
gated_route j3-system-interaction j3-incidents-post        /api/incidents            POST       IC_*
gated_route j3-system-interaction j3-incidents-patch       /api/incidents            PATCH      OPS_*,IC_*
gated_route j3-system-interaction j3-relief-shelter-patch  /api/relief/shelter       PATCH      RM_*
gated_route j3-system-interaction j3-dashboard-overview    /api/dashboard/overview   GET        OPS_*,IC_*,RM_*
gated_route j3-system-interaction j3-sensors               /api/sensors              GET        OPS_*
gated_route j3-system-interaction j3-analytics-situation   /api/analytics/situation  GET        IC_*
gated_route j3-system-interaction j3-predictions           /api/predictions          GET        IC_*,RM_*
gated_route j3-system-interaction j3-resources-list        /api/resources/list       GET,PATCH  RM_*
gated_route j3-system-interaction j3-divisions             /api/divisions            ''         OPS_*,IC_*
gated_route j3-system-interaction j3-weather               /api/weather              ''         ''
gated_route j3-system-interaction j3-alerts-get            /api/alerts               GET        any
gated_route j3-system-interaction j3-alerts-post           /api/alerts               POST       IC_*
gated_route j3-system-interaction j3-activity              /api/activity             GET        ''

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
