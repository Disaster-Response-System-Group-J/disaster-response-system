# Kong + Keycloak RBAC Design

**Status:** Draft for review (J4)
**Date:** 2026-05-07
**Owner:** J4 Platform & Security

This document proposes how the disaster-response platform will gate API access at the Kong edge using realm roles issued by Keycloak. It does **not** describe per-handler authorisation that backends may layer on top — only what Kong itself enforces.

## Goal

For every request that hits Kong:

1. The request must carry a Keycloak-signed JWT (the `disaster-app` client). No token → `401`.
2. The JWT's `realm_access.roles` must include at least one role permitted for that route. Wrong role → `403`.

Anything past Kong (i.e. inside the backend service) can do finer authorisation using the same JWT.

## Scope

- **In scope**: user-facing routes — `/api/v1/devices/*` (J1), `/api/v1/intelligence/*` (J2), `/api/v1/system/*` (J3).
- **Out of scope**:
  - Service-to-service auth (e.g. J3 → `j4-audit-api`). That uses a separate mechanism — likely a service-account JWT or shared secret, designed alongside whichever subgroup needs it first.
  - `/health` endpoints. They must remain unauthenticated for compose healthchecks and external monitors.
  - The Keycloak admin console (`:8180`), Kong admin API (`:8001`), Prometheus (`:9090`), and Grafana (`:3030`). These bypass Kong by design.

## Trust model

| Layer | Enforces |
|---|---|
| Keycloak | User identity, password, role assignment |
| Kong (this doc) | JWT signature, route-level role gating |
| Backend | Per-resource and per-record authorisation, business rules |

The backend can trust the JWT once it reaches the handler — Kong has already verified the signature. The backend should still parse the JWT to know *who* the user is for finer checks.

## Role catalogue

The realm has 11 roles. See `keycloak/setup.sh` and the realm export for the source of truth.

| Identifier | Loose description |
|---|---|
| `SYSTEM_ADMIN` | Platform admin. Bypasses route-level gating in this design. |
| `OPERATIONS_OFFICER_ZONAL` / `_NATIONAL` | Day-to-day operations management |
| `INCIDENT_COMMANDER_ZONAL` / `_NATIONAL` | Active incident command |
| `RESOURCE_MANAGEMENT_ZONAL` / `_NATIONAL` | Shelter / supplies / personnel allocation |
| `FIELD_OFFICER` | On-the-ground responder |
| `LOGISTICS` | Supply chain and dispatch |
| `RESPONSE_TEAM` | First responders |
| `PUBLIC_CITIZEN` | Members of the public submitting reports |

The `ZONAL`/`NATIONAL` split is *operational scope*, not a strict hierarchy. Whether NATIONAL implicitly grants ZONAL access is left to the backend; Kong treats them as independent roles.

## Route → role mapping (proposal)

This is the starting allow-list. It must be reviewed with each subgroup before implementation.

| Route | Method | Allowed roles |
|---|---|---|
| `/api/v1/devices/*` | any | `SYSTEM_ADMIN`, `FIELD_OFFICER`, `INCIDENT_COMMANDER_*`, `OPERATIONS_OFFICER_*` |
| `/api/v1/intelligence/*` | any | `SYSTEM_ADMIN`, `INCIDENT_COMMANDER_*`, `OPERATIONS_OFFICER_*` |
| `/api/v1/system/reports` | `POST` | `PUBLIC_CITIZEN`, `FIELD_OFFICER`, `RESPONSE_TEAM` |
| `/api/v1/system/reports` | `GET`, `PUT` | `SYSTEM_ADMIN`, `INCIDENT_COMMANDER_*`, `OPERATIONS_OFFICER_*`, `FIELD_OFFICER` |
| `/api/v1/system/incidents` | any | `SYSTEM_ADMIN`, `INCIDENT_COMMANDER_*`, `FIELD_OFFICER` |
| `/api/v1/system/shelters` | `GET` | any authenticated user |
| `/api/v1/system/shelters` | `POST`, `PUT`, `DELETE` | `SYSTEM_ADMIN`, `RESOURCE_MANAGEMENT_*` |
| `/api/v1/system/resources` | any | `SYSTEM_ADMIN`, `RESOURCE_MANAGEMENT_*`, `LOGISTICS` |
| `/api/v1/system/alerts` | any | `SYSTEM_ADMIN`, `INCIDENT_COMMANDER_*`, `OPERATIONS_OFFICER_*` |

`SYSTEM_ADMIN` is implicitly allowed everywhere (handled by the bypass below — no need to repeat it on every line in code).

## Implementation approach

Three options were considered. Detail below; recommendation up front:

> **Recommended:** approach **A** (per-route `pre-function`) until duplication or sprawl makes it painful, then migrate to **B**.

### A. `pre-function` per route, with inline allow-list

Each Kong route gets a `pre-function` plugin running ~5 lines of Lua that reads `realm_access.roles` from the validated JWT and 403s if the user isn't allowed.

Pros:
- The allow-list lives next to the route definition (in `kong/setup.sh`).
- Method-level rules are trivial — just `if ngx.var.request_method == "POST" then ...`.
- No interaction between plugins beyond jwt → pre-function.

Cons:
- Duplicated Lua across routes (mitigated by writing one helper function in setup.sh that emits the plugin config).
- Re-parses the JWT (cheap, but worth knowing).

### B. `pre-function` (claims-to-groups) + `acl` plugin (gating)

A single global `pre-function` extracts `realm_access.roles` once and stuffs them into `kong.ctx.shared.authenticated_groups`. Each route gets a Kong `acl` plugin with `config.allow=ROLE_A,ROLE_B`.

Pros:
- Per-route config is plain `acl` plugin config — no Lua.
- Idiomatic Kong.

Cons:
- Plugin priority ordering matters (jwt → pre-function → acl). Easy to get wrong.
- Two plugins to debug per route.
- `acl` is per-route, not per-method — method-specific rules (J3 `reports`, `shelters`) need either a custom plugin or splitting one route into multiple.

### C. Custom Lua plugin (`keycloak-rbac`)

Cleanest UX (one plugin, route config = allow-list), but requires plugin authoring + custom Kong image. Not worth the overhead at our current scope.

## Behaviours all approaches must implement

1. **`SYSTEM_ADMIN` bypass.** If `realm_access.roles` contains `SYSTEM_ADMIN`, the request passes regardless of the route's allow-list.
2. **Fail closed on missing claim.** A token without `realm_access.roles` (e.g. minted via `admin-cli`) gets `403`, not `200`. We do not silently allow unmatched-because-empty.
3. **`/health` exemption.** No JWT plugin or RBAC plugin on `/health` routes — only on `/api/v1/*`.
4. **Method-level rules** where called for in the mapping table above (initially: J3 `reports` and `shelters`).

## Test matrix

For each route × scenario, expected response code:

| Scenario | No token | Bad sig | Valid token, role allowed | Valid token, role NOT allowed | Token has no `realm_access.roles` | `SYSTEM_ADMIN` token |
|---|---|---|---|---|---|---|
| Any gated route | 401 | 401 | 200 (or backend response) | 403 | 403 | 200 |
| `/health` | 200 | 200 | 200 | 200 | 200 | 200 |

Concretely: at least one curl per row × the protected routes, scripted in `j4-platform-security/kong/test-rbac.sh` (to be added during implementation).

## Open questions

1. **Mapping table accuracy.** The proposed allow-list is a guess based on role names + the J3 sub-resources I could see. Each subgroup needs to confirm:
   - J1: Are device commands really restricted to `FIELD_OFFICER` + officers, or is there a `RESPONSE_TEAM` use-case?
   - J2: Is `intelligence` ever read by the public (e.g. shown in alerts)? If yes, add `PUBLIC_CITIZEN` for `GET`.
   - J3: Is the resource list above complete? `/system/users`? `/system/audit-logs`?
2. **Coarse vs. fine routes in Kong.** Implement one Kong route per `{subgroup}/{resource}` (precise but many routes), or keep coarse routes (`/api/v1/system/*`) and let the backend do per-resource auth (fewer Kong objects)?
3. **NATIONAL implies ZONAL?** If yes, we encode it once in the Lua bypass; if no, each line of the mapping needs both listed explicitly.
4. **Where allow-lists live.** In `kong/setup.sh` (one source of truth, reviewable per PR), or extracted to a YAML/JSON file the script reads (cleaner but adds a config file)? Lean: stay in setup.sh until duplication exceeds ~10 routes.
5. **Audit.** Should role-denied requests log to `j4-audit-api`, or just to Kong's request log? Probably Kong's log for now; audit-API integration comes later.
6. **Token TTL & refresh.** Currently using Keycloak defaults (5min access, 30min refresh). Long-running mobile clients may need longer. Decide before customer demos.

## Roll-out plan

1. **Get sign-off on the mapping table** (this doc, in PR review).
2. **Implement approach A in `kong/setup.sh`** — one helper function, one `pre-function` plugin per route.
3. **Wire `j4-platform-security/kong/test-rbac.sh`** with the test matrix above.
4. **Run the test matrix** end-to-end against the live stack.
5. **Update `keycloak/setup.sh`** so test users cover every role × every route in the matrix.
6. **(Future)** revisit B if the route count grows significantly or method-level rules proliferate.

## References

- `j4-platform-security/keycloak/setup.sh` — realm provisioning (roles, test users, `disaster-app` client)
- `j4-platform-security/kong/setup.sh` — Kong service/route registration
- Kong jwt plugin: https://docs.konghq.com/hub/kong-inc/jwt/
- Kong pre-function plugin: https://docs.konghq.com/hub/kong-inc/pre-function/
- Kong acl plugin: https://docs.konghq.com/hub/kong-inc/acl/
