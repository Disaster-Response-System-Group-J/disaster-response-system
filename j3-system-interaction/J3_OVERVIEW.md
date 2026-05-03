# J3 System — Full Technical Overview

## Table of Contents

1. [What J3 Is](#what-j3-is)
2. [Project Structure](#project-structure)
3. [How the Application Works](#how-the-application-works)
4. [Dockerization](#dockerization)
5. [Kafka Integration](#kafka-integration)
6. [Event Bridge (event-bridge.js)](#event-bridge)
7. [Real-time Layer (Socket.IO)](#real-time-layer)
8. [API Endpoints](#api-endpoints)
9. [Authentication & Roles](#authentication--roles)
10. [Database Schema](#database-schema)
11. [Mock Data & Test Infrastructure](#mock-data--test-infrastructure)
12. [Environment Configuration](#environment-configuration)
13. [Issues & Things To Do](#issues--things-to-do)

---

## What J3 Is

J3 is the **Disaster Management System (DMS)** dashboard — the command centre for government officers and resource managers during flood and landslide events in Sri Lanka. It is one component in a larger multi-team disaster response platform:

| System | Role |
|--------|------|
| **J1** | Mobile SOS app + hardware sensor network (produces Kafka events) |
| **J2** | Risk engine / prediction engine (produces Kafka risk alerts and incidents) |
| **J3** | Command centre dashboard — this codebase |
| **J4** | Keycloak identity provider (planned auth integration) |

J3 consumes events from J1 and J2 via Kafka, displays them in real-time, and lets officers act on them (verify reports, assign resources, escalate incidents).

---

## Project Structure

```
j3-system-interaction/
├── docker-compose.yml          # Orchestrates all 4 services
├── info.txt                    # Quick start notes
└── dms/                        # The Next.js application
    ├── app/                    # Next.js App Router
    │   ├── api/                # REST API routes
    │   │   ├── auth/login/
    │   │   ├── dashboard/
    │   │   ├── incidents/
    │   │   ├── resources/list/
    │   │   ├── relief/shelter/
    │   │   ├── analytics/
    │   │   └── activity/
    │   ├── dashboard/          # Protected officer/manager views
    │   │   ├── admin/
    │   │   ├── alerts/
    │   │   ├── analytics/
    │   │   ├── incident-map/
    │   │   ├── incoming-reports/
    │   │   ├── predictions/
    │   │   ├── resources/
    │   │   └── sensors/
    │   ├── login/
    │   ├── public-alerts/
    │   ├── report-incident/
    │   ├── shelters/
    │   └── emergency-contacts/
    ├── components/
    │   └── auth/
    ├── context/
    │   ├── AuthContext.tsx     # User session state
    │   └── SocketContext.tsx   # Socket.IO client state
    ├── lib/
    │   └── kafka-stub.ts       # In-memory Kafka stub for dev
    ├── prisma/
    │   └── schema.prisma       # Database models
    ├── types/
    │   └── index.ts            # All shared TypeScript types and enums
    ├── data/
    │   └── mock-data.ts        # Full mock dataset (users, incidents, resources)
    ├── docs/
    │   └── j3-data-flow.md     # Architecture notes
    ├── event-bridge.js         # Kafka consumer + Socket.IO server
    ├── mock-producer.js        # Test data generator for Kafka
    ├── Dockerfile              # Main production image (multi-stage)
    ├── Dockerfile.mock         # Mock server image
    ├── Dockerfile.prod         # Alternative prod image
    ├── .env                    # Environment variables
    └── package.json
```

---

## How the Application Works

### Runtime Components

When fully running, there are **4 processes**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network: j3-net                  │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │  PostgreSQL  │   │    Kafka     │   │   Next.js DMS      │  │
│  │  :5432       │   │  :9092       │   │   :3000            │  │
│  │  (j3-postgres)│   │  (j4-kafka)  │   │   (j3-dms)         │  │
│  └──────────────┘   └──────┬───────┘   └────────────────────┘  │
│                            │                                    │
│                    ┌───────▼───────┐                           │
│                    │ event-bridge  │                           │
│                    │  :3001        │                           │
│                    │ (Socket.IO +  │                           │
│                    │  Kafka client)│                           │
│                    └───────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

**Public user reports an incident:**
```
Browser → POST /api/incidents → Next.js API Route → (future: Kafka j3.public.reports) → stored
```

**J1 sends an SOS report:**
```
J1 App → Kafka (j1.sos.raw-reports) → event-bridge.js consumer
       → Socket.IO emit: "dashboard:new-report"
       → All connected officer browsers update in real-time
       → Toast notification fires
```

**Officer verifies a report:**
```
Officer clicks Verify → Socket emit: "client:update-report-status"
       → event-bridge.js receives it
       → Produces to Kafka (j3.dashboard.report-updates)
       → Other downstream systems consume this
```

**J2 sends a risk alert:**
```
J2 Risk Engine → Kafka (j2.engine.risk-alerts) → event-bridge.js consumer
              → Socket.IO emit: "dashboard:risk-alert"
              → Toast + map pin update in browser
```

### Frontend Architecture

The root layout (`app/layout.tsx`) wraps the entire app in two React context providers:

- **AuthProvider** — holds the logged-in user, role, and permission set
- **SocketProvider** — holds the Socket.IO client connected to event-bridge on port 3001

A `GlobalSocketListener` component sits at the root and subscribes to `dashboard:risk-alert` and `dashboard:new-report` events globally, firing toast notifications regardless of which page the user is on.

Individual dashboard pages (e.g. `incident-map`, `incoming-reports`) also subscribe to relevant socket events to update their own local state.

---

## Dockerization

### docker-compose.yml (Root Level)

Defines 4 services on the shared bridge network `j3-net`:

#### 1. `postgres` — Database

```yaml
image: postgres:16-alpine
container_name: j3-postgres
ports: ["5432:5432"]
environment:
  POSTGRES_USER: j3user
  POSTGRES_PASSWORD: j3password
  POSTGRES_DB: j3db
volumes:
  - postgres_data:/var/lib/postgresql/data
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U j3user -d j3db"]
  interval: 10s / timeout: 5s / retries: 5
```

#### 2. `kafka` — Message Broker

```yaml
image: apache/kafka:latest
container_name: j4-kafka
ports: ["9092:9092"]
environment:
  KAFKA_NODE_ID: 1
  KAFKA_PROCESS_ROLES: broker,controller
  KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
  KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
  KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

> KRaft mode (no Zookeeper). Single broker + controller. Not suitable for production HA but fine for development.

#### 3. `dms` — Next.js Application

```yaml
build:
  context: ./dms
  dockerfile: Dockerfile
ports: ["3000:3000"]
depends_on:
  postgres: { condition: service_healthy }
  kafka:    { condition: service_started }
env_file: ./dms/.env
```

#### 4. `mock-producer` (if added) — Test Data

Not currently a named service in docker-compose but can be added. Runs `mock-producer.js` using `Dockerfile.mock`.

---

### Dockerfile (dms/Dockerfile) — Multi-Stage Build

```
Stage 1: deps
  - node:20-alpine
  - npm ci (installs all dependencies)

Stage 2: builder
  - Copies deps from stage 1
  - Accepts build args: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL
  - Runs `next build`
  - Output mode: standalone

Stage 3: runner
  - node:20-alpine (minimal)
  - Copies .next/standalone + .next/static + public
  - Non-root user (nextjs:nodejs)
  - Exposes port 3000
  - CMD: node server.js
```

The `output: "standalone"` setting in `next.config.ts` tells Next.js to bundle all dependencies into the Docker image, resulting in a self-contained production server.

---

### Dockerfile.mock (dms/Dockerfile.mock)

Single-stage image for the event-bridge / mock server:

```
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["node", "mock-server.js"]
```

> Note: Currently runs `mock-server.js` — unclear if this file exists separately from `event-bridge.js`. Worth verifying.

---

## Kafka Integration

### Topics

| Topic | Direction | Producer | Consumer | Purpose |
|-------|-----------|----------|----------|---------|
| `j1.sos.raw-reports` | Inbound | J1 | J3 event-bridge | Mobile SOS alerts |
| `j1.sensor.telemetry` | Inbound | J1 | J3 event-bridge | IoT sensor readings |
| `j2.engine.risk-alerts` | Inbound | J2 | J3 event-bridge | Computed risk alerts |
| `j2.engine.incidents` | Inbound | J2 | J3 event-bridge | Confirmed incidents from engine |
| `j3.dashboard.report-updates` | Outbound | J3 | Downstream | Officer verification decisions |
| `j3.dashboard.resource-updates` | Outbound | J3 | Downstream | Resource assignment changes |

### Consumer Group

`j3-dashboard-group` — all inbound topics are consumed under this group ID.

### Topic Auto-Creation

`event-bridge.js` runs a Kafka Admin client on startup that creates any missing topics before the consumer connects. This prevents `UnknownTopicOrPartitionException` errors.

### Kafka Client Config

```js
const kafka = new Kafka({
  clientId: 'j3-dashboard',
  brokers: ['localhost:9092'],
});
```

> **Issue:** `brokers: ['localhost:9092']` works for local dev but **breaks inside Docker** because the Next.js container should address Kafka by its service name `kafka:9092`, not `localhost`. The `KAFKA_ADVERTISED_LISTENERS` in docker-compose also advertises `localhost:9092`, which is only reachable from the host machine. This needs fixing for full Docker deployment.

---

## Event Bridge

**File:** `dms/event-bridge.js`

This is the central nervous system for real-time communication. It is a standalone Node.js process (not part of the Next.js app) that:

1. Starts a **Socket.IO server** on port 3001
2. Connects to Kafka as a **consumer** (inbound from J1/J2)
3. Connects to Kafka as a **producer** (outbound from officer actions)

### Inbound Kafka → Socket.IO

```
Kafka message received on topic
  └─ j1.sos.raw-reports      → socket.emit("dashboard:new-report", parsed)
  └─ j1.sensor.telemetry     → socket.emit("sensor:telemetry-update", parsed)
  └─ j2.engine.risk-alerts   → socket.emit("dashboard:risk-alert", parsed)
  └─ j2.engine.incidents     → socket.emit("dashboard:new-incident", parsed)
```

All connected browser clients receive these events and update UI state accordingly.

### Outbound Socket.IO → Kafka

```
Browser emits event
  └─ "client:update-report-status"   → produce to j3.dashboard.report-updates
  └─ "client:update-resource-status" → produce to j3.dashboard.resource-updates
```

### CORS

The Socket.IO server allows `http://localhost:3000` — this needs to be updated for production deployments.

---

## Real-time Layer

### SocketContext.tsx

Creates and provides a single Socket.IO client instance across the app:

```ts
const socket = io("http://localhost:3001", {
  autoConnect: true,
  reconnection: true,
});
```

Components access it via `useSocket()` hook. On disconnect, it automatically retries.

> **Issue:** The URL `http://localhost:3001` is hardcoded. It should read from `process.env.NEXT_PUBLIC_SOCKET_URL`.

### GlobalSocketListener.tsx

Mounted in the root layout. Subscribes to:
- `dashboard:risk-alert` → fires a toast notification with severity colour
- `dashboard:new-report` → fires a toast notification with a link to the reports queue

### Dashboard Page Subscriptions

Individual pages subscribe and unsubscribe to events in `useEffect` hooks:

- `incident-map` listens to `dashboard:new-incident` and `dashboard:risk-alert` to add map pins
- `incoming-reports` listens to `dashboard:new-report` to prepend new items to the queue

---

## API Endpoints

All are Next.js route handlers returning JSON. Currently backed by mock data.

| Method | Route | Response |
|--------|-------|----------|
| POST | `/api/auth/login` | `{ success, user, token }` |
| GET | `/api/dashboard/overview` | `{ activeIncidents, criticalAlerts, peopleAffected, resources, alerts[] }` |
| GET | `/api/incidents` | `Incident[]` with severity, location, population |
| GET | `/api/resources/list` | `{ resourcesList[], deploymentStats }` |
| GET | `/api/relief/shelter` | `{ activeShelters, totalOccupancy, stockLevels }` |
| GET | `/api/analytics/situation` | `{ avgResponseTime, totalRelief, totalRescued }` |
| GET | `/api/activity` | Activity log entries |

---

## Authentication & Roles

### Current State

Authentication is mocked. Login checks credentials against `MOCK_USERS` in `mock-data.ts`. No real JWT is issued — `token: "mock-token"` is returned.

### Roles & Permissions

| Role | Key Permissions |
|------|----------------|
| `PUBLIC_USER` | View alerts, shelters, emergency contacts; create public reports |
| `OFFICER` | Verify/reject reports, view incidents and resources, create incidents |
| `RESOURCE_MANAGER` | Manage and assign resources, view analytics |
| `ADMIN` | All permissions |

Permissions are enforced client-side via `AuthContext` — `hasPermission(permission)` checks `ROLE_PERMISSIONS[user.role]`.

### Mock Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@gmail.com | admin123 | ADMIN |
| admin@dmc.gov.lk | admin123 | ADMIN |
| officer@dmc.gov.lk | officer123 | OFFICER |
| resource@dmc.gov.lk | resource123 | RESOURCE_MANAGER |

---

## Database Schema

Prisma schema at `dms/prisma/schema.prisma`. Tables:

| Table | Key Fields |
|-------|-----------|
| `User` | id, email, name, role, createdAt |
| `IncomingReport` | id, source, disasterType, district, lat, lng, description, verificationStatus, officerNotes, reviewedBy |
| `ConfirmedIncident` | id, title, disasterType, severity, status, location, affectedPeople |
| `Resource` | id, type, name, district, status, capacity, currentLoad, assignedIncident |
| `Alert` | id, type, severity, title, description, district, isPublic, isActive, expiresAt |

> **Note:** Prisma migrations have not been run yet (no `prisma/migrations` folder present). The app currently uses mock data — Prisma is schema-defined but not wired into the API routes.

---

## Mock Data & Test Infrastructure

### mock-data.ts

Complete dataset for UI development without a running database:
- 4 users across all roles
- 10 incoming reports (mix of statuses and sources)
- 8 confirmed incidents (mix of severities)
- 12 resources (rescue teams, boats, ambulances, shelters)
- 8 alerts
- 7 shelters with capacity/occupancy
- 8+ emergency contacts (including 119, 117, 1990)

### mock-producer.js

A standalone Node.js script that connects to Kafka and continuously produces test events:

| Event Type | Interval | Kafka Topic |
|-----------|----------|-------------|
| SOS Report | every 10s | `j1.sos.raw-reports` |
| Risk Alert | every 15s | `j2.engine.risk-alerts` |
| Sensor Telemetry | every 5s | `j1.sensor.telemetry` |

Uses Sri Lankan districts: Colombo, Galle, Kandy, Matara, Ratnapura, Kegalle.

### kafka-stub.ts

An in-memory Kafka stub (no broker required) for unit testing. Implements the same produce/consume interface as `kafkajs` but runs entirely in memory.

---

## Environment Configuration

**dms/.env**

```env
POSTGRES_USER=j3user
POSTGRES_PASSWORD=j3password
POSTGRES_DB=j3db
DATABASE_URL=postgresql://j3user:j3password@postgres:5432/j3db
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NODE_ENV=production
```

**next.config.ts**

```ts
output: "standalone"
```

---

## Issues & Things To Do

### Critical

| # | Issue | File | Details |
|---|-------|------|---------|
| 1 | **Kafka broker address wrong for Docker** | `event-bridge.js` | `brokers: ['localhost:9092']` must be `kafka:9092` when running inside Docker. Also `KAFKA_ADVERTISED_LISTENERS` needs an internal listener. |
| 2 | **Socket.IO URL hardcoded** | `SocketContext.tsx` | `io("http://localhost:3001")` ignores `NEXT_PUBLIC_SOCKET_URL`. Should use the env var. |
| 3 | **event-bridge.js not in docker-compose** | `docker-compose.yml` | The event bridge runs on port 3001 but has no service definition — it won't start automatically when you `docker compose up`. |
| 4 | **Prisma migrations not run** | `dms/prisma/` | Schema exists but no migrations folder. Need `npx prisma migrate dev` and the API routes need to be wired to Prisma instead of mock data. |
| 5 | **mock-server.js vs event-bridge.js** | `Dockerfile.mock` | `Dockerfile.mock` runs `mock-server.js` but the actual file is `event-bridge.js`. Likely a naming mismatch. |

### Should Fix

| # | Issue | Details |
|---|-------|---------|
| 6 | **Auth is fully mocked** | No real JWT, no session expiry, no Keycloak integration. Credentials are plaintext in mock-data.ts. |
| 7 | **docker-compose Kafka advertised listener** | Needs two listeners: `PLAINTEXT://localhost:9092` (host access) and `INTERNAL://kafka:9092` (container-to-container). |
| 8 | **No `docker-compose.yml` in dms/** | The compose file is one level up at the repo root but references `./dms` — running from inside `dms/` won't work. |
| 9 | **CORS in event-bridge** | `origin: "http://localhost:3000"` will break in production or staging environments. |
| 10 | **No health check for event-bridge** | `j3-dms` depends on Kafka but not on the event-bridge being ready. First page load may have no socket. |

### Nice To Have

| # | Improvement |
|---|-------------|
| 11 | Add `mock-producer` as a proper `docker-compose` service using `Dockerfile.mock` |
| 12 | Run `prisma db push` or `prisma migrate deploy` in the DMS container entrypoint |
| 13 | Replace all `MOCK_*` data references in API routes with real Prisma queries |
| 14 | Add `Dockerfile.eventbridge` and a proper `event-bridge` service in docker-compose |
| 15 | Move hardcoded Kafka topic names to a shared constants file |

---

## Quick Start (Current)

```bash
# 1. Start Postgres and Kafka
cd j3-system-interaction
docker compose up -d postgres kafka

# 2. Start the Next.js app
cd dms
npm install
npm run dev

# 3. Start the event bridge (separate terminal)
cd dms
node event-bridge.js

# 4. Feed test data (separate terminal)
cd dms
node mock-producer.js
```

**Or fully containerised (once issue #3 is fixed):**

```bash
docker compose up --build
```

Access the app at `http://localhost:3000`. Log in with `admin@gmail.com` / `admin123`.
