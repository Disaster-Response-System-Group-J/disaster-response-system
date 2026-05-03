# J3 Bug Fixes — What Was Done

## Fix 1 — Kafka broker address breaks inside Docker

**File:** `dms/event-bridge.js`

**Problem:**
The Kafka client had the broker address hardcoded as `localhost:9092`. When running inside a Docker container, `localhost` refers to the container itself — not the Kafka container. This meant the event-bridge could never connect to Kafka when running via `docker compose up`.

**Before:**
```js
const kafka = new Kafka({
  clientId: 'j3-event-bridge',
  brokers: ['localhost:9092']
});
```

**After:**
```js
const kafka = new Kafka({
  clientId: 'j3-event-bridge',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});
```

Now `KAFKA_BROKER=kafka:29092` is injected by docker-compose for container use. Local dev (`node event-bridge.js`) falls back to `localhost:9092` unchanged.

---

## Fix 2 — Same Kafka broker issue in mock-producer.js

**File:** `dms/mock-producer.js`

**Problem:** Identical hardcoded broker address as Fix 1. The mock producer would also fail to connect to Kafka when run inside Docker.

**Before:**
```js
const kafka = new Kafka({
  clientId: 'j1-j2-mock-systems',
  brokers: ['localhost:9092']
});
```

**After:**
```js
const kafka = new Kafka({
  clientId: 'j1-j2-mock-systems',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});
```

---

## Fix 3 — Socket.IO URL hardcoded in SocketContext

**File:** `dms/context/SocketContext.tsx`

**Problem:**
The browser Socket.IO client had `http://localhost:3001` hardcoded directly in the source, completely ignoring the `NEXT_PUBLIC_SOCKET_URL` environment variable that was already defined in `.env` and passed as a Docker build arg. The env var had no effect.

**Before:**
```ts
const socketInstance = io('http://localhost:3001');
```

**After:**
```ts
const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
```

---

## Fix 4 — Dockerfile.mock referenced a file that doesn't exist

**File:** `dms/Dockerfile.mock`

**Problem:**
The Dockerfile was copying and running `mock-server.js`, which does not exist in the codebase. The actual files are `event-bridge.js` (the Socket.IO + Kafka bridge) and `mock-producer.js` (the test data generator). Any Docker build using this file would fail immediately.

Also, only one JS file was being copied, making it impossible to run `mock-producer.js` from the same image.

**Before:**
```dockerfile
COPY mock-server.js ./
EXPOSE 3001
CMD ["node", "mock-server.js"]
```

**After:**
```dockerfile
COPY *.js ./
EXPOSE 3001
CMD ["node", "event-bridge.js"]
```

Copying all `.js` files means the same image can run either `event-bridge.js` (default) or `mock-producer.js` (via `command:` override in docker-compose).

---

## Fix 5 — event-bridge and mock-producer had no Docker service

**File:** `docker-compose.yml`

**Problem:**
`event-bridge.js` runs the Socket.IO server on port 3001 that the entire frontend depends on for real-time updates. It was never defined as a service in `docker-compose.yml`, so `docker compose up` would start Postgres, Kafka, and the Next.js app — but real-time events would never work because nothing was running on port 3001.

`mock-producer.js` also had no service, so no test data would ever flow into Kafka.

**Added — event-bridge service:**
```yaml
event-bridge:
  build:
    context: ./dms
    dockerfile: Dockerfile.mock
  container_name: j3-event-bridge
  restart: unless-stopped
  ports:
    - "3001:3001"
  environment:
    KAFKA_BROKER: kafka:29092
  depends_on:
    kafka:
      condition: service_started
  networks:
    - j3-net
```

**Added — mock-producer service:**
```yaml
mock-producer:
  build:
    context: ./dms
    dockerfile: Dockerfile.mock
  container_name: j3-mock-producer
  restart: unless-stopped
  command: ["node", "mock-producer.js"]
  environment:
    KAFKA_BROKER: kafka:29092
  depends_on:
    kafka:
      condition: service_started
  networks:
    - j3-net
```

The `dms` service was also updated to `depends_on: event-bridge` so the Next.js app only starts once the bridge is up.

---

## Fix 6 — Kafka only had one listener, breaking container-to-container traffic

**File:** `docker-compose.yml`

**Problem:**
Kafka was configured with a single `PLAINTEXT` listener advertised as `localhost:9092`. This works when connecting from the host machine, but other containers (event-bridge, mock-producer) cannot reach `localhost:9092` — `localhost` inside their containers is themselves, not the Kafka container. Any Kafka client running inside Docker would time out trying to connect.

**Before:**
```yaml
KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
```

**After:**
```yaml
KAFKA_LISTENERS: EXTERNAL://:9092,INTERNAL://:29092,CONTROLLER://:9093
KAFKA_ADVERTISED_LISTENERS: EXTERNAL://localhost:9092,INTERNAL://kafka:29092
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT,INTERNAL:PLAINTEXT
KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
```

| Listener | Address | Used by |
|----------|---------|---------|
| `EXTERNAL` | `localhost:9092` | Host machine (local dev, `node event-bridge.js`) |
| `INTERNAL` | `kafka:29092` | Containers inside the Docker network |
| `CONTROLLER` | `localhost:9093` | Internal KRaft controller (same container) |

---

## Summary Table

| # | Severity | File | Problem | Fix |
|---|----------|------|---------|-----|
| 1 | Critical | `event-bridge.js` | Hardcoded `localhost:9092` breaks in Docker | Use `KAFKA_BROKER` env var |
| 2 | Critical | `mock-producer.js` | Same hardcoded broker | Use `KAFKA_BROKER` env var |
| 3 | High | `SocketContext.tsx` | `NEXT_PUBLIC_SOCKET_URL` env var ignored | Read env var with localhost fallback |
| 4 | Critical | `Dockerfile.mock` | Referenced non-existent `mock-server.js` | Copy `*.js`, run `event-bridge.js` |
| 5 | Critical | `docker-compose.yml` | `event-bridge` and `mock-producer` had no service | Added both services with correct env and deps |
| 6 | Critical | `docker-compose.yml` | Kafka single listener blocked container traffic | Added dual listener (EXTERNAL + INTERNAL) |
