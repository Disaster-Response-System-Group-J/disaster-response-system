# Platform Security Setup Guide
## Kong API Gateway + Keycloak Identity

This document explains every step taken to configure the API gateway and
authentication layer for the Disaster Response System, and **why** each
step matters.

---

## Overview

The system uses two key infrastructure components:

| Component | Role | URL |
|-----------|------|-----|
| **Kong** | API Gateway — all traffic enters here | `http://localhost:8000` |
| **Keycloak** | Identity Provider — issues JWT tokens | `http://localhost:8180` |

Think of Kong as the front door of your entire system. Every HTTP request from
a client must pass through it. Kong then decides where to send the request and
whether to allow it at all. Keycloak is the bouncer — it verifies who a user
is and issues a signed "badge" (JWT token) proving their identity and role.

---

## Part 1 — Kong API Gateway

### What is Kong?

Kong sits in front of all your microservices. Instead of a frontend app
needing to know the addresses of J1, J2, J3, and J4 individually, it only
ever talks to Kong (`http://localhost:8000`). Kong figures out where to
forward the request based on the URL path.

```
Client → Kong (:8000) → /api/v1/devices      → J1 (:8081)
                       → /api/v1/intelligence → J2 (:8082)
                       → /api/v1/system       → J3 (:8083)
                       → /api/v1/platform     → J4 (:8084)
```

Kong is configured via its **Admin API** on port `8001`. You send `curl`
requests to `localhost:8001` to register services, routes, and plugins.
Those changes take effect immediately — no restart needed.

---

### Step 1.1 — Register Services

A **Service** in Kong is a named record that points to an upstream server.

```bash
curl -X POST http://localhost:8001/services \
  --data name=j1-device-edge \
  --data url=http://j1-device-edge:8081
```

**Why:** Kong needs to know where each microservice lives before it can route
to it. The hostnames (`j1-device-edge`, etc.) work because Docker Compose puts
all containers on the same internal network where containers can reach each
other by service name.

We registered four services:

| Service Name | Upstream URL |
|---|---|
| `j1-device-edge` | `http://j1-device-edge:8081` |
| `j2-data-intelligence` | `http://j2-data-intelligence:8082` |
| `j3-system-interaction` | `http://j3-system-interaction:8083` |
| `j4-platform-security` | `http://j4-platform-security:8084` |

---

### Step 1.2 — Create Routes

A **Route** tells Kong which incoming URL path maps to which Service.

```bash
curl -X POST http://localhost:8001/services/j1-device-edge/routes \
  --data name=j1-route \
  --data "paths[]=/api/v1/devices" \
  --data strip_path=false
```

**Why:** Without a route, Kong has no idea that a request for
`/api/v1/devices` should go to J1. `strip_path=false` means the full path
(`/api/v1/devices`) is forwarded to the upstream service unchanged — the
microservice receives the same path the client sent.

| Route Name | Path | Forwards To |
|---|---|---|
| `j1-route` | `/api/v1/devices` | `j1-device-edge` |
| `j2-route` | `/api/v1/intelligence` | `j2-data-intelligence` |
| `j3-route` | `/api/v1/system` | `j3-system-interaction` |
| `j4-route` | `/api/v1/platform` | `j4-platform-security` |

---

### Step 1.3 — Rate Limiting Plugin

```bash
curl -X POST http://localhost:8001/routes/j1-route/plugins \
  --data name=rate-limiting \
  --data config.minute=100 \
  --data config.policy=local
```

**Why:** Rate limiting protects your services from being overloaded. Without
it, a single buggy client (or a malicious user) could send thousands of
requests per second and crash a microservice. With this config, each client
IP is limited to **100 requests per minute**. If they exceed that, Kong
returns `HTTP 429 Too Many Requests` without ever touching your service.

`policy=local` means Kong tracks the count in its own memory (no external
Redis needed), which is fine for development.

---

### Re-running the Setup

If you ever reset your Docker environment (e.g., `docker compose down -v`),
Kong loses all configuration. Run the setup script to restore it:

```bash
bash j4-platform-security/kong/setup.sh
```

---

## Part 2 — Keycloak Identity Provider

### What is Keycloak?

Keycloak is an open-source Identity and Access Management (IAM) server. It
handles:
- **Authentication** — verifying a user's username and password
- **Authorization** — determining what roles a user has
- **Token issuance** — giving out signed JWT tokens that other services can
  verify without calling Keycloak again

### Key concepts

| Term | Meaning |
|---|---|
| **Realm** | An isolated namespace — has its own users, roles, clients |
| **Role** | A label (e.g. `admin`, `viewer`) attached to a user |
| **Client** | An application that asks Keycloak to authenticate users |
| **JWT** | A signed JSON token proving who the user is and what roles they have |

---

### Step 2.1 — Create the Realm

```bash
curl -X POST http://localhost:8180/admin/realms \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"realm": "disaster-response", "enabled": true}'
```

**Why:** We create a dedicated realm called `disaster-response` instead of
using the default `master` realm. The `master` realm is for Keycloak
administration only. Keeping your app in its own realm means its users and
configuration are completely isolated and can be exported/imported
independently.

---

### Step 2.2 — Create Roles

```bash
curl -X POST http://localhost:8180/admin/realms/disaster-response/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "field-responder"}'
```

**Why:** Roles express *what a user is allowed to do*. A `viewer` might only
be able to read incident data. A `coordinator` can update it. An `admin` can
manage the whole system. By attaching roles to JWT tokens, your microservices
can enforce authorization without calling Keycloak again — they just check
the token payload.

Roles created:
- `admin`
- `coordinator`
- `field-responder`
- `viewer`

---

### Step 2.3 — Create Test Users

Each user was created with a password and their role assigned immediately:

| Username | Password | Role |
|---|---|---|
| `admin.user` | `Test1234!` | `admin` |
| `coord.user` | `Test1234!` | `coordinator` |
| `field.user` | `Test1234!` | `field-responder` |
| `view.user` | `Test1234!` | `viewer` |

**Why:** Having one user per role lets you test that your services correctly
allow or deny requests based on the JWT role claim. For example, you can
confirm that a `viewer` token is rejected when trying to delete an incident.

---

### Step 2.4 — Create the `j3-frontend` Client

```json
{
  "clientId": "j3-frontend",
  "publicClient": true,
  "directAccessGrantsEnabled": true
}
```

**Why:** A client represents the J3 frontend application. `publicClient: true`
means no client secret is needed (appropriate for browser-based apps).
`directAccessGrantsEnabled: true` enables the **Resource Owner Password**
flow — a user sends their username and password directly to get a token. This
is the simplest flow for testing and development. In production you'd use
the Authorization Code flow with a browser redirect instead.

---

### Step 2.5 — JWT Token Verification

To prove everything works, we fetched a token for `field.user`:

```bash
curl -X POST http://localhost:8180/realms/disaster-response/protocol/openid-connect/token \
  -d "client_id=j3-frontend&username=field.user&password=Test1234!&grant_type=password"
```

The decoded JWT payload contains:

```json
{
  "preferred_username": "field.user",
  "realm_access": {
    "roles": ["field-responder", ...]
  },
  "azp": "j3-frontend",
  "iss": "http://localhost:8180/realms/disaster-response"
}
```

**Why this matters:** Any microservice that receives this token can verify:
1. It was signed by our Keycloak (`iss` field)
2. It was issued to the `j3-frontend` client (`azp` field)
3. The user has the `field-responder` role

No database lookup needed — the token is self-contained and cryptographically
signed.

---

### Step 2.6 — Realm Export

The full realm configuration is saved to:

```
j4-platform-security/keycloak/realm-export.json
```

**Why:** This file captures the entire realm setup — roles, clients, and
settings. You can import it into a fresh Keycloak instance with one command,
making the setup reproducible. It also belongs in version control so the whole
team has the same Keycloak configuration.

---

## File Structure

```
j4-platform-security/
├── kong/
│   └── setup.sh              ← re-run this after any docker reset
├── keycloak/
│   └── realm-export.json     ← import this into a fresh Keycloak
└── SETUP_GUIDE.md            ← this file
```

---

## Quick Reference

### Get a token for any user

```bash
curl -s -X POST http://localhost:8180/realms/disaster-response/protocol/openid-connect/token \
  -d "client_id=j3-frontend&username=field.user&password=Test1234!&grant_type=password" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
```

### Check Kong services

```bash
curl -s http://localhost:8001/services | python3 -m json.tool
```

### Check Kong routes

```bash
curl -s http://localhost:8001/routes | python3 -m json.tool
```

### Re-run Kong setup after reset

```bash
bash j4-platform-security/kong/setup.sh
```
