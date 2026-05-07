# Containerization Implementation Plan — J1 & J2 Services

**Project:** Disaster Response System  
**Scope:** Containerize J1 (Device & Edge) and J2 (Data & Intelligence), update docker-compose, and extend Kubernetes cluster manifests  
**Total Timeline:** 15 working days

---

## Context & Current State

| Component | Docker | docker-compose | Kubernetes |
|---|---|---|---|
| J1 Device & Edge | None (firmware only) | None | None |
| J2 Data & Intelligence | Dockerfile exists | Entry exists | **Missing** |
| J3 System Interaction | Dockerfiles exist | Entries exist | Manifests exist |
| J4 Platform Security | Dockerfiles exist | Entries exist | Manifests exist |

**Critical constraint:** J1 (`j1-device-edge/`) is embedded firmware for ESP32 microcontrollers — it cannot run inside a container. To containerize J1's role in the system, a **J1 Bridge Service** must be created: a Python FastAPI microservice that simulates/bridges J1 device behaviour (MQTT → Kafka forwarding, device management REST API on port 8081 as expected by Kong).

---

## Milestone 1 — Assessment & Architecture Design
**Duration:** Days 1–2  
**Goal:** Finalize architecture decisions, establish contracts between J1 bridge and the rest of the system.

### Tasks

1. **Audit J1 firmware behaviour**
   - Read `j1-device-edge/Central_Node/src/central_node.cpp` and sensor node `main.cpp` files
   - Document exact MQTT topic structure and JSON payloads published by Central Node
   - Map MQTT topics → Kafka topics (`j1.sos.raw-reports`, `j1.sensor.telemetry`)

2. **Define J1 Bridge Service contract**
   - REST API on port `8081` (expected by Kong gateway at `/api/v1/device`)
   - MQTT subscriber: listens to HiveMQ cloud (or local MQTT broker in dev)
   - Kafka producer: forwards MQTT messages to `j1.sos.raw-reports` and `j1.sensor.telemetry`
   - Simulator mode: when no physical hardware is present, publish synthetic payloads on a configurable interval

3. **Review J2 Dockerfile**
   - Evaluate existing `j2-data-intelligence/Dockerfile` for security (non-root user, pinned base image)
   - Identify missing health check instruction (`HEALTHCHECK`)
   - Confirm port `8082` and `uvicorn` command are correct

4. **Design Kubernetes manifest structure**
   ```
   k8s/
   ├── j1/
   │   ├── configmap.yaml
   │   ├── deployment.yaml
   │   └── service.yaml
   └── j2/
       ├── deployment.yaml
       └── service.yaml
   ```

5. **Update `k8s/secrets.yaml`** — add J1 MQTT credentials (broker URL, username, password) and verify J2 `DATABASE_URL` and `KAFKA_BROKER` entries are present.

### Deliverables
- Architecture decision record (ADR) notes in this document (update section below)
- Updated `k8s/secrets.yaml` with J1 MQTT credential keys
- Confirmed payload schemas for Kafka topics

---

## Milestone 2 — J1 Bridge Service & Dockerfile
**Duration:** Days 3–6  
**Goal:** Create a containerizable Python service that represents J1 in the system, with a production-ready Dockerfile.

### Tasks

1. **Create J1 bridge service** at `j1-device-edge/bridge/`
   ```
   j1-device-edge/bridge/
   ├── Dockerfile
   ├── requirements.txt
   └── app/
       ├── main.py          # FastAPI entry point, port 8081
       ├── mqtt_subscriber.py   # HiveMQ MQTT listener
       ├── kafka_producer.py    # Forwards events to Kafka
       ├── simulator.py         # Synthetic payload generator (dev mode)
       └── models.py            # Pydantic schemas for device payloads
   ```

2. **Write `requirements.txt`**
   - `fastapi`, `uvicorn` — REST API
   - `paho-mqtt` — MQTT client (compatible with HiveMQ TLS)
   - `confluent-kafka` — Kafka producer
   - `pydantic`, `python-dotenv`, `APScheduler`

3. **Write `Dockerfile`** for J1 bridge
   ```dockerfile
   FROM python:3.11-slim
   # Non-root user for security
   RUN useradd -m -u 1000 appuser
   WORKDIR /app
   RUN apt-get update && apt-get install -y --no-install-recommends \
       librdkafka-dev && rm -rf /var/lib/apt/lists/*
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY app/ ./app/
   USER appuser
   EXPOSE 8081
   HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
       CMD curl -f http://localhost:8081/api/v1/health || exit 1
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
   ```

4. **Implement simulator mode**
   - Env var `J1_SIMULATOR_MODE=true` enables APScheduler to publish synthetic sensor payloads every 30 seconds
   - Flood node simulation: random `rain_sum`, `water_level`
   - Landslide node simulation: random `acceleration_x/y/z`, `gyro_x/y/z`

5. **Add `j1-device-edge/bridge/` to `docker-compose.yml`**
   ```yaml
   j1-device-bridge:
     build: ./j1-device-edge/bridge
     container_name: j1-device-bridge
     ports:
       - "8081:8081"
     environment:
       MQTT_BROKER_URL: ${MQTT_BROKER_URL}
       MQTT_USERNAME: ${MQTT_USERNAME}
       MQTT_PASSWORD: ${MQTT_PASSWORD}
       KAFKA_BROKER: kafka:29092
       J1_SIMULATOR_MODE: "true"
     depends_on:
       kafka:
         condition: service_started
     networks:
       - disaster-net
   ```

6. **Test locally**
   - `docker compose up j1-device-bridge`
   - Verify `/api/v1/health` returns 200
   - Verify Kafka topic `j1.sensor.telemetry` receives synthetic messages (use `kafka-console-consumer`)

### Deliverables
- `j1-device-edge/bridge/` directory with full service implementation
- `j1-device-edge/bridge/Dockerfile`
- Updated `docker-compose.yml` with J1 bridge entry
- Passing `docker compose up` with J1 producing to Kafka

---

## Milestone 3 — J2 Dockerfile Hardening & docker-compose Verification
**Duration:** Days 7–9  
**Goal:** Bring the existing J2 Dockerfile up to production standards and confirm the docker-compose stack works end-to-end with J1 + J2.

### Tasks

1. **Harden `j2-data-intelligence/Dockerfile`**
   - Add non-root user (currently missing)
   - Add `HEALTHCHECK` instruction
   - Pin `python:3.11-slim` with a digest or explicit patch version
   - Use multi-stage build to separate build deps from runtime image:
     ```dockerfile
     # Stage 1: build
     FROM python:3.11-slim AS builder
     WORKDIR /build
     RUN apt-get update && apt-get install -y --no-install-recommends \
         build-essential librdkafka-dev libpq-dev && rm -rf /var/lib/apt/lists/*
     COPY requirements.txt .
     RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

     # Stage 2: runtime
     FROM python:3.11-slim AS runtime
     RUN apt-get update && apt-get install -y --no-install-recommends \
         librdkafka1 libpq5 curl && rm -rf /var/lib/apt/lists/*
     RUN useradd -m -u 1000 appuser
     WORKDIR /app
     COPY --from=builder /install /usr/local
     COPY app/ ./app/
     USER appuser
     EXPOSE 8082
     HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
         CMD curl -f http://localhost:8082/api/v1/health || exit 1
     CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]
     ```

2. **Update `docker-compose.yml` J2 entry**
   - Add `healthcheck` block matching the `HEALTHCHECK` in the Dockerfile
   - Add `j1-device-bridge` as a soft dependency (optional, for ordering)

3. **Add `.env.example` entries** for J1 MQTT variables
   ```
   MQTT_BROKER_URL=ssl://your-hive-broker.hivemq.cloud:8883
   MQTT_USERNAME=j1_gateway
   MQTT_PASSWORD=
   ```

4. **Full stack smoke test**
   - `docker compose up --build`
   - Confirm all services reach healthy state: postgres, kafka, j1-device-bridge, j2-data-intelligence, j3-dms, j3-event-bridge, j4-audit-api
   - Hit `POST /api/v1/engine/trigger` via Kong proxy (`http://localhost:8000/api/v1/engine/trigger`) and confirm predictions are stored
   - Verify Grafana dashboard shows J2 metrics

5. **Register J1 bridge route in Kong**
   - Update `j4-platform-security/kong/setup.sh` (or equivalent) to add:
     - Service: `j1-bridge` → `http://j1-device-bridge:8081`
     - Route: `/api/v1/device` → `j1-bridge` service

### Deliverables
- Updated `j2-data-intelligence/Dockerfile` (multi-stage, non-root, health check)
- Updated `.env.example` with J1 MQTT keys
- Kong routing configured for J1 at `/api/v1/device`
- Full `docker compose up` succeeds with all services healthy

---

## Milestone 4 — Kubernetes Manifests for J1 & J2
**Duration:** Days 10–13  
**Goal:** Create all Kubernetes manifests for J1 and J2, update `setup.sh`, and verify deployment on minikube.

### Tasks

1. **Create `k8s/j1/configmap.yaml`**
   ```yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: j1-bridge-config
     namespace: disaster-response
   data:
     J1_SIMULATOR_MODE: "true"
     KAFKA_BROKER: "kafka:29092"
   ```

2. **Create `k8s/j1/deployment.yaml`**
   - Image: `j1-device-bridge:latest` (`imagePullPolicy: Never` for minikube)
   - 1 replica (stateless service)
   - `initContainer` using `busybox` to wait for `kafka:29092`
   - `envFrom` the J1 ConfigMap + `disaster-secrets` Secret for MQTT credentials
   - `readinessProbe`: HTTP GET `/api/v1/health` on port 8081
   - `livenessProbe`: same endpoint, longer `initialDelaySeconds`
   - Resource limits: `cpu: 250m`, `memory: 256Mi`

3. **Create `k8s/j1/service.yaml`**
   - `ClusterIP` service (internal only) on port 8081
   - Kong accesses J1 at `j1-device-bridge.disaster-response.svc.cluster.local:8081`

4. **Create `k8s/j2/deployment.yaml`**
   - Image: `j2-data-intelligence:latest` (`imagePullPolicy: Never`)
   - 1 replica
   - `initContainer`: wait for `postgres:5432` and `kafka:29092`
   - `envFrom` `disaster-secrets` for `DATABASE_URL`, plus inline `KAFKA_BROKER: kafka:29092`
   - `readinessProbe`: HTTP GET `/api/v1/health` on port 8082
   - `livenessProbe`: same
   - Resource limits: `cpu: 500m`, `memory: 512Mi` (heavier due to ML libraries)

5. **Create `k8s/j2/service.yaml`**
   - `ClusterIP` on port 8082
   - Accessed by Kong at `j2-data-intelligence.disaster-response.svc.cluster.local:8082`

6. **Update `k8s/secrets.yaml`**
   - Add: `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`
   - Verify: `DATABASE_URL` covers the J2 connection string

7. **Update `k8s/setup.sh`**
   - Build J1 bridge image into minikube daemon: `docker build -t j1-device-bridge:latest ./j1-device-edge/bridge`
   - Build J2 image into minikube daemon: `docker build -t j2-data-intelligence:latest ./j2-data-intelligence`
   - Apply new manifests:
     ```bash
     kubectl apply -f k8s/j1/
     kubectl apply -f k8s/j2/
     ```
   - Add `kubectl rollout status` checks for both deployments

8. **Update Kong manifest (`k8s/gateway/kong.yaml`)** to register J1 and J2 services and routes via the `kong-setup` init job

9. **Verify on minikube**
   ```bash
   ./k8s/setup.sh
   kubectl get pods -n disaster-response
   kubectl logs -n disaster-response -l app=j1-device-bridge
   kubectl logs -n disaster-response -l app=j2-data-intelligence
   ```

### Deliverables
- `k8s/j1/configmap.yaml`, `k8s/j1/deployment.yaml`, `k8s/j1/service.yaml`
- `k8s/j2/deployment.yaml`, `k8s/j2/service.yaml`
- Updated `k8s/secrets.yaml`, `k8s/setup.sh`, `k8s/gateway/kong.yaml`
- All pods running on minikube with `Running` status

---

## Milestone 5 — Integration Testing, Monitoring & CI/CD
**Duration:** Days 14–15  
**Goal:** End-to-end validation of the fully containerized system, Prometheus scraping, and optional CI pipeline updates.

### Tasks

1. **End-to-end integration test**
   - Trigger J1 simulator → Kafka `j1.sensor.telemetry`
   - Trigger J2 engine: `POST /api/v1/engine/trigger` via Kong (with Keycloak JWT)
   - Verify predictions stored in `disasterdb.predictions`
   - Verify J3 event-bridge receives `j2.engine.risk-alerts` and emits Socket.IO event
   - Verify J3 DMS dashboard updates in browser

2. **Prometheus scraping**
   - Confirm J2 exposes `/metrics` endpoint (add `prometheus-fastapi-instrumentator` to J2 requirements if not present)
   - Add J1 bridge metrics endpoint
   - Update `prometheus/prometheus.yml` with J1 and J2 scrape targets
   - Update `k8s/monitoring/configmaps.yaml` with same targets
   - Verify metrics appear in Grafana

3. **Kubernetes liveness / readiness tuning**
   - Under load test, verify `readinessProbe` correctly gates traffic during J2 cold start (model loading takes ~20s)
   - Adjust `initialDelaySeconds` and `failureThreshold` as needed

4. **Kong JWT plugin validation**
   - Ensure J1 `/api/v1/device` and J2 `/api/v1/engine` routes require valid Keycloak JWT
   - Test with expired token → expect 401
   - Test with valid token → expect 200

5. **Update README.md**
   - Add J1 Bridge Service to architecture diagram
   - Add J2 to Kubernetes deployment table
   - Document `J1_SIMULATOR_MODE` env var
   - Document how to build and deploy J1/J2 on minikube (`./k8s/setup.sh`)

6. **Optional: CI/CD pipeline**
   - If GitHub Actions exists, add jobs to:
     - Build J1 bridge Docker image on push to `j1-device-edge/**`
     - Build J2 Docker image on push to `j2-data-intelligence/**`
     - Run `docker compose up --build --detach` smoke test
     - Tear down after test

### Deliverables
- Passing end-to-end test across J1 → Kafka → J2 → Kafka → J3 → dashboard
- Prometheus scraping J1 and J2 metrics
- Kong JWT protection verified for J1 and J2 routes
- Updated README.md with J1/J2 containerization details
- (Optional) CI workflow files under `.github/workflows/`

---

## Architecture Decision Record

### ADR-001: J1 Bridge Service instead of containerizing firmware
**Status:** Accepted  
**Decision:** The J1 codebase (`j1-device-edge/`) compiles to ESP32 firmware and cannot run in a Linux container. A Python bridge service will be created that (a) in production mode subscribes to the HiveMQ MQTT broker and forwards messages to Kafka, and (b) in simulator mode generates synthetic payloads when physical hardware is not present.  
**Consequence:** Physical J1 ESP32 nodes still run firmware as-is. The bridge service represents J1 in the software stack and is the component registered with Kong as the J1 Device API.

### ADR-002: Multi-stage Docker build for J2
**Status:** Accepted  
**Decision:** Split the J2 build into a `builder` stage (includes `build-essential`, `librdkafka-dev`, `libpq-dev`) and a `runtime` stage (only shared libraries, no compilers). This reduces the final image size significantly.  
**Consequence:** Slightly more complex Dockerfile; build time unchanged.

### ADR-003: Non-root users in all new Dockerfiles
**Status:** Accepted  
**Decision:** Both J1 bridge and J2 Dockerfiles must create and switch to a non-root user (`appuser`, UID 1000) before the `CMD` instruction.  
**Consequence:** Services cannot bind to ports < 1024 (not needed here).

---

## File Change Summary

| File | Action |
|---|---|
| `j1-device-edge/bridge/Dockerfile` | **Create** |
| `j1-device-edge/bridge/requirements.txt` | **Create** |
| `j1-device-edge/bridge/app/main.py` | **Create** |
| `j1-device-edge/bridge/app/mqtt_subscriber.py` | **Create** |
| `j1-device-edge/bridge/app/kafka_producer.py` | **Create** |
| `j1-device-edge/bridge/app/simulator.py` | **Create** |
| `j1-device-edge/bridge/app/models.py` | **Create** |
| `j2-data-intelligence/Dockerfile` | **Update** (multi-stage, non-root, healthcheck) |
| `docker-compose.yml` | **Update** (add J1 bridge entry, harden J2 entry) |
| `.env.example` | **Update** (add MQTT vars) |
| `k8s/j1/configmap.yaml` | **Create** |
| `k8s/j1/deployment.yaml` | **Create** |
| `k8s/j1/service.yaml` | **Create** |
| `k8s/j2/deployment.yaml` | **Create** |
| `k8s/j2/service.yaml` | **Create** |
| `k8s/secrets.yaml` | **Update** (add MQTT credential keys) |
| `k8s/setup.sh` | **Update** (build + apply J1/J2) |
| `k8s/gateway/kong.yaml` | **Update** (add J1/J2 routes) |
| `prometheus/prometheus.yml` | **Update** (add J1/J2 scrape targets) |
| `k8s/monitoring/configmaps.yaml` | **Update** (add J1/J2 scrape targets) |
| `README.md` | **Update** (architecture, deployment docs) |
