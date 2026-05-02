# 🚨 Disaster Response System — Group J

A distributed disaster response platform built by a team of 20, organised into four subgroups across device & edge systems, data & intelligence, system engineering & interaction, and platform security & integration.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Subgroups](#subgroups)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Services at a Glance](#services-at-a-glance)
- [How to Add Your Service](#how-to-add-your-service)
- [API Conventions](#api-conventions)
- [Contributing](#contributing)

---

## Project Structure

```
disaster-response-system/
├── j1-device-edge/          # J1 — Device & Edge Systems
├── j2-data-intelligence/    # J2 — Data & Intelligence
├── j3-system-interaction/   # J3 — System Engineering & Interaction
├── j4-platform-security/    # J4 — Platform, Security & Integration
├── k8s/                     # Kubernetes manifests (managed by J4)
├── docker-compose.yml       # Local dev environment — start here
└── README.md
```

---

## Subgroups

| Subgroup | Focus | Key Technologies |
|---|---|---|
| **J1** | Device & Edge Systems | IoT, Edge computing, Device APIs |
| **J2** | Data & Intelligence | AI/ML pipelines, Data processing |
| **J3** | System Engineering & Interaction | Frontend, System interfaces |
| **J4** | Platform, Security & Integration | Docker, Kubernetes, Kong, Keycloak, Vault, CI/CD, Observability, Blockchain |

---

## Prerequisites

Before you begin, make sure you have the following installed on your machine:

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (includes Docker Compose)
- [Git](https://git-scm.com/downloads)

That's it. You do **not** need Node.js, Python, or any other runtime installed locally — everything runs inside containers.

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

This single command starts the entire platform: the API gateway, authentication server, database, and observability stack. The first run will take a few minutes while Docker pulls the images.

### 3. Verify everything is running

```bash
docker compose ps
```

All services should show a status of `running`. If any service shows `exited`, run `docker compose logs <service-name>` to see what went wrong.

### 4. Stop the platform

```bash
docker compose down
```

To also delete all stored data (database contents, etc.):

```bash
docker compose down -v
```

---

## Services at a Glance

Once `docker compose up -d` completes, the following are available:

| Service | URL | Credentials | Purpose |
|---|---|---|---|
| **Kong API Gateway** | http://localhost:8000 | — | All API requests go through here |
| **Kong Admin API** | http://localhost:8001 | — | Configure routes, plugins, rate limits |
| **Keycloak** | http://localhost:8180 | `admin` / `admin123` | Authentication & identity management |
| **Grafana** | http://localhost:3000 | `admin` / `admin123` | System monitoring dashboards |
| **Prometheus** | http://localhost:9090 | — | Metrics collection & querying |
| **PostgreSQL** | `localhost:5432` | `disaster` / `disaster123` | Shared application database (dev only) |

Grafana loads a prebuilt dashboard automatically after startup:

- `Disaster Response System Overview` at `http://localhost:3000/d/drs-overview/disaster-response-system-overview`

> ⚠️ **Important:** The credentials above are for **local development only**. Never use these in a production environment.

---

## How to Add Your Service

Each subgroup adds their own services to the shared `docker-compose.yml`. Follow these steps:

### Step 1 — Add your service block

Open `docker-compose.yml` and add your service under the appropriate section comment. Example for a J2 service:

```yaml
  j2-ai-processor:
    build: ./j2-data-intelligence
    ports:
      - "8082:8082"
    environment:
      DB_HOST: postgres
      DB_USER: disaster
      DB_PASSWORD: disaster123
      DB_NAME: disasterdb
    depends_on:
      - postgres
```

### Step 2 — Register a route with Kong

Once your container is running, register it with Kong so requests can reach it through the gateway. Run these two commands (replace values as needed):

```bash
# Register your service
curl -X POST http://localhost:8001/services \
  --data "name=j2-ai-processor" \
  --data "url=http://j2-ai-processor:8082"

# Create a route to it
curl -X POST http://localhost:8001/services/j2-ai-processor/routes \
  --data "paths[]=/api/v1/intelligence" \
  --data "name=j2-intelligence-route"
```

After this, requests to `http://localhost:8000/api/v1/intelligence/...` will be forwarded to your service automatically.

### Step 3 — Add a health check endpoint

Every service must expose a `GET /health` endpoint that returns:

```json
{ "status": "ok" }
```

Kong uses this to check whether your service is available. Without it, Kong may route requests to a service that isn't ready yet.

---

## API Conventions

All teams follow these conventions so routes, authentication, and response formats are consistent across the system.

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

All endpoints (except `/health`) require a valid JWT token issued by Keycloak, sent in the `Authorization` header:

```
Authorization: Bearer <token>
```

To get a token during local development:

```bash
curl -X POST http://localhost:8180/realms/disaster-response/protocol/openid-connect/token \
  -d "client_id=j3-frontend" \
  -d "username=<your-username>" \
  -d "password=<your-password>" \
  -d "grant_type=password"
```

### Standard response format

All API responses must follow this structure:

```json
{
  "success": true,
  "data": { },
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
| `403 Forbidden` | Valid token, but insufficient role |
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

Keep commit messages short and descriptive:

```
good:  add shelter capacity endpoint
good:  fix JWT token expiry handling
bad:   fixed stuff
bad:   WIP
```

---

## Questions or issues?

Contact the J4 team lead or open a GitHub Issue in this repository.