# Disaster Response System — Docker Implementation Plan

> **Reconnaissance summary** — 8 application services across 4 subdomains, 15+ infrastructure
> containers, one shared PostgreSQL cluster, one Kafka broker (KRaft), Kong API gateway,
> Keycloak IdP, HashiCorp Vault, ELK stack, and a Prometheus/Grafana/Alertmanager monitoring
> stack. All live in a single `disaster-net` bridge network. All bespoke services currently run
> as root; none have pinned base-image versions; three Dockerfiles lack multi-stage builds;
> `apache/kafka:latest` and several exporter images use floating tags; six hardcoded secrets
> appear in `docker-compose.yml`; twelve `depends_on` entries use `service_started` where a
> health gate is required; j3-dms has no `DATABASE_URL` wired in compose; the SQLite local
> alerts file has no persistent volume; and j1-bridge-api is commented out of the root compose
> entirely.

---

## Inter-service communication map (reference for all milestones)

| Consumer | Depends on | Port / Protocol |
|---|---|---|
| `mqtt-kafka-bridge` | Kafka | 29092 TCP (internal listener) |
| `j1-bridge-api` | Kafka | 29092 TCP |
| `j2-data-intelligence` | Kafka, PostgreSQL | 29092 TCP, 5432 TCP |
| `j3-event-bridge` | Kafka | 29092 TCP |
| `j3-dms` | PostgreSQL (`j3db`), Kafka, `j3-event-bridge` (Socket.IO), `j4-audit-api` | 5432, 29092, 3001, 8084 |
| `keycloak` | PostgreSQL (`keycloak` DB) | 5432 TCP |
| `kong` | PostgreSQL (`kong` DB), `keycloak` (JWT JWKS) | 5432 TCP, 8080 HTTP |
| `kong-migration` | PostgreSQL | 5432 TCP |
| `kong-setup` | `kong` Admin API, `keycloak` | 8001 HTTP, 8080 HTTP |
| `vault-setup` | `vault` | 8200 HTTP |
| `keycloak-setup` | `keycloak`, `vault` | 8080 HTTP, 8200 HTTP |
| `j4-audit-api` | `hardhat-node` (Ethereum RPC), `audit-deployment` volume | 8545 HTTP |
| `deploy-audit-contract` | `hardhat-node`, `audit-deployment` volume | 8545 HTTP |
| `logstash` | `elasticsearch` | 9200 HTTP |
| `kibana` | `elasticsearch` | 9200 HTTP |
| `filebeat` | `logstash` | 5044 TCP |
| `prometheus` | `alertmanager`, Docker socket (service-discovery) | 9093 HTTP, UNIX socket |
| `grafana` | `prometheus` | 9090 HTTP |
| `postgres-exporter` | PostgreSQL | 5432 TCP |
| `kafka-exporter` | Kafka | 29092 TCP |

---

## Milestone 1.1 — Base image strategy: `mqtt-kafka-bridge`

**Goal:** Choose the smallest correct base and decide whether a multi-stage build is warranted.

**Analysis:** `paho-mqtt==1.6.1` and `kafka-python==2.0.2` are pure-Python wheels — no C
extension compilation is required. `pip install` produces only `.py` files and metadata; there is
nothing to strip from a build stage. A single-stage Debian slim image is therefore the correct
choice: layer-efficient (deps before code), non-root user at runtime.

**Base image:** `python:3.11.12-slim-bookworm`

**Build strategy:** Single stage. Layer order: base → create user → copy
`requirements.txt` → `pip install` → copy `bridge.py` → switch to non-root.

**Acceptance criteria:** Decision is recorded here; Dockerfile is written in Milestone 2.1.

**Blockers:** None.

---

## Milestone 1.2 — Base image strategy: `j1-bridge-api`

**Goal:** Choose the correct base and determine multi-stage split for the FastAPI bridge.

**Analysis:** `confluent-kafka==2.5.0` links against `librdkafka`, which requires `gcc` and
`librdkafka-dev` at compile time and `librdkafka1` at runtime. The headers and compiler must not
appear in the final image. A two-stage build is mandatory.

**Base image:** `python:3.12.10-slim-bookworm` for both builder and runtime stages.

**Build strategy:**
- **builder** — installs `gcc librdkafka-dev`, runs `pip install --prefix=/install`
- **runtime** — installs `librdkafka1 curl`, copies `/install` from builder, copies `app/`, sets non-root user

**Acceptance criteria:** Decision recorded; Dockerfile written in Milestone 2.2.

**Blockers:** None.

---

## Milestone 1.3 — Base image strategy: `j2-data-intelligence`

**Goal:** Validate and improve the existing two-stage Dockerfile.

**Analysis:** The existing file already uses two stages. The issues are: unpinned
`python:3.11-slim` (floating minor), no explicit non-root user creation in the runtime stage
(current: `RUN useradd -m -u 1000 appuser` — this IS present, good), and `psycopg2-binary`
is used which embeds its own `libpq`, so `libpq5` in the runtime stage is unnecessary and
can be removed. `libgomp1` is required at runtime for XGBoost/LightGBM OpenMP calls. `curl`
is needed for the HEALTHCHECK. The `.pkl` model files live inside `app/models/` and are covered
by `COPY app/ ./app/`.

**Base image:** `python:3.11.12-slim-bookworm` for both stages.

**Build strategy:** Two stages, keeping the existing structure but pinning the version and
removing the now-redundant `libpq5` from the runtime stage.

**Acceptance criteria:** Decision recorded; Dockerfile written in Milestone 2.3.

**Blockers:** None.

---

## Milestone 1.4 — Base image strategy: `j3-event-bridge`

**Goal:** Choose the correct base for the Node.js Kafka→Socket.IO relay.

**Analysis:** `event-bridge.js` is a single CommonJS file. `kafkajs` and `socket.io` are pure
JavaScript packages — no native addons. `npm ci --omit=dev` installs only runtime dependencies.
There is no compilation step. Single-stage alpine is correct; no multi-stage needed.

**Base image:** `node:20.19.2-alpine3.21`

**Build strategy:** Single stage. Layer order: base → create non-root user → copy manifests →
`npm ci --omit=dev` → copy `event-bridge.js` → switch user.

**Note on the existing `Dockerfile.mock` name:** The file is named `Dockerfile.mock` but builds
a production-worthy runtime process. The name should stay as-is since the root `docker-compose.yml`
references it explicitly; do not rename without updating the compose reference.

**Acceptance criteria:** Decision recorded; Dockerfile written in Milestone 2.4.

**Blockers:** None.

---

## Milestone 1.5 — Base image strategy: `j3-dms`

**Goal:** Determine the correct three-stage strategy for the Next.js 16 standalone dashboard.

**Analysis:** Next.js requires Node at build time (Webpack bundler) and Node at runtime
(standalone server.js). The `next.config.ts` sets `output: "standalone"`, which copies only
the minimal server and required modules into `.next/standalone`. Prisma generates a compiled
client from `prisma/schema.prisma` at build time; the generated code ships in the standalone
bundle. SQLite (`sqlite3` package) requires a native build with `node-gyp` + `python3`; these
are present in the node alpine image (`apk add python3 make g++` is implicitly handled by
`npm ci`). None of these build tools should appear in the runtime stage.

**Base image:** `node:20.19.2-alpine3.21` for all three stages.

**Build strategy:**
- **deps** — installs all dependencies including devDeps (needed for `prisma generate` and `next build`)
- **builder** — generates Prisma client, runs `next build` (standalone output)
- **runner** — copies only `.next/standalone`, `.next/static`, and `public/`; creates `/app/data` for SQLite; runs as non-root

**Note on SQLite persistence:** `lib/db.ts` uses `path.resolve(process.cwd(), 'local_alerts.db')`
which resolves to `/app/local_alerts.db` in the container. This path will be lost on container
restart. Milestone 2.5 includes a one-line patch to change this to `/app/data/local_alerts.db`
so a named volume can be mounted at `/app/data`.

**Acceptance criteria:** Decision recorded; Dockerfile + code patch written in Milestone 2.5.

**Blockers:** None.

---

## Milestone 1.6 — Base image strategy: `j4-audit-api`

**Goal:** Validate and fix the existing two-stage TypeScript API Dockerfile.

**Analysis:** The existing Dockerfile already uses two stages: builder compiles TypeScript
(`tsc -p tsconfig.build.json`) and the runtime stage re-runs `npm ci --omit=dev`. The ABI JSON
file (`src/blockchain/IncidentAuditLog.json`) is copied into `dist/blockchain/` in the builder
— this is correct since the runtime reads it from disk. The runtime stage reinstalls
`node_modules` from scratch (correct for reproducibility) but runs as root. The `npm start`
command calls `node dist/server.js` directly; `wget` is needed for the healthcheck.

**Base image:** `node:22.16.0-alpine3.21` for both stages.

**Build strategy:** Two stages unchanged in structure; add non-root user in runtime stage.

**Acceptance criteria:** Decision recorded; Dockerfile written in Milestone 2.6.

**Blockers:** None.

---

## Milestone 1.7 — Base image strategy: `hardhat-node`

**Goal:** Replace the current compose inline `node:22-alpine` + volume-mount approach with a
proper Dockerfile.

**Analysis:** The current compose mounts `./j4-platform-security/blockchain-audit:/app` as a
bind mount and runs `npm ci && npx hardhat node` as the container command. This is a development
anti-pattern — source code mutability at runtime, `npm ci` on every container start, no
non-root user. The `Dockerfile.hardhat` exists but is unused by compose.

Hardhat v3 compiles Solidity contracts to `artifacts/` and `cache/` at startup if they are stale.
Pre-compiling during the image build (via `RUN npx hardhat compile`) lets the runtime container
start the node immediately without recompilation and avoids the need to write to those dirs at
startup.

**Base image:** `node:22.16.0-alpine3.21` (single stage; hardhat is a dev tool — no need for a
stripped runtime layer).

**Build strategy:** Single stage. Create non-root user → install deps → copy source with `--chown` →
compile contracts as non-root → expose 8545 → start node.

**Acceptance criteria:** Decision recorded; Dockerfile.hardhat rewritten in Milestone 2.7.

**Blockers:** None.

---

## Milestone 1.8 — Base image strategy: `deploy-audit-contract`

**Goal:** Replace the compose inline `node:22-alpine` with a proper Dockerfile for the
one-shot contract deployer.

**Analysis:** `scripts/deploy.ts` writes `audit-contract-address.txt` to `/deployment`. The
deployer must have write access to `/deployment` at runtime (mounted as a named volume). Creating
`/deployment` in the image as appuser-owned ensures the named volume is initialized with the
correct ownership when first mounted.

**Base image:** `node:22.16.0-alpine3.21` (same as hardhat-node; shares the same toolchain).

**Build strategy:** Single stage, shared with Dockerfile.hardhat in structure. Add `/deployment`
directory owned by non-root user in the image.

**Acceptance criteria:** Decision recorded; Dockerfile.deployer rewritten in Milestone 2.8.

**Blockers:** None.

---

## Milestone 2.1 — Dockerfile: `mqtt-kafka-bridge`

**Goal:** Produce a minimal, non-root, layer-efficient Dockerfile for the MQTT→Kafka bridge.

**File to modify:** `j1-device-edge/mqtt-kafka-bridge/Dockerfile`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM python:3.11.12-slim-bookworm

RUN useradd -m -u 1000 appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bridge.py .

USER appuser

CMD ["python", "bridge.py"]
```

No port needs to be EXPOSEd (outbound-only bridge). No HEALTHCHECK is needed — if this process
dies, Docker's `restart: unless-stopped` policy restarts it.

**Acceptance criteria:**
```bash
cd j1-device-edge/mqtt-kafka-bridge
docker build -t mqtt-kafka-bridge:test .
docker run --rm mqtt-kafka-bridge:test id
# Output must contain: uid=1000(appuser)
docker image inspect mqtt-kafka-bridge:test --format '{{.RootFS.Layers}}' | tr ' ' '\n' | wc -l
# Should be 4 layers (base + RUN + COPY req + pip + COPY bridge)
```

**Blockers:** None.

---

## Milestone 2.2 — Dockerfile: `j1-bridge-api`

**Goal:** Produce a two-stage Dockerfile that compiles confluent-kafka's C extension in a
builder and ships only the runtime artifact.

**File to modify:** `j1-device-edge/backend/Dockerfile`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM python:3.12.10-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        librdkafka-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.12.10-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        librdkafka1 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 appuser

WORKDIR /app

COPY --from=builder /install /usr/local

COPY app/ ./app/

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
```

**Acceptance criteria:**
```bash
cd j1-device-edge/backend
docker build -t j1-bridge-api:test .
docker run --rm j1-bridge-api:test id
# uid=1000(appuser)
docker run --rm j1-bridge-api:test python -c "import confluent_kafka; print('ok')"
# ok
docker run --rm j1-bridge-api:test which gcc
# must return empty (gcc not in runtime image)
```

**Blockers:** None (can build without Kafka running — the app tolerates a missing broker on startup).

---

## Milestone 2.3 — Dockerfile: `j2-data-intelligence`

**Goal:** Pin the base image version and remove the unnecessary `libpq5` from the runtime stage
(psycopg2-binary bundles its own libpq).

**File to modify:** `j2-data-intelligence/Dockerfile`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM python:3.11.12-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        librdkafka-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.11.12-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        librdkafka1 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 appuser

WORKDIR /app

COPY --from=builder /install /usr/local

COPY app/ ./app/

USER appuser

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8082/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]
```

**Why `libgomp1`:** XGBoost and LightGBM use OpenMP for parallel tree operations; without
`libgomp1` the shared library fails to load at import time.

**Acceptance criteria:**
```bash
cd j2-data-intelligence
docker build -t j2-data-intelligence:test .
docker run --rm j2-data-intelligence:test id
# uid=1000(appuser)
docker run --rm j2-data-intelligence:test python -c "import xgboost, lightgbm; print('ok')"
# ok
docker run --rm j2-data-intelligence:test python -c "import confluent_kafka; print('ok')"
# ok
docker run --rm j2-data-intelligence:test ls app/models/
# Flood_ensemble.pkl  Landslide_ensemble.pkl  Drought_ensemble.pkl
```

**Blockers:** None.

---

## Milestone 2.4 — Dockerfile: `j3-event-bridge` (`Dockerfile.mock`)

**Goal:** Add a non-root user and pin the base image version.

**File to modify:** `j3-system-interaction/dms/Dockerfile.mock`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM node:20.19.2-alpine3.21

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

COPY event-bridge.js .

USER appuser

EXPOSE 3001

CMD ["node", "event-bridge.js"]
```

**Acceptance criteria:**
```bash
cd j3-system-interaction/dms
docker build -f Dockerfile.mock -t j3-event-bridge:test .
docker run --rm j3-event-bridge:test id
# uid must not be 0
docker image inspect j3-event-bridge:test --format '{{.Config.User}}'
# appuser
```

**Blockers:** None (event-bridge.js tolerates a missing Kafka broker on startup; it will retry).

---

## Milestone 2.5 — Dockerfile: `j3-dms`

**Goal:** Pin base images, add non-root user in the runner stage, create `/app/data` for SQLite
persistence, and patch the SQLite path in source.

**Files to modify:**
- `j3-system-interaction/dms/Dockerfile`
- `j3-system-interaction/dms/lib/db.ts` (one-line patch)
- `j3-system-interaction/dms/.dockerignore` (add exclusions)

**Precise instructions:**

**Step 1 — Patch `lib/db.ts`** (line 23, the dbPath):

Change:
```typescript
const dbPath = path.resolve(process.cwd(), 'local_alerts.db');
```
To:
```typescript
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'local_alerts.db');
```

This allows the compose file to set `SQLITE_DB_PATH=/app/data/local_alerts.db` so the database
lands in a named-volume-mounted directory rather than the ephemeral container filesystem. The
fallback preserves local dev behaviour.

**Step 2 — Update `.dockerignore`** to exclude local dev artefacts from all build stages:

Replace the contents with:
```
node_modules
.next
.git
.env
.env.*
*.log
.DS_Store
npm-debug.log*
Dockerfile*
docker-compose*
docs/
README.md
CLAUDE.md
AGENTS.md
DIVISIONS_*.md
WEATHER_*.md
*.db
local_alerts.db
scratch.py
tests/
scripts/
```

**Step 3 — Replace `Dockerfile`** with:

```dockerfile
FROM node:20.19.2-alpine3.21 AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile


FROM node:20.19.2-alpine3.21 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

RUN npx prisma generate
RUN npm run build


FROM node:20.19.2-alpine3.21 AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production

RUN mkdir -p ./public ./data && chown -R appuser:appgroup ./public ./data

COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/metrics > /dev/null || exit 1

CMD ["node", "server.js"]
```

**Why `mkdir -p ./public`:** The DMS has no `public/` directory in source. The `COPY
--from=builder ... ./public` would fail silently if the path doesn't exist in the builder; the
explicit `mkdir -p` makes the runner directory present regardless.

**Acceptance criteria:**
```bash
cd j3-system-interaction/dms
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://localhost:3001 \
  -t j3-dms:test .
docker run --rm j3-dms:test id
# uid must not be 0
docker run --rm j3-dms:test ls /app/data
# directory exists
docker image inspect j3-dms:test --format '{{.Config.User}}'
# appuser
```

**Blockers:** Requires `DATABASE_URL` at runtime (set in compose in Milestone 4). The build
itself does not need a live database.

---

## Milestone 2.6 — Dockerfile: `j4-audit-api`

**Goal:** Add a non-root user to the existing two-stage TypeScript API Dockerfile.

**File to modify:** `j4-platform-security/blockchain-audit/Dockerfile`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM node:22.16.0-alpine3.21 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build
RUN mkdir -p dist/blockchain \
    && cp src/blockchain/IncidentAuditLog.json dist/blockchain/IncidentAuditLog.json


FROM node:22.16.0-alpine3.21 AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && chown -R appuser:appgroup /app/node_modules

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER appuser

EXPOSE 8084

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8084/health || exit 1

CMD ["npm", "start"]
```

**Acceptance criteria:**
```bash
cd j4-platform-security/blockchain-audit
docker build -t j4-audit-api:test .
docker run --rm j4-audit-api:test id
# uid must not be 0
docker run --rm j4-audit-api:test ls dist/blockchain/IncidentAuditLog.json
# dist/blockchain/IncidentAuditLog.json
docker run --rm j4-audit-api:test node -e "require('./dist/server.js')"
# should print "Audit API listening on port ..." then exit (no blockchain available)
```

**Blockers:** The runtime `npm start` calls `node dist/server.js`; it reads `BLOCKCHAIN_RPC_URL`
and `/deployment/audit-contract-address.txt` but those are wired in compose. The image build
itself has no external dependencies.

---

## Milestone 2.7 — Dockerfile: `hardhat-node`

**Goal:** Replace the compose inline image with a proper Dockerfile that bakes in dependencies,
pre-compiles contracts, and runs as a non-root user.

**File to modify:** `j4-platform-security/blockchain-audit/Dockerfile.hardhat`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM node:22.16.0-alpine3.21

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && apk add --no-cache python3 make g++

WORKDIR /app

COPY --chown=appuser:appgroup package.json package-lock.json ./
RUN npm ci && chown -R appuser:appgroup /app/node_modules

COPY --chown=appuser:appgroup . .

USER appuser

RUN npx hardhat compile

EXPOSE 8545

HEALTHCHECK --interval=5s --timeout=5s --start-period=30s --retries=10 \
    CMD wget -qO- \
        --post-data='{"jsonrpc":"2.0","method":"net_version","id":1}' \
        --header='Content-Type: application/json' \
        http://localhost:8545 > /dev/null || exit 1

CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
```

**Why `python3 make g++`:** Hardhat v3 uses `esbuild` internally which may require build tools
on Alpine. These are acceptable in a dev-node image.

**Why pre-compile:** `RUN npx hardhat compile` (as appuser, so the output `artifacts/` and
`cache/` dirs are owned by appuser) means the node starts immediately at runtime without
triggering a recompile. If contracts are modified, the image must be rebuilt — correct
behaviour for an immutable image.

**Acceptance criteria:**
```bash
cd j4-platform-security/blockchain-audit
docker build -f Dockerfile.hardhat -t hardhat-node:test .
docker run --rm hardhat-node:test id
# uid must not be 0
docker run --rm hardhat-node:test ls artifacts/contracts/IncidentAuditLog.sol/
# IncidentAuditLog.json  IncidentAuditLog.dbg.json
```

**Blockers:** None.

---

## Milestone 2.8 — Dockerfile: `deploy-audit-contract`

**Goal:** Replace the compose inline image with a proper Dockerfile for the one-shot deployer.

**File to modify:** `j4-platform-security/blockchain-audit/Dockerfile.deployer`

**Precise instructions:**

Replace the entire contents of the file with:

```dockerfile
FROM node:22.16.0-alpine3.21

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && apk add --no-cache python3 make g++ \
    && mkdir -p /deployment && chown appuser:appgroup /deployment

WORKDIR /app

COPY --chown=appuser:appgroup package.json package-lock.json ./
RUN npm ci && chown -R appuser:appgroup /app/node_modules

COPY --chown=appuser:appgroup . .

USER appuser

RUN npx hardhat compile

CMD ["npx", "hardhat", "run", "scripts/deploy.ts", "--network", "docker"]
```

**Why `/deployment` is created here:** When Docker mounts the `audit-deployment` named volume
over `/deployment` at first use, it copies the image's `/deployment` directory contents into the
volume and preserves ownership. Creating it as `appuser`-owned here means `scripts/deploy.ts`
(which calls `writeFileSync("/deployment/audit-contract-address.txt", ...)`) runs successfully
without a permission error.

**Acceptance criteria:**
```bash
cd j4-platform-security/blockchain-audit
docker build -f Dockerfile.deployer -t deploy-audit-contract:test .
docker run --rm deploy-audit-contract:test id
# uid must not be 0
docker run --rm deploy-audit-contract:test ls /deployment
# empty directory, owned by appuser
```

**Blockers:** Requires `hardhat-node` to be running before this container is started (enforced
by compose `depends_on` in Milestone 4).

---

## Milestone 3 — Inter-service networking and dependency mapping

**Goal:** Define the complete dependency graph, health-check requirements, and network
topology before writing the compose file.

**File to create:** _(no files — this milestone is the formal dependency spec that drives Milestone 4)_

**Precise instructions:**

### 3.1 Network topology

Keep a single bridge network: `disaster-net`. No network segmentation is needed because all
services are trusted internal processes in the same deployment unit. The compose file already
defines this network; no change is needed.

### 3.2 Health check definitions (to be written in compose)

| Service | Health check command | Interval | Timeout | Start period | Retries |
|---|---|---|---|---|---|
| `postgres` | `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}` | 10s | 5s | 5s | 5 |
| `kafka` | `/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list` | 10s | 10s | 30s | 10 |
| `keycloak` | `curl -f http://localhost:8080/health/ready` | 15s | 10s | 60s | 10 |
| `vault` | `wget -qO- http://localhost:8200/v1/sys/health \| grep sealed` | 10s | 5s | 10s | 5 |
| `elasticsearch` | `curl -f http://localhost:9200/_cluster/health?wait_for_status=yellow` | 15s | 10s | 60s | 10 |
| `logstash` | `curl -f http://localhost:9600/` | 15s | 10s | 60s | 10 |
| `kibana` | `curl -f http://localhost:5601/api/status` | 15s | 10s | 60s | 10 |
| `j3-event-bridge` | In-image healthcheck from Milestone 2.4 (`wget` on Socket.IO) | 10s | 5s | 15s | 5 |
| `j3-dms` | In-image healthcheck from Milestone 2.5 (`/api/metrics`) | 20s | 10s | 40s | 3 |
| `j4-audit-api` | In-image healthcheck from Milestone 2.6 (`/health`) | 10s | 5s | 10s | 3 |
| `hardhat-node` | In-image healthcheck from Milestone 2.7 (`net_version` RPC) | 5s | 5s | 30s | 10 |
| `kong` | `kong health` (already present in current compose) | 10s | 5s | 20s | 5 |
| `prometheus` | `wget -qO- http://localhost:9090/-/healthy` | 10s | 5s | 10s | 3 |
| `j2-data-intelligence` | In-image HEALTHCHECK from Milestone 2.3 | 30s | 10s | 30s | 3 |
| `j1-bridge-api` | In-image HEALTHCHECK from Milestone 2.2 | 15s | 5s | 10s | 3 |

### 3.3 Revised startup ordering (depends_on gates)

| Service | depends_on | condition |
|---|---|---|
| `mqtt-kafka-bridge` | `kafka` | `service_healthy` |
| `j1-bridge-api` | `kafka` | `service_healthy` |
| `j2-data-intelligence` | `postgres`, `kafka` | both `service_healthy` |
| `keycloak` | `postgres` | `service_healthy` |
| `j3-event-bridge` | `kafka` | `service_healthy` |
| `j3-dms` | `postgres`, `kafka`, `j3-event-bridge` | all `service_healthy` |
| `postgres-exporter` | `postgres` | `service_healthy` |
| `kafka-exporter` | `kafka` | `service_healthy` |
| `kong-migration` | `postgres` | `service_healthy` |
| `kong` | `kong-migration` | `service_completed_successfully` |
| `vault-setup` | `vault` | `service_healthy` |
| `keycloak-setup` | `keycloak`, `vault-setup` | `service_healthy`, `service_completed_successfully` |
| `kong-setup` | `kong`, `keycloak` | both `service_healthy` |
| `elasticsearch-setup` | `elasticsearch` | `service_healthy` |
| `logstash` | `elasticsearch`, `elasticsearch-setup` | `service_healthy`, `service_completed_successfully` |
| `kibana` | `elasticsearch` | `service_healthy` |
| `kibana-setup` | `kibana` | `service_healthy` |
| `filebeat` | `logstash` | `service_healthy` |
| `deploy-audit-contract` | `hardhat-node` | `service_healthy` |
| `j4-audit-api` | `deploy-audit-contract` | `service_completed_successfully` |
| `prometheus` | `alertmanager` | `service_started` |
| `grafana` | `prometheus` | `service_healthy` |

**Acceptance criteria:** The table above is the single source of truth for Milestone 4. No
service may have a `depends_on` that uses `service_started` where a health check exists.

**Blockers:** All Dockerfiles (Milestones 2.1–2.8) must be complete before testing the
full compose stack.

---

## Milestone 4 — `docker-compose.yml` with health checks and startup ordering

**Goal:** Rewrite the root `docker-compose.yml` to apply every decision from Milestones 1–3:
pinned image tags, health checks on all long-lived services, correct `depends_on` conditions,
non-secret environment variables moved to compose (secrets from `.env`), proper volumes for
persistent data, and j1-bridge-api re-enabled.

**Files to modify:**
- `docker-compose.yml` (full replacement)
- `postgres/init.sql` → replace with `postgres/init.sh`

### Step 1 — Create `postgres/init.sh`

Delete `postgres/init.sql` and create `postgres/init.sh` with the following content. This
replaces the hardcoded passwords with env-var references that PostgreSQL `docker-entrypoint`
expands when the script is a `.sh` file:

```bash
#!/usr/bin/env bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER ${J3_DB_USER} WITH PASSWORD '${J3_DB_PASSWORD}';
  CREATE DATABASE ${J3_DB_NAME} OWNER ${J3_DB_USER};

  CREATE USER ${KONG_DB_USER} WITH PASSWORD '${KONG_DB_PASSWORD}';
  CREATE DATABASE ${KONG_DB_NAME} OWNER ${KONG_DB_USER};

  CREATE USER ${KC_DB_USERNAME} WITH PASSWORD '${KC_DB_PASSWORD}';
  CREATE DATABASE keycloak OWNER ${KC_DB_USERNAME};
EOSQL
```

Mark it executable: `chmod +x postgres/init.sh`.

Update the `postgres` service in compose to mount `./postgres/init.sh` instead of
`./postgres/init.sql`.

### Step 2 — Full `docker-compose.yml`

Write the following complete file, replacing the existing one:

```yaml
# disaster-response-system/docker-compose.yml
# All secrets via .env (see .env.example). No value is hardcoded here.

services:

  # ── Infrastructure ────────────────────────────────────────────────────────

  postgres:
    image: postgres:16-alpine
    container_name: disaster-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      J3_DB_USER: ${J3_DB_USER}
      J3_DB_PASSWORD: ${J3_DB_PASSWORD}
      J3_DB_NAME: ${J3_DB_NAME}
      KONG_DB_USER: ${KONG_DB_USER}
      KONG_DB_PASSWORD: ${KONG_DB_PASSWORD}
      KONG_DB_NAME: ${KONG_DB_NAME}
      KC_DB_USERNAME: ${KC_DB_USERNAME}
      KC_DB_PASSWORD: ${KC_DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init.sh:/docker-entrypoint-initdb.d/init.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks:
      - disaster-net

  kafka:
    image: apache/kafka:3.7.1
    container_name: disaster-kafka
    restart: unless-stopped
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: EXTERNAL://:9092,INTERNAL://:29092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: EXTERNAL://localhost:9092,INTERNAL://kafka:29092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT,INTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list > /dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 30s
    networks:
      - disaster-net

  # ── J1 — Device & Edge Systems ────────────────────────────────────────────

  mqtt-kafka-bridge:
    build:
      context: ./j1-device-edge/mqtt-kafka-bridge
    image: disaster/mqtt-kafka-bridge:latest
    container_name: disaster-mqtt-kafka-bridge
    restart: unless-stopped
    environment:
      MQTT_BROKER: ${MQTT_BROKER}
      MQTT_PORT: ${MQTT_PORT}
      MQTT_USERNAME: ${MQTT_USERNAME}
      MQTT_PASSWORD: ${MQTT_PASSWORD}
      MQTT_TOPICS: j1/disaster/#
      KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      KAFKA_TOPIC: disaster_data_stream
      KAFKA_TOPIC_FLOOD: j1.sensor.telemetry.flood
      KAFKA_TOPIC_LANDSLIDE: j1.sensor.telemetry.landslide
    depends_on:
      kafka:
        condition: service_healthy
    networks:
      - disaster-net

  j1-bridge-api:
    build:
      context: ./j1-device-edge/backend
    image: disaster/j1-bridge-api:latest
    container_name: j1-bridge-api
    restart: unless-stopped
    ports:
      - "8081:8000"
    environment:
      KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      KAFKA_TOPIC_EVENTS: j1.events
      KAFKA_PRODUCER_TIMEOUT: "10"
      API_HOST: 0.0.0.0
      API_PORT: "8000"
      CORS_ORIGINS: "*"
      IDEMPOTENCY_MAX_KEYS: "50000"
    depends_on:
      kafka:
        condition: service_healthy
    networks:
      - disaster-net

  # ── J2 — Data & Intelligence ──────────────────────────────────────────────

  j2-data-intelligence:
    build: ./j2-data-intelligence
    image: disaster/j2-data-intelligence:latest
    container_name: j2-data-intelligence
    restart: unless-stopped
    ports:
      - "8082:8082"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      KAFKA_BROKER: kafka:29092
      KAFKA_ALERT_THRESHOLD: "0.0"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_healthy
    networks:
      - disaster-net

  # ── J3 — System Interaction ───────────────────────────────────────────────

  j3-event-bridge:
    build:
      context: ./j3-system-interaction/dms
      dockerfile: Dockerfile.mock
    image: disaster/j3-event-bridge:latest
    container_name: j3-event-bridge
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      KAFKA_BROKER: kafka:29092
    depends_on:
      kafka:
        condition: service_healthy
    networks:
      - disaster-net

  j3-dms:
    build:
      context: ./j3-system-interaction/dms
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://${SERVER_IP:-localhost}:3000
        NEXT_PUBLIC_SOCKET_URL: http://${SERVER_IP:-localhost}:3001
    image: disaster/j3-dms:latest
    container_name: j3-dms
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${J3_DB_USER}:${J3_DB_PASSWORD}@postgres:5432/${J3_DB_NAME}
      SQLITE_DB_PATH: /app/data/local_alerts.db
      AUDIT_API_BASE_URL: http://j4-audit-api:8084
      KAFKA_BROKER: kafka:29092
    labels:
      prometheus-scrape: "true"
      prometheus-port: "3000"
      prometheus-path: "/api/metrics"
      prometheus-job: "j3-dms"
    volumes:
      - j3_dms_data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_healthy
      j3-event-bridge:
        condition: service_healthy
    networks:
      - disaster-net

  # ── J4 — Platform Security ────────────────────────────────────────────────

  hardhat-node:
    build:
      context: ./j4-platform-security/blockchain-audit
      dockerfile: Dockerfile.hardhat
    image: disaster/hardhat-node:latest
    container_name: hardhat-node
    restart: unless-stopped
    ports:
      - "8545:8545"
    networks:
      - disaster-net

  deploy-audit-contract:
    build:
      context: ./j4-platform-security/blockchain-audit
      dockerfile: Dockerfile.deployer
    image: disaster/deploy-audit-contract:latest
    container_name: deploy-audit-contract
    restart: "no"
    volumes:
      - audit-deployment:/deployment
    depends_on:
      hardhat-node:
        condition: service_healthy
    networks:
      - disaster-net

  j4-audit-api:
    build:
      context: ./j4-platform-security/blockchain-audit
      dockerfile: Dockerfile
    image: disaster/j4-audit-api:latest
    container_name: j4-audit-api
    restart: unless-stopped
    ports:
      - "8084:8084"
    environment:
      PORT: "8084"
      BLOCKCHAIN_RPC_URL: http://hardhat-node:8545
      AUDIT_PRIVATE_KEY: ${AUDIT_PRIVATE_KEY}
    volumes:
      - audit-deployment:/deployment:ro
    depends_on:
      deploy-audit-contract:
        condition: service_completed_successfully
    networks:
      - disaster-net

  # ── J4 — Identity & Access Management ────────────────────────────────────

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: disaster-keycloak
    restart: unless-stopped
    command: start-dev --import-realm
    environment:
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: ${KC_DB_USERNAME}
      KC_DB_PASSWORD: ${KC_DB_PASSWORD}
      KC_METRICS_ENABLED: "true"
      KC_METRICS_PATH: "/metrics"
      KC_PROXY_HEADERS: xforwarded
    ports:
      - "8180:8080"
    labels:
      prometheus-scrape: "true"
      prometheus-port: "8080"
      prometheus-path: "/metrics"
      prometheus-job: "keycloak"
    volumes:
      - ./j4-platform-security/keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health/ready || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 60s
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - disaster-net

  vault:
    image: hashicorp/vault:1.17
    container_name: disaster-vault
    restart: unless-stopped
    cap_add:
      - IPC_LOCK
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: ${VAULT_DEV_ROOT_TOKEN_ID}
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
      VAULT_ADDR: http://0.0.0.0:8200
    ports:
      - "8200:8200"
    command: vault server -dev
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8200/v1/sys/health | grep -q '\"initialized\":true' || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - disaster-net

  vault-setup:
    image: alpine:3.19
    container_name: disaster-vault-setup
    restart: "no"
    environment:
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: ${VAULT_DEV_ROOT_TOKEN_ID}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
    volumes:
      - ./j4-platform-security/vault/setup.sh:/setup.sh:ro
    entrypoint:
      - sh
      - -c
      - |
        apk add --no-cache bash curl -q
        bash /setup.sh
    depends_on:
      vault:
        condition: service_healthy
    networks:
      - disaster-net

  keycloak-setup:
    image: alpine:3.19
    container_name: disaster-keycloak-setup
    restart: "no"
    environment:
      KC_URL: http://keycloak:8080
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN}
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: ${VAULT_DEV_ROOT_TOKEN_ID}
    volumes:
      - ./j4-platform-security/keycloak/setup.sh:/setup.sh:ro
    entrypoint:
      - sh
      - -c
      - |
        apk add --no-cache bash curl jq -q
        bash /setup.sh
    depends_on:
      keycloak:
        condition: service_healthy
      vault-setup:
        condition: service_completed_successfully
    networks:
      - disaster-net

  # ── J4 — API Gateway ─────────────────────────────────────────────────────

  kong-migration:
    image: kong:3.7
    container_name: disaster-kong-migration
    restart: "no"
    command: kong migrations bootstrap
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: postgres
      KONG_PG_USER: ${KONG_DB_USER}
      KONG_PG_PASSWORD: ${KONG_DB_PASSWORD}
      KONG_PG_DATABASE: ${KONG_DB_NAME}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - disaster-net

  kong:
    image: kong:3.7
    container_name: disaster-kong
    restart: unless-stopped
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: postgres
      KONG_PG_USER: ${KONG_DB_USER}
      KONG_PG_PASSWORD: ${KONG_DB_PASSWORD}
      KONG_PG_DATABASE: ${KONG_DB_NAME}
      KONG_PROXY_LISTEN: 0.0.0.0:8000
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
      KONG_LOG_LEVEL: warn
      KONG_UNTRUSTED_LUA_SANDBOX_REQUIRES: cjson.safe
    ports:
      - "8000:8000"
      - "8001:8001"
    labels:
      prometheus-scrape: "true"
      prometheus-port: "8001"
      prometheus-path: "/metrics"
      prometheus-job: "kong"
    healthcheck:
      test: ["CMD", "kong", "health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    depends_on:
      kong-migration:
        condition: service_completed_successfully
    networks:
      - disaster-net

  kong-setup:
    image: alpine:3.19
    container_name: disaster-kong-setup
    restart: "no"
    environment:
      KONG_ADMIN: http://kong:8001
      KC_REALM_URL: http://keycloak:8080/realms/disaster-response
      KC_ISSUER: ${KC_ISSUER}
    volumes:
      - ./j4-platform-security/kong:/opt/kong-setup:ro
    entrypoint:
      - sh
      - -c
      - |
        apk add --no-cache bash curl jq -q
        bash /opt/kong-setup/setup.sh
    depends_on:
      kong:
        condition: service_healthy
      keycloak:
        condition: service_healthy
    networks:
      - disaster-net

  # ── J4 — Monitoring ───────────────────────────────────────────────────────

  kafka-exporter:
    image: danielqsj/kafka-exporter:v1.8.0
    container_name: disaster-kafka-exporter
    restart: unless-stopped
    ports:
      - "9308:9308"
    labels:
      prometheus-scrape: "true"
      prometheus-port: "9308"
      prometheus-path: "/metrics"
      prometheus-job: "kafka"
    command:
      - --kafka.server=kafka:29092
    depends_on:
      kafka:
        condition: service_healthy
    networks:
      - disaster-net

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: disaster-postgres-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable"
    ports:
      - "9187:9187"
    labels:
      prometheus-scrape: "true"
      prometheus-port: "9187"
      prometheus-path: "/metrics"
      prometheus-job: "postgres"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - disaster-net

  alertmanager:
    image: prom/alertmanager:v0.27.0
    container_name: disaster-alertmanager
    restart: unless-stopped
    ports:
      - "9093:9093"
    labels:
      prometheus-scrape: "true"
      prometheus-port: "9093"
      prometheus-path: "/metrics"
      prometheus-job: "alertmanager"
    environment:
      ALERTMANAGER_EMAIL_PASSWORD: ${ALERTMANAGER_EMAIL_PASSWORD}
    volumes:
      - ./j4-platform-security/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml.tpl:ro
      - alertmanager_data:/alertmanager
    entrypoint:
      - sh
      - -c
      - |
        sed "s|__ALERTMANAGER_EMAIL_PASSWORD__|${ALERTMANAGER_EMAIL_PASSWORD}|g" \
            /etc/alertmanager/alertmanager.yml.tpl > /alertmanager/alertmanager.yml
        exec /bin/alertmanager \
            --config.file=/alertmanager/alertmanager.yml \
            --storage.path=/alertmanager \
            --web.external-url=http://localhost:9093
    networks:
      - disaster-net

  prometheus:
    image: prom/prometheus:v2.52.0
    container_name: disaster-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    labels:
      prometheus-scrape: "true"
      prometheus-port: "9090"
      prometheus-path: "/metrics"
      prometheus-job: "prometheus"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - ./prometheus/sd_config.json:/etc/prometheus/sd_config.json:ro
      - prometheus_data:/prometheus
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:9090/-/healthy || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    depends_on:
      - alertmanager
    networks:
      - disaster-net

  grafana:
    image: grafana/grafana:10.4.0
    container_name: disaster-grafana
    restart: unless-stopped
    ports:
      - "3030:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GF_SECURITY_ADMIN_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./j4-platform-security/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./j4-platform-security/grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on:
      prometheus:
        condition: service_healthy
    networks:
      - disaster-net

  # ── ELK Stack ─────────────────────────────────────────────────────────────

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.4
    container_name: disaster-elasticsearch
    restart: unless-stopped
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      xpack.security.enrollment.enabled: "false"
      ES_JAVA_OPTS: -Xms512m -Xmx512m
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health?wait_for_status=yellow || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 60s
    networks:
      - disaster-net

  elasticsearch-setup:
    image: alpine:3.19
    container_name: disaster-elasticsearch-setup
    restart: "no"
    environment:
      ELK_LOG_RETENTION_DAYS: ${ELK_LOG_RETENTION_DAYS:-14}
    volumes:
      - ./j4-platform-security/elk/scripts/bootstrap-elasticsearch.sh:/setup/bootstrap-elasticsearch.sh:ro
    entrypoint: ["sh", "/setup/bootstrap-elasticsearch.sh"]
    depends_on:
      elasticsearch:
        condition: service_healthy
    networks:
      - disaster-net

  logstash:
    image: docker.elastic.co/logstash/logstash:8.13.4
    container_name: disaster-logstash
    restart: unless-stopped
    environment:
      LS_JAVA_OPTS: -Xms256m -Xmx256m
    ports:
      - "5044:5044"
      - "9600:9600"
    volumes:
      - ./j4-platform-security/elk/logstash/pipeline:/usr/share/logstash/pipeline:ro
      - ./j4-platform-security/elk/logstash/config/logstash.yml:/usr/share/logstash/config/logstash.yml:ro
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9600/ || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 60s
    depends_on:
      elasticsearch:
        condition: service_healthy
      elasticsearch-setup:
        condition: service_completed_successfully
    networks:
      - disaster-net

  kibana:
    image: docker.elastic.co/kibana/kibana:8.13.4
    container_name: disaster-kibana
    restart: unless-stopped
    environment:
      SERVER_HOST: 0.0.0.0
      SERVER_NAME: disaster-kibana
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    ports:
      - "5601:5601"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:5601/api/status || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 60s
    depends_on:
      elasticsearch:
        condition: service_healthy
    networks:
      - disaster-net

  kibana-setup:
    image: alpine:3.19
    container_name: disaster-kibana-setup
    restart: "no"
    volumes:
      - ./j4-platform-security/elk/scripts/bootstrap-kibana.sh:/setup/bootstrap-kibana.sh:ro
      - ./j4-platform-security/elk/kibana/drs-logs-dashboard.ndjson:/setup/drs-logs-dashboard.ndjson:ro
      - ./j4-platform-security/elk/kibana/drs-kong-dashboard.ndjson:/setup/drs-kong-dashboard.ndjson:ro
      - ./j4-platform-security/elk/kibana/drs-missing-trace-search.ndjson:/setup/drs-missing-trace-search.ndjson:ro
      - ./j4-platform-security/elk/scripts/create-kibana-alerts.sh:/setup/create-kibana-alerts.sh:ro
    entrypoint: ["sh", "/setup/bootstrap-kibana.sh"]
    depends_on:
      kibana:
        condition: service_healthy
    networks:
      - disaster-net

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.13.4
    container_name: disaster-filebeat
    restart: unless-stopped
    user: root
    command: ["filebeat", "-e", "--strict.perms=false", "-c", "/usr/share/filebeat/filebeat.yml"]
    volumes:
      - ./j4-platform-security/elk/filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      logstash:
        condition: service_healthy
    networks:
      - disaster-net

# ── Named Volumes ─────────────────────────────────────────────────────────────
volumes:
  postgres_data:
  elasticsearch_data:
  prometheus_data:
  alertmanager_data:
  grafana_data:
  audit-deployment:
  j3_dms_data:

# ── Networks ──────────────────────────────────────────────────────────────────
networks:
  disaster-net:
    driver: bridge
```

**Note on `filebeat` running as root:** Filebeat requires root to read
`/var/lib/docker/containers` (owned by root on the host). This is the one legitimate exception
to the non-root rule across this entire system.

**Note on the three `elasticsearch-setup` variants (default + dev + prod):** The dev/prod
profile variants are removed from this compose. Retention is now driven entirely by
`ELK_LOG_RETENTION_DAYS` in `.env`. Operators set `14` for dev and `30` for prod in their
respective `.env` files. This reduces the container count by two and eliminates duplicated logic.

**Note on `logstash_data` and `kibana_data` volumes:** These were in the original compose but
neither service uses a volume mount for persistent data (pipelines and config are bind-mounted
read-only). They are removed.

**Acceptance criteria:**
```bash
docker compose config --quiet   # must print no errors
grep "latest" docker-compose.yml
# must return no matches (no floating tags anywhere)
grep -E "service_started" docker-compose.yml
# must return no matches
```

**Blockers:** All Dockerfiles (Milestones 2.1–2.8) must exist. `postgres/init.sh` must exist.

---

## Milestone 5 — Environment and secrets hygiene

**Goal:** Produce a single, complete `.env.example` that covers every variable referenced in
`docker-compose.yml`, remove hardcoded values from the compose file, and document which values
are genuine secrets.

**Files to modify:**
- `.env.example` (replace entirely)
- Remove `j3-system-interaction/dms/.env` reference from compose (done in Milestone 4 — no
  `env_file` directive for j3-dms remains; all vars are passed as explicit `environment` keys)

**Precise instructions:**

Replace `.env.example` with the following. Values marked `CHANGE_ME` are genuine secrets that
must never be committed to source control. Values with a default shown are safe for local dev
but must be rotated in production.

```bash
# ── PostgreSQL superuser ────────────────────────────────────────────────────
POSTGRES_USER=disaster
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=disasterdb

# ── PostgreSQL — J3 service account ────────────────────────────────────────
# Must match j3user / j3password in init.sh
J3_DB_USER=j3user
J3_DB_PASSWORD=CHANGE_ME
J3_DB_NAME=j3db

# ── PostgreSQL — Kong service account ──────────────────────────────────────
KONG_DB_USER=kong
KONG_DB_PASSWORD=CHANGE_ME
KONG_DB_NAME=kong

# ── PostgreSQL — Keycloak service account ──────────────────────────────────
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=CHANGE_ME

# ── Keycloak admin ─────────────────────────────────────────────────────────
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=CHANGE_ME

# Kong JWT issuer URL — must match the `iss` claim in tokens.
# In local dev: Keycloak is published on host port 8180.
KC_ISSUER=http://localhost:8180/realms/disaster-response

# ── HashiCorp Vault ────────────────────────────────────────────────────────
# Dev mode only. Replace with proper unsealing for production.
VAULT_DEV_ROOT_TOKEN_ID=CHANGE_ME

# ── Grafana ────────────────────────────────────────────────────────────────
GF_SECURITY_ADMIN_PASSWORD=CHANGE_ME

# ── AlertManager ───────────────────────────────────────────────────────────
ALERTMANAGER_EMAIL_PASSWORD=CHANGE_ME

# ── ELK log retention ──────────────────────────────────────────────────────
ELK_LOG_RETENTION_DAYS=14

# ── J1 — MQTT credentials ──────────────────────────────────────────────────
MQTT_BROKER=8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=j1_gateway
MQTT_PASSWORD=CHANGE_ME

# ── J3 — Public URLs (used as Next.js build args) ──────────────────────────
# Set to the host/IP where the stack is reachable from browsers.
SERVER_IP=localhost

# ── J4 — Blockchain audit ──────────────────────────────────────────────────
# Default is Hardhat account #0 test key. Safe for local dev ONLY.
AUDIT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**Additional step — add `.env` to `.gitignore`:**

Verify that `.gitignore` contains:
```
.env
```
If it does not, add it. `.env.example` must remain tracked.

**Acceptance criteria:**
```bash
# Every variable referenced in docker-compose.yml must appear in .env.example
grep -oP '\$\{[A-Z_]+\}' docker-compose.yml | sort -u | \
  while read v; do
    varname="${v:2:-1}"
    grep -q "^${varname}=" .env.example || echo "MISSING: $varname"
  done
# Output must be empty
git status .env
# .env must NOT be tracked by git (either in .gitignore or not yet staged)
```

**Blockers:** Milestone 4 must be complete (compose file must be final before checking coverage).

---

## Milestone 6 — Validation: full stack bring-up and end-to-end verification

**Goal:** Confirm the entire containerised stack starts healthy, all inter-service connections
succeed, and no container exits unexpectedly.

**Files to create/modify:** None — this milestone is purely operational.

**Precise instructions:**

### Step 1 — Create your working `.env`

```bash
cp .env.example .env
# Edit .env and replace every CHANGE_ME with a real value.
# For local dev, any non-empty string works for passwords.
# MQTT_PASSWORD must be the real HiveMQ credential if you want live sensor data.
```

### Step 2 — Build all images

```bash
docker compose build --no-cache 2>&1 | tee /tmp/drs-build.log
grep -i "error" /tmp/drs-build.log
# Must be empty
```

### Step 3 — Bring the stack up

```bash
docker compose up -d
```

### Step 4 — Wait for all services to become healthy

```bash
watch -n 5 'docker compose ps --format "table {{.Name}}\t{{.Status}}"'
```

Wait until every long-lived service shows `Up (healthy)` or `Up`. One-shot containers
(`-setup`, `-migration`, `deploy-audit-contract`) should show `Exited (0)` — any other exit
code is a failure.

Expected final state:

| Container | Expected status |
|---|---|
| `disaster-postgres` | `Up (healthy)` |
| `disaster-kafka` | `Up (healthy)` |
| `disaster-mqtt-kafka-bridge` | `Up` |
| `j1-bridge-api` | `Up (healthy)` |
| `j2-data-intelligence` | `Up (healthy)` |
| `j3-event-bridge` | `Up (healthy)` |
| `j3-dms` | `Up (healthy)` |
| `disaster-keycloak` | `Up (healthy)` |
| `disaster-vault` | `Up (healthy)` |
| `disaster-kong` | `Up (healthy)` |
| `hardhat-node` | `Up (healthy)` |
| `j4-audit-api` | `Up (healthy)` |
| `disaster-elasticsearch` | `Up (healthy)` |
| `disaster-logstash` | `Up (healthy)` |
| `disaster-kibana` | `Up (healthy)` |
| `disaster-prometheus` | `Up (healthy)` |
| `disaster-grafana` | `Up` |
| `disaster-alertmanager` | `Up` |
| `disaster-kafka-exporter` | `Up` |
| `disaster-postgres-exporter` | `Up` |
| `disaster-filebeat` | `Up` |
| One-shot sidecars | `Exited (0)` |

### Step 5 — Verify inter-service communication

**PostgreSQL connectivity:**
```bash
docker exec disaster-postgres psql -U disaster -d disasterdb -c "SELECT 1;"
docker exec disaster-postgres psql -U j3user -d j3db -c "SELECT 1;"
docker exec disaster-postgres psql -U kong -d kong -c "SELECT 1;"
# All must return: (1 row)
```

**Kafka broker:**
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 --list
# Must list topics (at minimum the internal __consumer_offsets topic)
```

**J2 data intelligence health:**
```bash
curl -f http://localhost:8082/api/v1/health
# {"status": "healthy"}
```

**J1 bridge API health:**
```bash
curl -f http://localhost:8081/health
# {"status": "ok"} or similar
```

**J3 DMS dashboard:**
```bash
curl -f http://localhost:3000/api/metrics
# Must return Prometheus text format output
```

**J4 audit API:**
```bash
curl -f http://localhost:8084/health
# {"status":"ok"}
```

**Kong proxy is up:**
```bash
curl -f http://localhost:8000
# Returns Kong 404 (no routes matched) — this confirms Kong is alive
curl -f http://localhost:8001
# Returns Kong Admin API JSON
```

**Keycloak is up and realm imported:**
```bash
curl -f "http://localhost:8180/realms/disaster-response/.well-known/openid-configuration" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['issuer'])"
# http://localhost:8180/realms/disaster-response
```

**Vault is initialized:**
```bash
curl -sf http://localhost:8200/v1/sys/health | python3 -m json.tool | grep initialized
# "initialized": true
```

**Elasticsearch cluster health:**
```bash
curl -f http://localhost:9200/_cluster/health?pretty | grep status
# "status" : "yellow"   (single-node, normal for dev)
```

**Grafana dashboards:**
```bash
curl -u admin:${GF_SECURITY_ADMIN_PASSWORD} http://localhost:3030/api/health
# {"commit":"...","database":"ok","version":"..."}
```

**Prometheus scrape targets:**
```bash
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep '"health"' | sort | uniq -c
# Majority should show "up"; any "down" targets need investigation
```

### Step 6 — Confirm no container has restarted unexpectedly

```bash
docker compose ps --format json | python3 -c "
import sys, json
services = [json.loads(l) for l in sys.stdin if l.strip()]
bad = [s for s in services if int(s.get('ExitCode', 0)) not in (0, -1) and 'setup' not in s['Name'].lower() and 'migration' not in s['Name'].lower() and 'deploy' not in s['Name'].lower()]
print('FAILURES:', bad if bad else 'none')
"
```

### Step 7 — Smoke-test the Kafka data path

```bash
# In one terminal: start a consumer
docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic j1.sensor.telemetry.flood \
    --from-beginning \
    --max-messages 1 \
    --timeout-ms 10000 || echo "(no messages yet — expected if no sensors are publishing)"

# In another terminal: publish a test event to j1.events via j1-bridge-api
curl -X POST http://localhost:8081/api/v1/events/ingest \
    -H "Content-Type: application/json" \
    -d '{"type":"SOS","latitude":6.9,"longitude":79.8,"description":"test"}'
# Must return 200 or 201
```

**Acceptance criteria:** All health checks pass, all inter-service curl commands return expected
responses, no non-setup container has exited with a non-zero code, and the Kafka producer test
returns 200.

**Blockers:** All previous milestones must be complete.

---

## Summary of all files created or modified

| File | Action | Milestone |
|---|---|---|
| `j1-device-edge/mqtt-kafka-bridge/Dockerfile` | Replace | 2.1 |
| `j1-device-edge/backend/Dockerfile` | Replace | 2.2 |
| `j2-data-intelligence/Dockerfile` | Replace | 2.3 |
| `j3-system-interaction/dms/Dockerfile.mock` | Replace | 2.4 |
| `j3-system-interaction/dms/Dockerfile` | Replace | 2.5 |
| `j3-system-interaction/dms/.dockerignore` | Replace | 2.5 |
| `j3-system-interaction/dms/lib/db.ts` | One-line patch | 2.5 |
| `j4-platform-security/blockchain-audit/Dockerfile` | Replace | 2.6 |
| `j4-platform-security/blockchain-audit/Dockerfile.hardhat` | Replace | 2.7 |
| `j4-platform-security/blockchain-audit/Dockerfile.deployer` | Replace | 2.8 |
| `docker-compose.yml` | Replace | 4 |
| `postgres/init.sql` | Delete → replace with `postgres/init.sh` | 4 |
| `.env.example` | Replace | 5 |
