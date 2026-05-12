#!/usr/bin/env bash
# Kong RBAC test matrix from j4-platform-security/docs/rbac-design.md.
# Prereqs: keycloak/setup.sh + kong/setup.sh have both run against the
# current stack. Mints tokens for a few representative test users and
# probes Kong with each scenario in the matrix.
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8180}"
KC_REALM="${KC_REALM:-disaster-response}"
KONG_PROXY="${KONG_PROXY:-http://localhost:8000}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-test123}"
CLIENT_ID="${CLIENT_ID:-disaster-app}"

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required" >&2; exit 1; }

mint_token() {  # client user
  curl -sf -H 'X-Forwarded-Proto: https' -X POST \
    "$KC_URL/realms/$KC_REALM/protocol/openid-connect/token" \
    -d grant_type=password -d "client_id=$1" \
    -d "username=$2" -d "password=$TEST_USER_PASSWORD" \
    | jq -r '.access_token // empty'
}

echo "==> Minting test tokens..."
T_SA=$(mint_token "$CLIENT_ID" system-admin-test)
T_OPS=$(mint_token "$CLIENT_ID" ops-officer-zonal-test)
T_PUB=$(mint_token "$CLIENT_ID" public-citizen-test)
# admin-cli is a default client in every realm but its default scopes don't
# include "roles" — tokens minted through it have no realm_access claim,
# which is exactly the "no realm_access" scenario from the matrix.
T_NOROLES=$(mint_token admin-cli ops-officer-zonal-test)

for var in T_SA T_OPS T_PUB T_NOROLES; do
  if [[ -z "${!var}" ]]; then
    echo "ERROR: failed to mint $var — is keycloak/setup.sh run?" >&2
    exit 1
  fi
done
echo "    all tokens minted."

PASS=0; FAIL=0

probe() {  # method url [auth-header]
  local m="$1" u="$2" h="${3:-}"
  if [[ -n "$h" ]]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$m" -H "$h" "$u"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$m" "$u"
  fi
}

# Pass if exact status match.
check_eq() {  # description expected actual
  if [[ "$2" == "$3" ]]; then
    echo "  PASS  $1  →  $3"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $1  →  expected $2, got $3"
    FAIL=$((FAIL+1))
  fi
}

# Pass if Kong forwarded (any non-401, non-403). Used where the upstream's
# response code isn't part of what we're verifying — only that Kong didn't
# block the request.
check_forwarded() {  # description actual
  case "$2" in
    401|403)
      echo "  FAIL  $1  →  Kong blocked with $2"
      FAIL=$((FAIL+1))
      ;;
    *)
      echo "  PASS  $1  →  Kong forwarded, upstream said $2"
      PASS=$((PASS+1))
      ;;
  esac
}

echo
echo '=== Gated /api/dashboard/overview (OPS_*, IC_*, RM_*) ==='
check_eq 'no token                          → 401'  401  "$(probe GET $KONG_PROXY/api/dashboard/overview)"
check_eq 'bad signature                     → 401'  401  "$(probe GET $KONG_PROXY/api/dashboard/overview 'Authorization: Bearer not.a.real.jwt')"
check_eq 'OPERATIONS_OFFICER_ZONAL          → 200'  200  "$(probe GET $KONG_PROXY/api/dashboard/overview "Authorization: Bearer $T_OPS")"
check_eq 'PUBLIC_CITIZEN (wrong role)       → 403'  403  "$(probe GET $KONG_PROXY/api/dashboard/overview "Authorization: Bearer $T_PUB")"
check_eq 'admin-cli (no realm_access)       → 403'  403  "$(probe GET $KONG_PROXY/api/dashboard/overview "Authorization: Bearer $T_NOROLES")"
check_eq 'SYSTEM_ADMIN (bypass)             → 200'  200  "$(probe GET $KONG_PROXY/api/dashboard/overview "Authorization: Bearer $T_SA")"

echo
echo '=== Public /api/relief/shelter GET (no JWT plugin) ==='
check_eq 'no token                          → 200'  200  "$(probe GET $KONG_PROXY/api/relief/shelter)"

echo
echo '=== SA-only /api/weather (empty allow-list, SA bypass only) ==='
check_eq 'OPERATIONS_OFFICER_ZONAL          → 403'  403  "$(probe GET $KONG_PROXY/api/weather "Authorization: Bearer $T_OPS")"
check_forwarded 'SYSTEM_ADMIN (bypass)             → forwarded'  "$(probe GET $KONG_PROXY/api/weather "Authorization: Bearer $T_SA")"

echo
echo '=== Any-auth /api/alerts GET ==='
check_eq 'no token                          → 401'  401  "$(probe GET $KONG_PROXY/api/alerts)"
check_forwarded 'PUBLIC_CITIZEN                    → forwarded'  "$(probe GET $KONG_PROXY/api/alerts "Authorization: Bearer $T_PUB")"
check_eq 'admin-cli (no realm_access)       → 403'  403  "$(probe GET $KONG_PROXY/api/alerts "Authorization: Bearer $T_NOROLES")"

echo
echo '=== Method discrimination on /api/incidents (POST = IC_*, GET = public) ==='
check_eq 'POST no token                     → 401'  401  "$(probe POST $KONG_PROXY/api/incidents)"
check_eq 'POST OPS_ZONAL (wrong role)       → 403'  403  "$(probe POST $KONG_PROXY/api/incidents "Authorization: Bearer $T_OPS")"
check_eq 'GET no token (public route)       → 200'  200  "$(probe GET $KONG_PROXY/api/incidents)"

echo
echo "==> $((PASS+FAIL)) tests, $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
