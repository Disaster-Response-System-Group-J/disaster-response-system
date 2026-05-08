#!/usr/bin/env bash
# Vault setup script for Disaster Response System
# Seeds initial secrets the platform needs into Vault.
# Idempotent — KV v2 PUT is upsert.
#
# Currently dev mode only (root token auth). Production setup will need
# AppRole / k8s auth and proper secret rotation.
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:?VAULT_TOKEN is required (root token in dev mode)}"

echo "==> Waiting for Vault to be ready..."
until curl -sf "$VAULT_ADDR/v1/sys/health" >/dev/null 2>&1; do
  sleep 2
done
echo "    Vault reachable."

# ── Seed secrets ────────────────────────────────────────────────────────────

echo ""
echo "==> Seeding secrets..."

# secret/keycloak/admin — sourced from KEYCLOAK_ADMIN_PASSWORD env (which itself
# still comes from .env until we wire Keycloak to fetch from Vault directly).
if [[ -n "${KEYCLOAK_ADMIN_PASSWORD:-}" ]]; then
  curl -sf -H "X-Vault-Token: $VAULT_TOKEN" \
    -X POST "$VAULT_ADDR/v1/secret/data/keycloak/admin" \
    -d "{\"data\":{\"password\":\"$KEYCLOAK_ADMIN_PASSWORD\"}}" >/dev/null \
    && echo "    secret/keycloak/admin OK"
else
  echo "    KEYCLOAK_ADMIN_PASSWORD not set — skipping secret/keycloak/admin" >&2
fi

echo ""
echo "==> Vault setup complete!"
