# Disaster Response System — Full Project Overview

> Sri Lanka real-time disaster management platform. Four independently developed subgroups, one shared infrastructure stack.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Services at a Glance](#services-at-a-glance)
3. [Data Flows](#data-flows)
   - [IoT / SOS → ML → Dashboard](#1-iot--sos--ml--dashboard-primary-flow)
   - [Manual Alert / Incident Creation](#2-manual-alert--incident-creation-from-dashboard)
   - [Authentication Flow](#3-authentication-flow)
   - [Audit / Blockchain Flow](#4-audit--blockchain-flow)
   - [Observability Flow](#5-observability-flow)
4. [Kafka — Topics, Producers, Consumers](#kafka--topics-producers-consumers)
5. [Subgroup Deep-Dives](#subgroup-deep-dives)
   - [J1 — Device Edge](#j1--device-edge)
   - [J2 — Data Intelligence (ML)](#j2--data-intelligence-ml)
   - [J3 — System Interaction (Dashboard)](#j3--system-interaction-dashboard)
   - [J4 — Platform Security](#j4--platform-security)
6. [Infrastructure](#infrastructure)
   - [PostgreSQL](#postgresql)
   - [Kafka](#kafka)
   - [Kong API Gateway](#kong-api-gateway)
   - [Keycloak (Identity)](#keycloak-identity)
   - [HashiCorp Vault](#hashicorp-vault)
   - [Blockchain Audit (Hardhat)](#blockchain-audit-hardhat)
   - [ELK Stack](#elk-stack)
   - [Prometheus / Grafana / Alertmanager](#prometheus--grafana--alertmanager)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Port Reference](#port-reference)
10. [Environment Variables Summary](#environment-variables-summary)
11. [What Is Actually Running vs What Is Stubbed](#what-is-actually-running-vs-what-is-stubbed)

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         External Traffic                                      │
│              Citizens / Field Officers / Admins                               │
└──────────────────────────┬───────────────────────────────────────────────────┘
                           │ HTTP / HTTPS
                           ▼
                 ┌─────────────────┐
                 │  Kong (: 8000)  │  API Gateway — JWT validation, routing
                 └────────┬────────┘
          ┌───────────────┼───────────────────┬──────────────────┐
          │               │                   │                  │
          ▼               ▼                   ▼                  ▼
   ┌─────────────┐ ┌─────────────┐   ┌──────────────┐  ┌──────────────┐
   │ J1 Bridge   │ │ J2 FastAPI  │   │  J3 Next.js  │  │ J4 Audit API │
   │  API :8081  │ │    :8082    │   │    :3000     │  │    :8084     │
   └──────┬──────┘ └──────┬──────┘   └──────┬───────┘  └──────┬───────┘
          │               │                  │                  │
          │               │          ┌───────┴──────┐          │
          │               │          │ J3 Event     │          │
          │               │          │ Bridge :3001 │          │
          │               │          └───────┬──────┘          │
          │               │                  │                  │
          └───────┬───────┘        ┌─────────┘                 │
                  │                │                            │
                  ▼                ▼                            ▼
           ┌─────────────────────────────┐           ┌──────────────────┐
           │       Apache Kafka          │           │  Hardhat Node    │
           │  (KRaft, single-broker)     │           │  (Ethereum :8545)│
           └─────────────────────────────┘           └──────────────────┘
                  │
                  ▼
           ┌──────────────┐
           │  PostgreSQL  │  (j3db, kong, keycloak schemas)
           └──────────────┘

Identity: Keycloak :8180 — issues JWTs consumed by Kong
Secrets:  HashiCorp Vault :8200 — seeds Keycloak admin password
Logs:     Filebeat → Logstash → Elasticsearch → Kibana
Metrics:  All services → Prometheus :9090 → Grafana :3030
```

---

## Services at a Glance

| Service | Image / Stack | Port | Role |
|---|---|---|---|
| **kong** | Kong 3.7 | 8000 (proxy), 8001 (admin) | API gateway, JWT auth |
| **keycloak** | Keycloak 24.0 | 8180 | Identity, OAuth2/OIDC token issuance |
| **vault** | Vault 1.17 | 8200 | Secrets management (dev mode) |
| **postgres** | PostgreSQL 16 | 5432 | Shared DB (j3db, kong, keycloak) |
| **kafka** | Kafka 3.7.1 | 9092 / 29092 | Async event bus (KRaft, no Zookeeper) |
| **j1-bridge-api** | Python FastAPI | 8081 | IoT / SOS ingestion gateway |
| **j1-mqtt-http-forwarder** | Python | — | MQTT → HTTP bridge |
| **j2-data-intelligence** | Python FastAPI | 8082 | ML risk predictions, Kafka producer |
| **j3-dms** | Next.js 16 | 3000 | Web command center dashboard |
| **j3-event-bridge** | Node.js | 3001 | Kafka → Socket.IO relay |
| **hardhat-node** | Hardhat | 8545 | Local Ethereum dev chain |
| **j4-audit-api** | Express.js | 8084 | Blockchain audit log API |
| **prometheus** | Prometheus | 9090 | Metrics scraping & storage |
| **grafana** | Grafana | 3030 | Dashboards (`DRS Overview`) |
| **alertmanager** | Alertmanager | 9093 | Alert routing (email SMTP) |
| **kafka-exporter** | kafka-exporter | 9308 | Kafka → Prometheus metrics |
| **postgres-exporter** | postgres-exporter | 9187 | Postgres → Prometheus metrics |
| **elasticsearch** | Elasticsearch | 9200 | Log index |
| **logstash** | Logstash | 5044, 9600 | Log parsing pipeline |
| **kibana** | Kibana | 5601 | Log visualization |
| **filebeat** | Filebeat | — | Docker container log harvesting |

---

## Data Flows

### 1. IoT / SOS → ML → Dashboard (Primary Flow)

This is the core real-time data pipeline.

```
┌─────────────┐      HTTP POST       ┌──────────────────┐
│ Flutter App │ ──────────────────▶  │  J1 Bridge API   │
│ (citizen /  │  /api/v1/ingest/     │      :8081       │
│  field off.)│  report OR sensor    │  (auth + validate)│
└─────────────┘                      └────────┬─────────┘
                                              │ HTTP POST to J2
                                              │ /api/v1/ingest-and-predict
                                              ▼
┌─────────────┐                      ┌──────────────────┐
│ IoT Sensors │   MQTT (j1/disaster/#)│  MQTT Forwarder  │
│ (Flood Node)│ ─────────────────▶   │                  │
└─────────────┘                      └────────┬─────────┘
                                              │ HTTP to J1 Bridge API
                                              ▼
                                     ┌──────────────────┐
                                     │  J2 FastAPI      │
                                     │      :8082       │
                                     │                  │
                                     │ 1. Store raw in  │
                                     │    raw_telemetry │
                                     │ 2. Feature eng.  │
                                     │    (rainfall lag, │
                                     │    SPI, moisture) │
                                     │ 3. Run XGBoost/  │
                                     │    LightGBM model │
                                     │ 4. Store result  │
                                     │    in disaster_  │
                                     │    predictions   │
                                     └────────┬─────────┘
                                              │ Produce to Kafka
                                              ▼
                                     ┌──────────────────┐
                                     │     Kafka        │
                                     │                  │
                                     │ j2.engine.       │
                                     │ risk-alerts      │
                                     └────────┬─────────┘
                                              │ Consume
                                              ▼
                                     ┌──────────────────┐
                                     │ J3 Event Bridge  │
                                     │      :3001       │
                                     │  (Kafka consumer)│
                                     └────────┬─────────┘
                                              │ Socket.IO broadcast
                                              │ dashboard:risk-alert
                                              ▼
                                     ┌──────────────────┐
                                     │  J3 Next.js DMS  │
                                     │      :3000       │
                                     │  Live alert feed │
                                     │  Incident map    │
                                     │  Predictions tab │
                                     └──────────────────┘
```

**Also running in parallel in J2 (APScheduler):**
- Every 30 seconds: polls IoT sensors, re-runs prediction cycle
- Daily at 02:00 UTC: fetches fresh weather data (rainfall, soil moisture)

---

### 2. Manual Alert / Incident Creation (from Dashboard)

Officers can create alerts and incidents directly from the UI. These also feed back into Kafka so all connected clients stay in sync.

```
┌──────────────────┐   WebSocket event         ┌──────────────────┐
│  J3 Dashboard    │  client:create-alert  ──▶  │ J3 Event Bridge  │
│  (Officer UI)    │  client:create-incident     │     :3001        │
└──────────────────┘                             └────────┬─────────┘
                                                          │ Produce to Kafka
                                                          │ j2.engine.risk-alerts
                                                          │ j2.engine.incidents
                                                          ▼
                                                 ┌──────────────────┐
                                                 │     Kafka        │
                                                 └────────┬─────────┘
                                                          │ Consume (all bridge consumers)
                                                          ▼
                                                 ┌──────────────────┐
                                                 │ Broadcast to ALL │
                                                 │ connected clients│
                                                 │ dashboard:new-   │
                                                 │ incident         │
                                                 └──────────────────┘
```

**Incident Dispatch** (Officer assigning resources):
```
J3 Dashboard
  → POST /api/incidents/dispatch
  → Insert ConfirmedIncident + PersonnelAssignment (PostgreSQL)
  → POST /api/audit/cases (J3 Next.js API route)
  → POST http://j4-audit-api:8084/api/v1/audit/cases
  → Write to Hardhat blockchain (IncidentAuditLog.sol)
  → Return blockchain case ID → store in ConfirmedIncident.blockchain_case_id
```

---

### 3. Authentication Flow

Every client request passes through Kong which validates Keycloak-issued JWTs.

```
┌─────────────┐   1. POST /realms/disaster-response/  ┌──────────────┐
│   Client    │      protocol/openid-connect/token ──▶ │  Keycloak    │
│ (Browser /  │                                        │    :8180     │
│  Mobile App)│   2. JWT (RS256 signed) ◀──────────── │              │
└──────┬──────┘                                        └──────────────┘
       │                                                       │
       │ 3. Request + Bearer JWT                               │ RS256 public key
       ▼                                                       ▼
┌─────────────┐   Validate JWT signature    ┌──────────────────────────────┐
│    Kong     │ ◀─────────────────────────  │  Kong JWT plugin             │
│    :8000    │   (key fetched from realm)  │  (rsa_public_key credential) │
└──────┬──────┘                             └──────────────────────────────┘
       │ 4. Proxy to upstream service (if valid)
       ▼
  J1 / J2 / J3 / J4 service
```

**Vault role:** Seeds the Keycloak admin password at container startup via `vault-setup` → `keycloak-setup` init flow. Not used at runtime.

---

### 4. Audit / Blockchain Flow

Every confirmed incident creates an immutable blockchain record.

```
┌──────────────┐  POST /api/audit/cases     ┌──────────────────┐
│ J3 Next.js   │ ─────────────────────────▶ │  J4 Audit API    │
│ (dispatch    │                            │     :8084        │
│  route)      │  { incidentId, type,       │  (Express.js)    │
└──────────────┘    location, severity }    └────────┬─────────┘
                                                     │ ethers.js v6
                                                     │ contract.createCase(...)
                                                     ▼
                                            ┌──────────────────┐
                                            │  Hardhat Node    │
                                            │     :8545        │
                                            │  IncidentAuditLog│
                                            │  .sol (Solidity) │
                                            └────────┬─────────┘
                                                     │ returns caseId
                                                     ▼
                                            ┌──────────────────┐
                                            │  Store caseId in │
                                            │  PostgreSQL      │
                                            │  ConfirmedIncident│
                                            │  .blockchain_case_id│
                                            └──────────────────┘

Later reads:
J3 Dashboard /audit page
  → GET /api/audit/cases/:id/events
  → J4 Audit API
  → Read from blockchain (immutable audit trail)
```

---

### 5. Observability Flow

```
All services expose GET /metrics (Prometheus format)
         │
         ▼
┌─────────────────────────────────────────────┐
│              Prometheus :9090               │
│  Scrapes every 15s:                         │
│  kong, keycloak, grafana, postgres,         │
│  j1, j2, j3, kafka-exporter,               │
│  postgres-exporter, alertmanager            │
└──────────┬──────────────────────────────────┘
           │
           ├──▶ Grafana :3030 (DRS Overview dashboard, auto-provisioned)
           │
           └──▶ Alertmanager :9093
                    │ (alert_rules.yml threshold breach)
                    ▼
                Email (SMTP) / Slack (configurable)

Logs:
Docker containers write to stdout/stderr
         │
         ▼
    Filebeat (sidecar)
         │ harvests /var/lib/docker/containers/
         ▼
    Logstash :5044 (parse, enrich)
         │
         ▼
    Elasticsearch :9200
         │
         ▼
    Kibana :5601
    (Dashboards: drs-logs-dashboard, drs-kong-dashboard,
                 drs-missing-trace-search)
```

---

## Kafka — Topics, Producers, Consumers

Kafka runs in **single-node KRaft mode** (no ZooKeeper). Topics are auto-created by the J3 event-bridge on startup.

### Topics

| Topic | Direction | Purpose |
|---|---|---|
| `j1.sos.raw-reports` | J1 → J3 | Raw citizen SOS reports from mobile app |
| `j1.sensor.telemetry` | J1 → J2, J3 | IoT sensor readings (depth, moisture, gyro, etc.) |
| `j2.engine.risk-alerts` | J2 → J3 | ML-generated risk predictions + manually created alerts |
| `j2.engine.incidents` | J2/J3 → J3 | Confirmed incidents |
| `j3.dashboard.report-updates` | J3 → J3 | Status changes on reports made via UI |
| `j3.dashboard.resource-updates` | J3 → J3 | Resource status changes |

### Producer Map

| Producer | Topics Written | Trigger |
|---|---|---|
| **J2 FastAPI** | `j2.engine.risk-alerts`, `j2.engine.incidents` | After ML prediction; every 30s polling cycle |
| **J3 Event Bridge** (via UI socket event) | `j2.engine.risk-alerts`, `j2.engine.incidents`, `j3.dashboard.report-updates`, `j3.dashboard.resource-updates` | Officer action in dashboard |
| **J1 Bridge API** | `j1.sos.raw-reports`, `j1.sensor.telemetry` | Ingest from mobile / MQTT forwarding |

### Consumer Map

| Consumer | Topics Read | Action |
|---|---|---|
| **J3 Event Bridge** | ALL 6 topics | Broadcasts each event via Socket.IO to connected dashboard clients |
| **J2 FastAPI** | `j1.sensor.telemetry` | Optional: additional processing on incoming sensor data |

### Socket.IO Event Mapping (Event Bridge)

| Kafka Topic | Socket.IO Event Emitted |
|---|---|
| `j1.sos.raw-reports` | `dashboard:new-report` |
| `j1.sensor.telemetry` | `sensor:telemetry-update` |
| `j2.engine.risk-alerts` | `dashboard:risk-alert` |
| `j2.engine.incidents` | `dashboard:new-incident` |
| `j3.dashboard.report-updates` | `dashboard:report-updated` |
| `j3.dashboard.resource-updates` | `dashboard:resource-updated` |

---

## Subgroup Deep-Dives

### J1 — Device Edge

**Location:** `j1-device-edge/`
**Purpose:** Collect disaster signals from the physical world and pipe them into the platform.

**Components:**

| Component | Tech | Role |
|---|---|---|
| Flutter Mobile App | Dart / Flutter | Citizen SOS reports, offline queue (SQLite), geolocation |
| Flood Node Firmware | C++ (PlatformIO) | Physical IoT sensor (depth, temp, humidity, gyro, moisture) |
| J1 Bridge API | Python FastAPI | Authenticate, validate, normalize, relay to J2 |
| MQTT HTTP Forwarder | Python | Subscribe to MQTT `j1/disaster/#`, forward to Bridge API |

**J1 Bridge API Routes:**

```
POST /api/v1/ingest/report   — citizen disaster report
POST /api/v1/ingest/sensor   — IoT sensor reading
GET  /api/v1/resources       — emergency resources list (shelters, camps)
GET  /health                 — health check
```

**Report payload:**
```json
{
  "eventId": "uuid-v4",
  "timestamp": "ISO8601",
  "deviceId": "string",
  "disasterType": "FLOOD | LANDSLIDE | DROUGHT",
  "district": "string",
  "latitude": 0.0,
  "longitude": 0.0,
  "description": "min 10 chars",
  "contact": "string",
  "mediaUrls": []
}
```

**Sensor payload:**
```json
{
  "hazardType": "FLOOD | LANDSLIDE | DROUGHT",
  "depth": 0.0,
  "temperature": 0.0,
  "humidity": 0.0,
  "moisture": 0.0,
  "ax": 0.0, "ay": 0.0, "az": 0.0,
  "gx": 0.0, "gy": 0.0, "gz": 0.0,
  "latitude": 0.0, "longitude": 0.0,
  "division_id": "string"
}
```

---

### J2 — Data Intelligence (ML)

**Location:** `j2-data-intelligence/`
**Purpose:** Run ML models on sensor/weather data and produce risk predictions.

**Tech Stack:** Python, FastAPI, PostgreSQL, XGBoost, LightGBM, scikit-learn, APScheduler, Gemini API (google-genai), confluent-kafka

**Key Scheduled Tasks:**

| Schedule | Task |
|---|---|
| Every 30 seconds | Poll IoT readings, run feature engineering, infer risk level, store prediction, produce Kafka alert |
| Daily at 02:00 UTC | Fetch fresh weather data (rainfall, soil moisture, temperature) |

**ML Models:**
- Separate classifiers for **Flood**, **Landslide**, and **Drought**
- 4-class output per model: `Normal | Moderate | Severe | Extreme`
- Algorithms: XGBoost, LightGBM ensemble

**Feature Engineering:**
- Rainfall: lag-1, rolling 3-day average, rolling 7-day average
- SPI (Standardized Precipitation Index)
- Soil moisture at 3 depths: 7–28 cm, 28–100 cm, 100–255 cm
- Month encoded as sin/cos for seasonality
- Division encoding

**Database Tables (SQLAlchemy):**

```
raw_telemetry          — all sensor readings (UNIQUE: device_id + timestamp + hazard_type)
disaster_predictions   — ML output (prob_normal, moderate, severe, extreme per division)
RainfallData           — daily rainfall per division
SoilMoisture           — soil moisture layers
TemperatureData        — temperature per location
Division               — geographic divisions
IoT_Device             — registered devices
```

**Consideration Score** (`app/utils/consideration_score.py`):
Combines ML output, class severity multiplier, and normalised population via logistic scaling → per-division priority score for resource allocation.

**Resource Allocation Agent** (`app/services/resource_allocation_agent.py`):
- Uses `gemini-2.0-flash` via Gemini API
- Reads division resources from CSV
- Queries `DisasterRisk` and `ConsiderationScore` from DB
- Produces a prioritised resource allocation plan

```
POST /api/v1/intelligence/agent/allocate
Body: { "admin_decisions": "...", "target_date": "YYYY-MM-DD" }
Requires: GEMINI_API_KEY
```

**All API Endpoints:**
```
POST /api/v1/ingest-and-predict     — ingest sensor + run prediction
GET  /api/v1/health                 — health check
GET  /api/v1/intelligence           — service info
POST /api/v1/engine/trigger         — manual pipeline trigger
POST /api/v1/intelligence/agent/allocate — Gemini resource allocation
```

---

### J3 — System Interaction (Dashboard)

**Location:** `j3-system-interaction/dms/`
**Purpose:** Web-based command center for officers and admins to monitor, coordinate, and respond to disasters in real time.

**Tech Stack:** Next.js 16.2.6, React 19.2, TypeScript, PostgreSQL (pg pool), Socket.IO client, MapLibre GL, Recharts, Tailwind CSS

**App Pages:**

| Route | Access | Purpose |
|---|---|---|
| `/login` | Public | Keycloak OAuth2 redirect |
| `/public-alerts` | Public | Citizen-facing active alerts map |
| `/report-incident` | Public | Citizen incident report form |
| `/shelters` | Public | Evacuation center map |
| `/dashboard` | Protected | Main command center |
| `/dashboard/incident-map` | Protected | Real-time incident map (MapLibre GL) |
| `/dashboard/alerts` | Protected | Risk alert feed |
| `/dashboard/resources` | Protected | Resource management |
| `/dashboard/predictions` | Protected | ML forecast visualization (Recharts) |
| `/dashboard/analytics` | Protected | Historical analytics |
| `/dashboard/sensors` | Protected | Live IoT sensor readings |
| `/dashboard/audit` | Protected (Admin) | Blockchain audit trail viewer |
| `/dashboard/admin` | Protected (Admin) | User and system administration |

**API Routes (Next.js):**

```
POST /api/auth/login                  — bcrypt password check → session token
GET  /api/incidents                   — list ConfirmedIncidents
POST /api/incidents/dispatch          — create incident + assign personnel + blockchain audit
GET  /api/alerts                      — active alerts
GET  /api/analytics                   — historical stats
GET  /api/predictions                 — ML prediction results from J2
GET  /api/resource-plan               — resource allocation plan
POST /api/audit/cases                 — proxy to J4 audit API
GET  /api/metrics                     — Prometheus metrics endpoint (prom-client)
```

**Database (PostgreSQL, j3db):**

```sql
"User"                — email, password_hash
"ConfirmedIncident"   — title, disasterType, severity, district, lat, lon,
                        status, blockchain_case_id, createdAt
"PersonnelAssignment" — FK → ConfirmedIncident, officer details
"ResourceRequest"     — FK → ConfirmedIncident, resource type, qty
```

Local SQLite at `/app/data/local_alerts.db` — alerts cache for offline resilience.

**Real-time (Socket.IO Context):**
- `SocketContext` maintains a persistent Socket.IO connection to event-bridge `:3001`
- `GlobalSocketListener` auto-triggers toast notifications and state refreshes
- All dashboard tabs react to live Kafka events without page refresh

**User Roles (Keycloak):**

| Role | Access |
|---|---|
| `PUBLIC_CITIZEN` | Public pages only |
| `FIELD_OFFICER` | Dashboard read + report |
| `OPERATIONS_OFFICER_ZONAL / NATIONAL` | Incident management |
| `INCIDENT_COMMANDER_ZONAL / NATIONAL` | Dispatch authority |
| `RESOURCE_MANAGEMENT_ZONAL / NATIONAL` | Resource allocation |
| `RESPONSE_TEAM` | Field updates |
| `LOGISTICS` | Supply chain updates |
| `SYSTEM_ADMIN` | Full access including audit |

---

### J4 — Platform Security

**Location:** `j4-platform-security/`
**Purpose:** All security, identity, observability, and immutable audit logging.

#### Kong API Gateway

All external traffic enters through Kong at `:8000`. Kong validates JWTs and proxies to the correct upstream.

**Registered Services:**

| Kong Service | Upstream |
|---|---|
| j1-device-edge | `http://j1-device-edge:8081` |
| j2-data-intelligence | `http://j2-data-intelligence:8082` |
| j3-system-interaction | `http://j3-dms:3000` |
| j4-audit-api | `http://j4-audit-api:8084` |

**JWT Plugin:** Configured with Keycloak realm's RS256 public key. Every request to non-health routes must carry `Authorization: Bearer <token>`.

#### Keycloak (Identity)

- **Realm:** `disaster-response`
- **Client:** `disaster-app` (public OIDC, direct access grant enabled)
- **11 Roles:** `SYSTEM_ADMIN`, `OPERATIONS_OFFICER_ZONAL`, `OPERATIONS_OFFICER_NATIONAL`, `INCIDENT_COMMANDER_ZONAL`, `INCIDENT_COMMANDER_NATIONAL`, `RESOURCE_MANAGEMENT_ZONAL`, `RESOURCE_MANAGEMENT_NATIONAL`, `FIELD_OFFICER`, `PUBLIC_CITIZEN`, `LOGISTICS`, `RESPONSE_TEAM`
- **Test Users:** One per role (e.g., `system-admin-test`, password `test123`)
- **DB:** PostgreSQL `keycloak` schema

#### HashiCorp Vault

- **Mode:** Dev mode (root token `dev-root-token`)
- **Purpose:** Seed Keycloak admin password at startup
- **Path:** `secret/keycloak/admin`
- **Note:** Production would use AppRole or Kubernetes auth — not configured here

#### Blockchain Audit (Hardhat + Solidity)

- **Contract:** `IncidentAuditLog.sol` — immutable on-chain record of every confirmed incident action
- **Network:** Local Hardhat dev chain (`:8545`), pre-funded account `0xac0974...`
- **J4 Audit API (Express.js `:8084`):**

```
POST /api/v1/audit/cases              — create blockchain audit case
POST /api/v1/audit/events             — log action to existing case
GET  /api/v1/audit/cases/:id/events   — read full audit trail for a case
```

#### ELK Stack

| Component | Port | Role |
|---|---|---|
| Elasticsearch | 9200 | Log index (512MB heap) |
| Logstash | 5044, 9600 | Log pipeline (Filebeat → ES) |
| Kibana | 5601 | Visualization |
| Filebeat | — | Harvests Docker container stdout/stderr |

**Prebuilt Kibana Dashboards:**
- `drs-logs-dashboard` — all service logs
- `drs-kong-dashboard` — Kong access logs, latency
- `drs-missing-trace-search` — find requests without trace IDs

---

## Infrastructure

### PostgreSQL

Single PostgreSQL 16 instance, three logical databases created by `postgres/init.sh`:

| Database | User | Used by |
|---|---|---|
| `j3db` | `j3user` | J3 Next.js (incidents, users, resources) |
| `kong` | `kong` | Kong configuration store |
| `keycloak` | `keycloak` | Keycloak realm data |

J2 uses a **separate connection** (configured via `DATABASE_URL`) — can point to Supabase or the same Postgres instance.

### Kafka

- **Mode:** Single-node KRaft (no ZooKeeper, Kafka 3.7.1)
- **Internal port:** 29092 (inter-container)
- **External port:** 9092 (host access)
- **Topic partitions:** 1 per topic (local dev; scale for production)
- **Idempotency guard:** 50,000 in-memory dedup keys in event-bridge (no Redis)
- **Performance target:** End-to-end latency < 500ms

### Kong API Gateway

- Configured via `j4-platform-security/kong/setup.sh` at container startup
- Admin API at `:8001` used for service/route/plugin registration
- JWT plugin validates RS256 Keycloak tokens
- Prometheus plugin exposes `/metrics` for scraping

### Keycloak (Identity)

- Configured via `j4-platform-security/keycloak/setup.sh`
- Idempotent: safe to re-run (checks for existing roles/users before creating)
- Admin password fetched from Vault at startup
- `GET /health` excluded from Kong JWT requirement

### HashiCorp Vault

- Dev mode: starts with `dev-root-token`, in-memory only (data lost on restart)
- `vault-setup` container writes Keycloak admin password on first run
- `keycloak-setup` reads it back to configure the realm

### Blockchain Audit (Hardhat)

- `deploy-audit-contract` is a one-time Job container that deploys `IncidentAuditLog.sol`
- Contract address stored in a shared volume, read by `j4-audit-api` on startup
- ethers.js v6 used for all contract interactions

### ELK Stack

- Log retention: 14 days (configurable via `ELK_LOG_RETENTION_DAYS`)
- Logstash pipeline config in `j4-platform-security/elk/logstash/pipeline/`
- Kibana dashboards auto-imported on setup

### Prometheus / Grafana / Alertmanager

- **Scrape interval:** 15s, timeout 10s
- **Scrape targets:** prometheus, kong, keycloak, grafana, postgres, j1, j2, j3, kafka-exporter, postgres-exporter, alertmanager
- **Alert rules:** Defined in `prometheus/alert_rules.yml`
- **Grafana:** Auto-provisioned `DRS Overview` dashboard, datasource pointed at Prometheus
- **Alertmanager:** Email via SMTP (credentials in `.env`), Slack webhook optional

---

## Kubernetes Deployment

All services have K8s manifests in `k8s/`, targeting a `disaster-response` namespace.

```
k8s/
├── namespace.yaml
├── secrets.yaml.example        (image pull, DB creds — not committed)
├── ingress.yaml                (routes to Kong :8000)
├── apps/
│   ├── j1-bridge-api.yaml      (Deployment + Service + ConfigMap)
│   ├── j2-data-intelligence.yaml
│   ├── j3-dms.yaml             (PVC for /app/data SQLite)
│   ├── j3-event-bridge.yaml
│   ├── j4-audit-api.yaml
│   ├── hardhat-node.yaml
│   ├── deploy-audit-contract.yaml  (one-time Job)
│   └── mosquitto.yaml          (MQTT broker)
├── auth/                       (kong, keycloak, vault manifests)
├── infrastructure/             (postgres StatefulSet, kafka StatefulSet)
└── monitoring/                 (prometheus, grafana, ELK, alertmanager)
```

**Init containers** on each app deployment: `nc -z postgres 5432` and `nc -z kafka 9092` — wait for dependencies before starting.

**CD flow:** GitHub Actions builds Docker images tagged `sha-{commit}` and `latest`, pushes to `docker.io/dehanns`, then patches image tags in `k8s/apps/*.yaml` and commits back. Argo CD watches the repo and applies changes.

---

## CI/CD Pipeline

### CI (`.github/workflows/ci.yml`) — all branches

1. **Path detection** — determines which subgroups changed (J1, J2, J3, J4, K8s)
2. **Per-subgroup jobs** (only if files changed):
   - **J1:** Docker build validation + Trivy security scan
   - **J2:** `flake8` lint → `pytest` → Docker build → Trivy
   - **J3:** TypeScript type-check → ESLint → `npm test` → `npm build` → Docker build → Trivy
   - **J4:** Docker build validation + Trivy
3. **Filesystem scan** — Trivy scans for secrets and misconfigurations on every branch
4. **K8s dry-run** — `kubectl apply --dry-run=client` on all manifests

### CD (`.github/workflows/cd.yml`) — main branch only

1. **Build & Push Matrix** — parallel Docker builds for J1, J2, J3, J4
   - Tags: `latest` + `sha-{commit}` pushed to `docker.io/dehanns`
2. **Patch K8s manifests** — sed-replace image tags in `k8s/apps/*.yaml`
3. **Commit & push** — auto-pushes manifest updates (triggers Argo CD webhook)

---

## Port Reference

| Port | Service |
|---|---|
| 3000 | J3 Next.js dashboard |
| 3001 | J3 Event Bridge (Socket.IO) |
| 3030 | Grafana |
| 5044 | Logstash (Beats input) |
| 5432 | PostgreSQL |
| 5601 | Kibana |
| 8000 | Kong proxy (public API) |
| 8001 | Kong Admin API |
| 8081 | J1 Bridge API |
| 8082 | J2 Data Intelligence |
| 8084 | J4 Audit API |
| 8180 | Keycloak |
| 8200 | HashiCorp Vault |
| 8545 | Hardhat Ethereum node |
| 9090 | Prometheus |
| 9093 | Alertmanager |
| 9187 | Postgres Exporter |
| 9200 | Elasticsearch |
| 9308 | Kafka Exporter |
| 9092 | Kafka (external) |
| 9600 | Logstash monitoring |
| 29092 | Kafka (internal Docker network) |

---

## Environment Variables Summary

Key variables from `.env.example`:

```
# Database
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
J3_DB_USER / J3_DB_PASSWORD / J3_DB_NAME
KONG_PG_USER / KEYCLOAK_DB_USER

# Kafka
KAFKA_BROKERS=kafka:29092

# Keycloak
KEYCLOAK_ADMIN / KEYCLOAK_ADMIN_PASSWORD=admin123
KC_ISSUER=http://localhost:8180/realms/disaster-response

# Vault
VAULT_ROOT_TOKEN=dev-root-token

# Services
INTERNAL_SERVICE_TOKEN=local-internal-token  (J1→J2 service auth)
GEMINI_API_KEY                               (J2 resource allocation agent)

# Blockchain
HARDHAT_ACCOUNT_PRIVATE_KEY                  (pre-funded account #0)
J4_AUDIT_API_URL=http://j4-audit-api:8084

# Monitoring
GRAFANA_ADMIN_PASSWORD=admin123
ALERTMANAGER_EMAIL_PASSWORD
ELK_LOG_RETENTION_DAYS=14

# Optional (Supabase fallback)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
DATABASE_URL                                 (J2 external DB override)
```

---

## What Is Actually Running vs What Is Stubbed

### Fully Operational

| Component | Status | Notes |
|---|---|---|
| Kafka (KRaft) | Running | All 6 topics active, no ZooKeeper needed |
| J1 → J2 HTTP relay | Running | Sensor/report ingestion pipeline live |
| J2 ML pipeline | Running | XGBoost/LightGBM, 30s cycle + daily weather |
| J3 Socket.IO live updates | Running | Kafka → Socket.IO → React state |
| J3 MapLibre incident map | Running | Real-time incident pins |
| Blockchain audit | Running | Hardhat dev chain + Solidity contract |
| Keycloak OIDC | Running | 11 roles, test users provisioned |
| Kong JWT validation | Running | RS256, Keycloak public key fetched at startup |
| Prometheus + Grafana | Running | DRS Overview dashboard auto-loaded |
| ELK log aggregation | Running | 14-day retention, 3 Kibana dashboards |
| Gemini resource allocation | Running | Requires `GEMINI_API_KEY` |

### Incomplete / Stubbed

| Component | Status | Notes |
|---|---|---|
| Vault production auth | Stubbed | Dev mode only; AppRole/K8s auth not configured |
| Prisma schema | Missing | CLAUDE.md references it, but raw `pg` SQL is used instead |
| Per-role Kong routes | Partial | Services registered but role-to-route RBAC not fully defined |
| K8s secrets | Template only | `secrets.yaml.example` — real values must be populated before deploy |
| Redis dedup | Absent | 50k in-memory key set used; does not survive restarts |
| MQTT broker (K8s) | Mosquitto pod | For local dev only; no production MQTT cluster |
| Supabase integration | Optional | `DATABASE_URL` and Supabase env vars are optional fallbacks |
