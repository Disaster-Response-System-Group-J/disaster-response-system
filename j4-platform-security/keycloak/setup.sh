#!/usr/bin/env bash
# Keycloak setup script for Disaster Response System
# Provisions realm roles and test users via the Admin API (idempotent).
# Run this any time you reset the environment: bash setup.sh
#
# Unlike kong/setup.sh, the Keycloak Admin API requires JSON bodies, not
# form-encoded data — that's why every POST below sends Content-Type: application/json.
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8180}"
KC_REALM="${KC_REALM:-disaster-response}"
KC_ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
KC_ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin123}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-test123}"
CLIENT_ID="${CLIENT_ID:-disaster-app}"

# If Vault is available, prefer the admin password stored at
# secret/keycloak/admin over whatever KEYCLOAK_ADMIN_PASSWORD env says.
# This is what the compose `keycloak-setup` sidecar uses; for host runs
# without Vault, the env-var fallback kicks in.
if [[ -n "${VAULT_ADDR:-}" && -n "${VAULT_TOKEN:-}" ]]; then
  echo "==> Fetching admin password from Vault ($VAULT_ADDR)..."
  vault_resp=$(curl -sf -H "X-Vault-Token: $VAULT_TOKEN" \
    "$VAULT_ADDR/v1/secret/data/keycloak/admin") || {
    echo "ERROR: Vault read failed for secret/keycloak/admin" >&2; exit 1; }
  vault_pass=$(echo "$vault_resp" | jq -r '.data.data.password // empty')
  if [[ -z "$vault_pass" ]]; then
    echo "ERROR: secret/keycloak/admin has no .password field" >&2; exit 1
  fi
  KC_ADMIN_PASS="$vault_pass"
  echo "    Using admin password from Vault."
fi

ROLES=(
  SYSTEM_ADMIN
  OPERATIONS_OFFICER_ZONAL
  OPERATIONS_OFFICER_NATIONAL
  INCIDENT_COMMANDER_ZONAL
  INCIDENT_COMMANDER_NATIONAL
  RESOURCE_MANAGEMENT_ZONAL
  RESOURCE_MANAGEMENT_NATIONAL
  FIELD_OFFICER
  PUBLIC_CITIZEN
  LOGISTICS
  RESPONSE_TEAM
)

# username : role
USERS=(
  "system-admin-test:SYSTEM_ADMIN"
  "ops-officer-zonal-test:OPERATIONS_OFFICER_ZONAL"
  "ops-officer-national-test:OPERATIONS_OFFICER_NATIONAL"
  "incident-cmd-zonal-test:INCIDENT_COMMANDER_ZONAL"
  "incident-cmd-national-test:INCIDENT_COMMANDER_NATIONAL"
  "resource-mgmt-zonal-test:RESOURCE_MANAGEMENT_ZONAL"
  "resource-mgmt-national-test:RESOURCE_MANAGEMENT_NATIONAL"
  "field-officer-test:FIELD_OFFICER"
  "public-citizen-test:PUBLIC_CITIZEN"
  "logistics-test:LOGISTICS"
  "response-team-test:RESPONSE_TEAM"
)

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required (apt install jq / brew install jq)" >&2; exit 1; }

# All Keycloak calls go through this wrapper. The X-Forwarded-Proto: https
# header lets HTTP requests through Keycloak's per-realm sslRequired check
# (master defaults to "external" and rejects non-loopback HTTP otherwise).
# Requires KC_PROXY_HEADERS=xforwarded on the keycloak service.
kc_curl() { curl -H "X-Forwarded-Proto: https" "$@"; }

echo "==> Waiting for Keycloak realm '$KC_REALM' to be ready..."
until kc_curl -sf "$KC_URL/realms/$KC_REALM/.well-known/openid-configuration" >/dev/null; do
  sleep 2
done
echo "    Realm reachable."

# ── Admin token ─────────────────────────────────────────────────────────────

echo ""
echo "==> Acquiring admin access token..."
TOKEN_RESP=$(kc_curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$KC_ADMIN_USER" \
  -d "password=$KC_ADMIN_PASS")
TOKEN=$(echo "$TOKEN_RESP" | jq -r '.access_token // empty')
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Failed to acquire admin token" >&2
  echo "Response: $TOKEN_RESP" >&2
  exit 1
fi
AUTH_HEADER="Authorization: Bearer $TOKEN"
echo "    Token acquired."

# ── Realm roles ─────────────────────────────────────────────────────────────

echo ""
echo "==> Creating realm roles..."
for role in "${ROLES[@]}"; do
  if kc_curl -sf -H "$AUTH_HEADER" "$KC_URL/admin/realms/$KC_REALM/roles/$role" >/dev/null 2>&1; then
    echo "    $role already exists, skipping"
  else
    kc_curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -X POST "$KC_URL/admin/realms/$KC_REALM/roles" \
      -d "{\"name\":\"$role\"}" && echo "    $role OK"
  fi
done

# ── Application client ──────────────────────────────────────────────────────
# Public client used by J3 (and other frontends) to mint user tokens.
# admin-cli won't do — its default scopes don't emit `realm_access.roles`,
# so Kong has nothing to gate on. New clients get the `roles` scope by default.

echo ""
echo "==> Creating application client '$CLIENT_ID'..."
existing_client=$(kc_curl -sf -H "$AUTH_HEADER" \
  "$KC_URL/admin/realms/$KC_REALM/clients?clientId=$CLIENT_ID" \
  | jq -r '.[0].id // empty')

if [[ -z "$existing_client" ]]; then
  kc_curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -X POST "$KC_URL/admin/realms/$KC_REALM/clients" \
    -d "{
      \"clientId\": \"$CLIENT_ID\",
      \"enabled\": true,
      \"publicClient\": true,
      \"standardFlowEnabled\": true,
      \"directAccessGrantsEnabled\": true,
      \"redirectUris\": [\"http://localhost:3000/*\"],
      \"webOrigins\": [\"http://localhost:3000\"]
    }" && echo "    $CLIENT_ID created"
else
  echo "    $CLIENT_ID already exists, skipping"
fi

# ── Test users ──────────────────────────────────────────────────────────────

echo ""
echo "==> Creating test users (password: $TEST_USER_PASSWORD)..."
for entry in "${USERS[@]}"; do
  username="${entry%%:*}"
  role="${entry##*:}"

  user_id=$(kc_curl -sf -H "$AUTH_HEADER" \
    "$KC_URL/admin/realms/$KC_REALM/users?username=$username&exact=true" \
    | jq -r '.[0].id // empty')

  if [[ -z "$user_id" ]]; then
    # email/firstName/lastName are required — Keycloak 24's default flow runs
    # VERIFY_PROFILE and rejects login with "Account is not fully set up" otherwise.
    kc_curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -X POST "$KC_URL/admin/realms/$KC_REALM/users" \
      -d "{
        \"username\": \"$username\",
        \"enabled\": true,
        \"emailVerified\": true,
        \"email\": \"$username@example.test\",
        \"firstName\": \"Test\",
        \"lastName\": \"${username%-test}\",
        \"credentials\": [{\"type\":\"password\",\"value\":\"$TEST_USER_PASSWORD\",\"temporary\":false}]
      }" && echo "    $username created"
    user_id=$(kc_curl -sf -H "$AUTH_HEADER" \
      "$KC_URL/admin/realms/$KC_REALM/users?username=$username&exact=true" \
      | jq -r '.[0].id')
  else
    echo "    $username already exists"
  fi

  # Role assignment is idempotent — Keycloak silently ignores duplicates.
  role_repr=$(kc_curl -sf -H "$AUTH_HEADER" "$KC_URL/admin/realms/$KC_REALM/roles/$role")
  kc_curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -X POST "$KC_URL/admin/realms/$KC_REALM/users/$user_id/role-mappings/realm" \
    -d "[$role_repr]" && echo "    $username ← $role"
done

echo ""
echo "==> Keycloak setup complete!"
echo "    Admin console: $KC_URL"
echo "    Realm:         $KC_REALM"
echo "    Roles:         ${ROLES[*]}"
echo "    Test users:    one per role, suffix '-test' (password: $TEST_USER_PASSWORD)"
echo ""
echo "    Get a test token (example):"
echo "      curl -s -X POST $KC_URL/realms/$KC_REALM/protocol/openid-connect/token \\"
echo "        -d grant_type=password -d client_id=$CLIENT_ID \\"
echo "        -d username=system-admin-test -d password=$TEST_USER_PASSWORD"
