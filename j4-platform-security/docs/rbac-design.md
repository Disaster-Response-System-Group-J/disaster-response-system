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

- **In scope**: user-facing API routes terminating at Kong, regardless of upstream subgroup. The route list confirmed with J3 on 2026-05-07 is in the mapping below; J1/J2-owned user routes are not yet enumerated. The user-facing audit read (`/api/activity`) is also in scope — it terminates at the J4 audit service, not J3.
- **Out of scope**:
  - Service-to-service auth (e.g. J3 *writing* to `j4-audit-api` on each user action). That uses a separate mechanism — likely a service-account JWT or shared secret, designed alongside whichever subgroup needs it first.
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

## Route → role mapping

J3 team lead provided the route list below on 2026-05-07. J1- and J2-owned user routes have not yet been enumerated by their leads. **public** in the table means the JWT plugin is not installed on that route — anyone can call it; other rows require a valid JWT plus at least one of the listed roles. Role abbreviations:

- `OPS_*` = `OPERATIONS_OFFICER_{ZONAL,NATIONAL}`
- `IC_*` = `INCIDENT_COMMANDER_{ZONAL,NATIONAL}`
- `RM_*` = `RESOURCE_MANAGEMENT_{ZONAL,NATIONAL}`
- `SYSTEM_ADMIN` is implicitly allowed on every gated route via the bypass below — not repeated in the table.

| Path | Method | Upstream | Allowed |
|---|---|---|---|
| `/api/auth/login` | `POST` | J3 (Keycloak proxy or Next.js) | **public** |
| `/api/reports` | `POST` | J3 | **public** |
| `/api/reports` | `GET`, `PATCH` | J3 | `OPS_*` |
| `/api/incidents` | `GET` | J3 | **public** |
| `/api/incidents` | `POST` | J3 | `IC_*` |
| `/api/incidents` | `PATCH` | J3 | `OPS_*`, `IC_*` |
| `/api/relief/shelter` | `GET` | J3 | **public** |
| `/api/relief/shelter` | `PATCH` | J3 | `RM_*` |
| `/api/dashboard/overview` | `GET` | J3 | `OPS_*`, `IC_*`, `RM_*` |
| `/api/sensors` | `GET` | J1 (?) | `OPS_*` |
| `/api/analytics/situation` | `GET` | J3 / J2 (?) | `IC_*` |
| `/api/predictions` | `GET` | J2 (?) | `IC_*`, `RM_*` |
| `/api/resources/list` | `GET`, `PATCH` | J3 | `RM_*` |
| `/api/activity` | `GET` | J4 `blockchain-audit` | (`SYSTEM_ADMIN` only — via bypass) |

**Known gaps to close before implementation** (tracked in [Open questions](#open-questions)):

- The path prefix `/api/<resource>` doesn't match the agreed `/api/v1/{subgroup}/<resource>` convention. The kong setup can't be written until that is reconciled — every `paths[]` value depends on it.
- `FIELD_OFFICER`, `LOGISTICS`, `RESPONSE_TEAM` do not appear in any row. Most plausibly they consume J1/J2 routes that haven't been spelled out yet.
- Upstreams marked `(?)` need confirmation. The J3 team lead's view groups these under "API routes" without saying which container actually serves them; Kong's per-route `service` definition must point at the real backend.

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
3. **`/health` exemption.** No JWT plugin or RBAC plugin on `/health` routes.
4. **Public-endpoint exemption.** Routes marked **public** in the mapping (`/api/auth/login`, `POST /api/reports`, `GET /api/incidents`, `GET /api/relief/shelter`) have no JWT plugin and no RBAC plugin attached. Kong forwards the request straight to the upstream. The backend may still inspect any opportunistically-supplied token for attribution but must not require one.
5. **Method-level routing in Kong.** Where the same path has different rules per method (`/api/reports`, `/api/incidents`, `/api/relief/shelter`), register one Kong route per `(path, method)` group using the route's `methods` config. JWT and RBAC plugins attach to the gated route(s) only; the public-method route stays naked.

## Test matrix

For each route × scenario, expected response code:

| Scenario | No token | Bad sig | Valid token, role allowed | Valid token, role NOT allowed | Token has no `realm_access.roles` | `SYSTEM_ADMIN` token |
|---|---|---|---|---|---|---|
| Any gated route | 401 | 401 | 200 (or backend response) | 403 | 403 | 200 |
| `/health` | 200 | 200 | 200 | 200 | 200 | 200 |

Concretely: at least one curl per row × the protected routes, scripted in `j4-platform-security/kong/test-rbac.sh` (to be added during implementation).

## Open questions

1. **Path-prefix mismatch.** J3's route list uses `/api/<resource>`, not the agreed `/api/v1/system/<resource>`. Either Kong is meant to strip the `/api/v1/system` prefix before forwarding (so the dashboard still calls `/api/v1/system/reports` from the browser), or the convention has been informally dropped. Reconcile with J3 before kong setup is rewritten — the answer changes every Kong `paths[]` and `strip_path` value.
2. **Subgroup ownership of J3-fronted paths.** `/api/sensors`, `/api/predictions`, and `/api/analytics/situation` look like reads served by J1/J2; `/api/activity` is the J4 audit. Kong's per-route `service` must point at the actual backend, not blindly at the J3 container. Confirm with J3 / J1 / J2 leads.
3. **Three roles unmapped.** `FIELD_OFFICER`, `LOGISTICS`, `RESPONSE_TEAM` are absent from J3's mapping. Most plausibly they consume J1/J2 device & telemetry routes that aren't yet enumerated. Need explicit answers from J1 and J2 leads, plus confirmation from J3 that no dashboard exists for these roles.
4. **Coarse vs. fine routes in Kong.** Partially settled: with public/private split per method on three resources, fine-grained per-`(path, method)` routes are required regardless. Sub-question — for paths with no method split, register one route per resource path (explicit per-route auditing) or one wildcard `/api/*` route + role logic in the plugin (fewer Kong objects)? Lean per-path.
5. **NATIONAL implies ZONAL?** If yes, encode it once in the Lua bypass; if no, the role abbreviation `OPS_*` etc. expands to two role names per row in implementation. Default assumption: yes; confirm with operations.
6. **Where allow-lists live.** In `kong/setup.sh` (one source of truth, reviewable per PR), or extracted to a YAML/JSON file the script reads (cleaner but adds a config file)? Lean: stay in setup.sh until duplication exceeds ~10 routes.
7. **Audit of denials.** Should role-denied requests log to `j4-audit-api`, or just to Kong's request log? Probably Kong's log for now; audit-API integration comes later.
8. **Token TTL & refresh.** Currently using Keycloak defaults (5min access, 30min refresh). Long-running mobile clients may need longer. Decide before customer demos.

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
