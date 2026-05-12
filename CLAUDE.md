# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Platform (all services via Docker)
```bash
docker compose up -d          # Start Kong, Keycloak, Postgres, Vault, Prometheus, Grafana
docker compose ps             # Verify all containers are running
docker compose logs <service> # Debug a failing service
docker compose down           # Stop
docker compose down -v        # Stop and delete all data
```

### J3 Frontend (Next.js) — from `j3-system-interaction/`
```bash
docker compose up --build     # Start Kafka + DMS frontend + event bridge in containers

# Or for local development from j3-system-interaction/dms/:
npm run dev                   # Dev server on :3000
npm run build                 # Production build
npm run lint                  # ESLint
```

### J3 Real-time services (run in separate terminals from `j3-system-interaction/dms/`)
```bash
node mock-producer.js         # Feed synthetic events into Kafka (for local testing)
node event-bridge.js          # Bridge Kafka → Socket.IO → frontend
```

### J2 ML — Python scripts (from `j2-data-intelligence/`)
```bash
python "Model Training and Validation/Scripts/train_disaster_models.py"
python app/tests/test_consideration_score.py
```

## Local Services

| Service | URL | Credentials |
|---|---|---|
| Kong API Gateway | http://localhost:8000 | — |
| Kong Admin API | http://localhost:8001 | — |
| Keycloak | http://localhost:8180 | `admin` / `admin123` |
| Grafana | http://localhost:3000 | `admin` / `admin123` |
| Prometheus | http://localhost:9090 | — |
| PostgreSQL | `localhost:5432` | `disaster` / `disaster123` |

## Architecture

This is a real-time disaster management platform for Sri Lanka, split into four independently developed subgroups:

- **J1 `j1-device-edge/`** — IoT sensors, edge devices, mobile SOS app; produces Kafka events
- **J2 `j2-data-intelligence/`** — Python ML/AI backend; flood/landslide risk prediction, consideration scoring, data pipelines
- **J3 `j3-system-interaction/`** — Next.js 16 command center dashboard; consumes Kafka events via Socket.IO
- **J4 `j4-platform-security/`** — Kong API Gateway, Keycloak auth, HashiCorp Vault, Prometheus/Grafana, K8s manifests

### Event flow
```
J1 sensors / SOS → Kafka → event-bridge.js → Socket.IO → J3 Next.js dashboard
                         → J2 ML models → risk predictions
```

All external traffic enters through **Kong** at `:8000`. Services register themselves with Kong Admin at `:8001`. **Keycloak** issues JWTs; every endpoint except `GET /health` requires `Authorization: Bearer <token>`.

### J3 Frontend (`j3-system-interaction/dms/`)

Next.js App Router with two main areas:
- `app/` — public landing page and protected dashboard under `app/dashboard/`
- `app/api/` — API routes (auth, dashboard, incidents, resources)
- `context/` — `AuthContext` (Keycloak JWT state) and `SocketContext` (Socket.IO live updates)
- `prisma/schema.prisma` — canonical data models: `User`, `IncomingReport`, `ConfirmedIncident`, `Resource`, `Alert`

Key roles in the schema: `PUBLIC_USER`, `OFFICER`, `RESOURCE_MANAGER`, `ADMIN`.

### J2 ML (`j2-data-intelligence/`)

- `Model Training and Validation/Scripts/` — training scripts for flood/landslide/drought classifiers producing four-class predictions: `Normal`, `Moderate`, `Severe`, `Extreme`
- `app/utils/consideration_score.py` — computes a per-division priority score combining dominant-class probability, class severity multiplier, and normalised population via logistic scaling
- `app/tests/test_consideration_score.py` — unit tests for the consideration score logic
- `app/services/resource_allocation_agent.py` — Gemini-powered agent that reads division resources from the CSV, queries `DisasterRisk` and `ConsiderationScore` from the DB, then calls `gemini-2.0-flash` to produce a prioritised resource allocation plan
- Endpoint: `POST /api/v1/intelligence/agent/allocate` — body: `{ "admin_decisions": "...", "target_date": "YYYY-MM-DD" (optional) }`
- Requires `GEMINI_API_KEY` env var

## API Conventions

URL structure: `/api/v1/{subgroup}/{resource}`

| Subgroup | Base path |
|---|---|
| J1 | `/api/v1/devices` |
| J2 | `/api/v1/intelligence` |
| J3 | `/api/v1/system` |

Standard response envelope:
```json
{ "success": true, "data": {}, "error": null }
```

Every service must expose `GET /health` returning `{ "status": "ok" }`.

## Contributing

Branch naming: `<subgroup>/<short-description>` (e.g., `j2/risk-score-api`, `j3/shelter-map-component`).

Direct pushes to `main` are disabled; PRs require at least one review.
