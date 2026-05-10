# Disaster Response System — Group J

A distributed disaster response platform built by a team of 20, organised into four subgroups across device & edge systems, data & intelligence, system engineering & interaction, and platform security & integration.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Subgroups](#subgroups)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Services at a Glance](#services-at-a-glance)
- [Architecture Overview](#architecture-overview)
- [How to Add Your Service](#how-to-add-your-service)
- [API Conventions](#api-conventions)
- [Contributing](#contributing)

---

## Project Structure

```
disaster-response-system/
├── docker-compose.yml           # Root compose — starts the entire platform
├── .env                         # Shared credentials (do not commit secrets)
├── postgres/
│   └── init.sql                 # Creates all databases on first boot
├── prometheus/
│   └── prometheus.yml           # Metrics scrape config
├── J1-device-edge/              # J1 — Device & Edge Systems
├── j2-data-intelligence/        # J2 — Data & Intelligence
├── j3-system-interaction/       # J3 — System Engineering & Interaction
│   └── dms/                     # Next.js dashboard app
└── j4-platform-security/        # J4 — Platform, Security & Integration
    ├── kong/setup.sh            # Kong route registration script
    └── keycloak/realm-export.json
```

---

## Subgroups

| Subgroup | Focus | Key Technologies |
|---|---|---|
| **J1** | Device & Edge Systems | IoT, Edge computing, Device APIs |
| **J2** | Data & Intelligence | AI/ML pipelines, Data processing |
| **J3** | System Engineering & Interaction | Next.js dashboard, Socket.IO, Kafka |
| **J4** | Platform, Security & Integration | Kong, Keycloak, Prometheus, Grafana, CI/CD |

---

## Prerequisites

Before you begin, make sure you have the following installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (includes Docker Compose)
- [Git](https://git-scm.com/downloads)

You do **not** need Node.js, Python, or any other runtime installed locally — everything runs inside containers.

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/disaster-response-system.git
cd disaster-response-system
```

### 2. Start the platform

```bash
docker compose up -d
```

This starts the entire platform. The first run takes a few minutes while Docker pulls the base images and builds the application containers.

### 3. Verify everything is running

```bash
docker compose ps
```

All services should show `running`. If any service shows `exited`:

```bash
docker compose logs <service-name>
```

### 4. Stop the platform

```bash
docker compose down
```

To also delete all stored data (databases, Prometheus metrics, Grafana settings):

```bash
docker compose down -v
```

---

## Services at a Glance

Once `docker compose up -d` completes, the following are available:

| Service | URL | Credentials | Purpose |
|---|---|---|---|
| **J3 DMS Dashboard** | http://localhost:3000 | `admin@gmail.com` / `admin123` | Command centre for officers & resource managers |
| **J3 Event Bridge** | http://localhost:3001 | — | Socket.IO server — real-time Kafka→browser relay |
| **Kong API Gateway** | http://localhost:8000 | — | All API requests route through here |
| **Kong Admin API** | http://localhost:8001 | — | Configure routes, plugins, rate limits |
| **Keycloak** | http://localhost:8180 | `admin` / `admin123` | Authentication & identity management |
| **Grafana** | http://localhost:3030 | `admin` / `admin123` | System monitoring dashboards |
| **Prometheus** | http://localhost:9090 | — | Metrics collection & querying |
| **PostgreSQL** | `localhost:5432` | `disaster` / `disaster123` | Shared application database |
| **Kafka** | `localhost:9092` | — | Message broker (J1 sensors → J3 dashboard) |

Grafana loads a prebuilt dashboard automatically after startup:

- `Disaster Response System Overview` at `http://localhost:3000/d/drs-overview/disaster-response-system-overview`

> **Note:** Grafana runs on **port 3030** (not 3000) because J3's dashboard occupies port 3000.

> **Important:** The credentials above are for **local development only**. Never use these in a production environment.

---

## Architecture Overview

```
                         ┌────────────────────────────┐
                         │   Kong API Gateway :8000    │
                         │   (all HTTP traffic)        │
                         └───────────┬────────────────-┘
                                     │
          ┌──────────────────────────┼──────────────────────┐
          │                          │                       │
   ┌──────▼──────┐           ┌───────▼──────┐       ┌───────▼──────┐
   │  J1 :8081   │           │  J2 :8082    │       │  J3 :3000    │
   │  (future)   │           │  (future)    │       │  Next.js DMS │
   └──────┬──────┘           └───────┬──────┘       └──────────────┘
          │                          │
          └──────────┬───────────────┘
                     │  Kafka :9092
                     │  (j1.sos.raw-reports, j2.engine.risk-alerts, ...)
                     ▼
          ┌──────────────────┐         ┌───────────────────┐
          │  J3 Event Bridge │         │  Keycloak :8180   │
          │  :3001 (Socket.IO│         │  (JWT auth)       │
          └────────┬─────────┘         └───────────────────┘
                   │ WebSocket
                   ▼
          ┌──────────────────┐
          │  Browser         │
          │  (real-time map  │
          │   & alerts)      │
          └──────────────────┘
```

### Kafka Topics

| Topic | Producer | Consumer | Data |
|---|---|---|---|
| `j1.sos.raw-reports` | J1 | J3 Event Bridge | Mobile SOS alerts |
| `j1.sensor.telemetry` | J1 | J3 Event Bridge | IoT sensor readings |
| `j2.engine.risk-alerts` | J2 | J3 Event Bridge | Computed risk alerts |
| `j2.engine.incidents` | J2 | J3 Event Bridge | Confirmed incidents |
| `j3.dashboard.report-updates` | J3 | Downstream | Officer verification decisions |
| `j3.dashboard.resource-updates` | J3 | Downstream | Resource assignment changes |

### Database Layout

A single PostgreSQL instance hosts multiple databases:

| Database | Owner | Used by |
|---|---|---|
| `disasterdb` | `disaster` | J1 / J2 shared application data |
| `j3db` | `j3user` | J3 DMS (incidents, reports, resources) |
| `kong` | `kong` | Kong Gateway config |
| `keycloak` | `keycloak` | Keycloak user & realm data |

---

## How to Add Your Service

### Step 1 — Add your service to docker-compose.yml

Open the root `docker-compose.yml` and uncomment or add your service under the appropriate section comment. Use this template:

```yaml
  j2-data-intelligence:
    build: ./j2-data-intelligence
    container_name: j2-data-intelligence
    ports:
      - "8082:8082"
    environment:
      DB_HOST: postgres
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: ${POSTGRES_DB}
      KAFKA_BROKER: kafka:29092
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    networks:
      - disaster-net
```

**Important:** Always use `kafka:29092` (the internal listener) when connecting to Kafka from inside Docker. `localhost:9092` only works from the host machine.

### Step 2 — Register a route with Kong

Add your service registration to the `kong-setup` entrypoint in `docker-compose.yml`:

```bash
curl -sf -X POST http://kong:8001/services \
  --data 'name=j2-data-intelligence' \
  --data 'url=http://j2-data-intelligence:8082';

curl -sf -X POST http://kong:8001/services/j2-data-intelligence/routes \
  --data 'name=j2-route' \
  --data 'paths[]=/api/v1/intelligence' \
  --data 'strip_path=false';
```

After this, requests to `http://localhost:8000/api/v1/intelligence/...` will be forwarded to your container.

### Step 3 — Add a health check endpoint

Every service must expose:

```
GET /health  →  { "status": "ok" }
```

Kong uses this to confirm your service is available before routing traffic to it.

### Step 4 — Add a Prometheus scrape target (optional)

If your service exposes a `/metrics` endpoint, add a scrape job to `prometheus/prometheus.yml`:

```yaml
  - job_name: j2-data-intelligence
    static_configs:
      - targets: ['j2-data-intelligence:8082']
    metrics_path: /metrics
```

---

## API Conventions

### URL structure

```
/api/v1/{subgroup}/{resource}
```

| Subgroup | Base path | Example |
|---|---|---|
| J1 | `/api/v1/devices` | `/api/v1/devices/alerts` |
| J2 | `/api/v1/intelligence` | `/api/v1/intelligence/predictions` |
| J3 | `/api/v1/system` | `/api/v1/system/shelters` |

### Authentication

All endpoints (except `/health`) require a valid JWT issued by Keycloak:

```
Authorization: Bearer <token>
```

Get a token during local development:

```bash
curl -X POST http://localhost:8180/realms/disaster-response/protocol/openid-connect/token \
  -d "client_id=j3-frontend" \
  -d "username=<your-username>" \
  -d "password=<your-password>" \
  -d "grant_type=password"
```

### Standard response format

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": "A human-readable error message"
}
```

### HTTP status codes

| Status | When to use |
|---|---|
| `200 OK` | Successful read |
| `201 Created` | Resource successfully created |
| `400 Bad Request` | Invalid input from the client |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Valid token, insufficient role |
| `404 Not Found` | Resource does not exist |
| `500 Internal Server Error` | Something went wrong on the server |

---

## Contributing

### Branch naming

```
<subgroup>/<short-description>

Examples:
  j1/device-registration-api
  j2/alert-classification-model
  j3/shelter-map-component
  j4/add-rate-limiting-kong
```

### Workflow

1. Create a branch from `main` using the naming convention above
2. Make your changes
3. Open a pull request into `main`
4. At least one other team member must review and approve before merging
5. Direct pushes to `main` are disabled

### Commit messages

```
good:  add shelter capacity endpoint
good:  fix JWT token expiry handling
bad:   fixed stuff
bad:   WIP
```

---

## Questions or issues?

Contact the J4 team lead or open a GitHub Issue in this repository.

---

## Required repository / organization secrets

Add the following secrets in your GitHub repository settings (or as organization-level secrets) so the CI/CD workflows run correctly:

- **DOCKERHUB_USERNAME**: Docker Hub account username. Used by `.github/workflows/cd.yml` for logging into Docker Hub.
- **DOCKERHUB_TOKEN**: Docker Hub access token (recommended: a fine-grained or personal access token). Used by `.github/workflows/cd.yml`.
- **ARGOCD_REPO_TOKEN**: Token used to push updated Kubernetes manifests back to the repo. Used by `.github/workflows/cd.yml`.
- **ALERTMANAGER_EMAIL_PASSWORD**: SMTP/password value injected into Alertmanager config. Used by `.github/workflows/ci.yml` and `j4-platform-security/alertmanager/alertmanager.yml`.

Optional (only if your workflows require cluster access):

- **KUBECONFIG_DATA**: Base64-encoded kubeconfig contents for workflows that need to talk to a cluster.

How to add a secret using the GitHub CLI (example):

```bash
gh secret set DOCKERHUB_TOKEN --body "$DOCKERHUB_TOKEN" --repo <owner>/<repo>
```

Prefer creating these as Organization secrets if multiple repos need the same values.
