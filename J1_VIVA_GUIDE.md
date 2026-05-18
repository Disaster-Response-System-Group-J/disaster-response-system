# J1 Device-Edge — Viva Guide

A walkthrough of the J1 subgroup of the Disaster Response System, mapped to the two data-flow diagrams you'll be presenting. Every claim below points to a real file and line so you can open it on screen if challenged.

---

## Pipeline 1 — Mobile App → Bridge API → Kafka

```
Mobile App (Flutter)
  └─ Help Request / Disaster Report
       └─ SQLite queue → SyncService (every 30s)
              └─ POST /api/v1/ingest/report
                     ▼
              J1 Bridge API :8081
              (validates + idempotency check)
                     │ publishes to
                     ▼
              Kafka: j1.sos.raw-reports
                     │
                     ▼
              J2 Report Consumer
```

| Stage | Where the code lives | Key file(s) |
|---|---|---|
| Flutter app entry / UI | [j1-device-edge/mobile_app/lib/](j1-device-edge/mobile_app/lib/) | [main.dart](j1-device-edge/mobile_app/lib/main.dart) |
| Help request form (citizen SOS) | [j1-device-edge/mobile_app/lib/screens/](j1-device-edge/mobile_app/lib/screens/) | [help_request_form.dart](j1-device-edge/mobile_app/lib/screens/help_request_form.dart), [data_report_form.dart](j1-device-edge/mobile_app/lib/screens/data_report_form.dart) |
| SQLite queue (offline-first) | [j1-device-edge/mobile_app/lib/services/](j1-device-edge/mobile_app/lib/services/) | [database_helper.dart](j1-device-edge/mobile_app/lib/services/database_helper.dart), [offline_queue_manager.dart](j1-device-edge/mobile_app/lib/services/offline_queue_manager.dart) |
| Periodic sync (every 30s) | same folder | [sync_service.dart](j1-device-edge/mobile_app/lib/services/sync_service.dart) — see `syncPollingIntervalSeconds = 30` in [constants.dart:25](j1-device-edge/mobile_app/lib/utills/constants.dart#L25) |
| HTTP call → `/api/v1/ingest/report` | same folder | [sync_service.dart:133-193](j1-device-edge/mobile_app/lib/services/sync_service.dart#L133-L193) builds the body and POSTs with `Idempotency-Key` header |
| Endpoint constant | constants | [constants.dart:20](j1-device-edge/mobile_app/lib/utills/constants.dart#L20) → `apiIngestEndpoint = '/api/v1/ingest/report'` |
| J1 Bridge API entry | [j1-device-edge/backend/app/](j1-device-edge/backend/app/) | [main.py](j1-device-edge/backend/app/main.py) — FastAPI on port 8081 |
| Route handler | backend routes | [routes/events.py](j1-device-edge/backend/app/routes/events.py) — `POST /api/v1/ingest/report` |
| Validation (10-char min description, lat/lon range, etc.) | backend | [validation.py](j1-device-edge/backend/app/validation.py) — class `ReportIngestionValidator` |
| Idempotency check (LRU, 50k keys, thread-safe) | backend | [idempotency.py](j1-device-edge/backend/app/idempotency.py) |
| Kafka publish | backend | [kafka_producer.py:43-51](j1-device-edge/backend/app/kafka_producer.py#L43-L51) — `publish_sos_report()` writes to `j1.sos.raw-reports` |
| J2 consumer (downstream) | J2 codebase | `j2-data-intelligence/app/services/kafka_consumer*.py` |

### What to point to on screen

If the examiner asks "show me where the mobile app actually calls the API":

```dart
// j1-device-edge/mobile_app/lib/services/sync_service.dart:136-147
final baseUrl = await dbHelper.getApiBaseUrl();
final uri = Uri.parse('$baseUrl${AppConstants.apiIngestEndpoint}');
final request = await client.postUrl(uri).timeout(...);
request.headers.contentType = ContentType.json;
request.headers.set('Idempotency-Key', event.eventId);
```

If asked "show me the exact Kafka publish":

```python
# j1-device-edge/backend/app/kafka_producer.py:43-51
def publish_sos_report(self, payload: dict[str, Any]) -> None:
    event_id = payload.get("eventId", "")
    self._producer.produce(
        topic=_TOPIC_SOS_REPORTS,
        key=event_id.encode("utf-8"),
        value=json.dumps(payload).encode("utf-8"),
        callback=_delivery_report,
    )
    self._producer.flush(timeout=10)
```

---

## Pipeline 2 — ESP32 Sensors → LoRa → Central Node → MQTT → Kafka

```
ESP32 Flood Node  ──┐
                    │ LoRa 433MHz
ESP32 Landslide ────┤
                    ▼
             Central Node (ESP32)
                    │ MQTT TLS :8883
                    ▼
         HiveMQ Cloud Broker
                    │
                    ▼
         J1 MQTT Forwarder
         (normalises payload)
                    │  publishes to
                    ▼
         Kafka: j1.sensor.telemetry
                    │
                    ▼
         J2 Sensor Consumer
```

| Stage | Where the code lives | Key file(s) |
|---|---|---|
| Flood sensor firmware (DHT11 + ultrasonic depth) | [j1-device-edge/Flood_Node/](j1-device-edge/Flood_Node/) | [src/main.cpp](j1-device-edge/Flood_Node/src/main.cpp) — sends LoRa JSON with `id: "J1_TX_01"`, `type: "FLOOD"` at 433MHz |
| Landslide sensor firmware (DHT11 + soil moisture + MPU6050 gyro) | [j1-device-edge/Landside_Node/](j1-device-edge/Landside_Node/) | [src/main.cpp](j1-device-edge/Landside_Node/src/main.cpp) — sends LoRa JSON with `id: "J1_TX_02"`, `type: "LANDSLIDE"` |
| LoRa→MQTT gateway (the Central Node) | [j1-device-edge/Central_Node/](j1-device-edge/Central_Node/) | [src/central_node.cpp](j1-device-edge/Central_Node/src/central_node.cpp) — receives LoRa, repairs corrupted JSON, publishes to HiveMQ over TLS |
| MQTT topic routing in firmware | same file | [central_node.cpp:271-283](j1-device-edge/Central_Node/src/central_node.cpp#L271-L283) — `resolveMqttTopic()` returns `j1/disaster/flood` or `j1/disaster/landslide` |
| HiveMQ Cloud broker config (hardcoded in firmware) | same file | [central_node.cpp:13-15](j1-device-edge/Central_Node/src/central_node.cpp#L13-L15) — `8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud`, user `j1_gateway` |
| Offline buffer (LittleFS, 1MB) | same file | [central_node.cpp:65-101](j1-device-edge/Central_Node/src/central_node.cpp#L65-L101) — buffers packets if WiFi/MQTT drops, syncs on reconnect |
| MQTT Forwarder (subscribes to HiveMQ, publishes to Kafka) | [j1-device-edge/backend/app/](j1-device-edge/backend/app/) | [mqtt_kafka_bridge.py](j1-device-edge/backend/app/mqtt_kafka_bridge.py) — subscribes to `j1/disaster/flood` and `j1/disaster/landslide` |
| Payload normalisation | same file | [mqtt_kafka_bridge.py:45-74](j1-device-edge/backend/app/mqtt_kafka_bridge.py#L45-L74) — `_normalise_payload()` builds the standard sensor-telemetry shape |
| Kafka publish (telemetry) | backend | [kafka_producer.py:53-61](j1-device-edge/backend/app/kafka_producer.py#L53-L61) — `publish_sensor_telemetry()` writes to `j1.sensor.telemetry` |
| J2 consumer (downstream) | J2 codebase | `j2-data-intelligence/app/services/kafka_consumer*.py` |

### What to point to on screen

If asked "show me where the firmware decides which MQTT topic":

```cpp
// j1-device-edge/Central_Node/src/central_node.cpp:271-283
static String resolveMqttTopic(const JsonDocument& doc) {
    String nodeId = doc["node_id"] | doc["id"] | "";
    String type = doc["type"] | "";
    if (nodeId == "J1_TX_01" || type == "FLOOD") return "j1/disaster/flood";
    if (nodeId == "J1_TX_02" || type == "LANDSLIDE") return "j1/disaster/landslide";
    return "";
}
```

If asked "show me the MQTT-to-Kafka bridge":

```python
# j1-device-edge/backend/app/mqtt_kafka_bridge.py:92-114
def on_message(client, userdata, msg):
    raw = json.loads(msg.payload.decode("utf-8"))
    normalised = _normalise_payload(raw, msg.topic)
    kafka_producer.publish_sensor_telemetry(normalised)
```

---

## 3. Where Kafka topic names are written in the code

Kafka topics are **defined once as constants/env vars** and used wherever a producer or consumer needs them. There are only two topics on the J1 side.

### Definitions (where the strings are declared)

| Topic | Defined in | Line |
|---|---|---|
| `j1.sos.raw-reports` | [j1-device-edge/backend/app/config.py:14](j1-device-edge/backend/app/config.py#L14) | `KAFKA_TOPIC_SOS_REPORTS = os.getenv("KAFKA_TOPIC_SOS_REPORTS", "j1.sos.raw-reports")` |
| `j1.sensor.telemetry` | [j1-device-edge/backend/app/config.py:15](j1-device-edge/backend/app/config.py#L15) | `KAFKA_TOPIC_SENSOR_TELEMETRY = os.getenv("KAFKA_TOPIC_SENSOR_TELEMETRY", "j1.sensor.telemetry")` |
| Also re-read by the producer module directly | [j1-device-edge/backend/app/kafka_producer.py:21-22](j1-device-edge/backend/app/kafka_producer.py#L21-L22) | `_TOPIC_SOS_REPORTS`, `_TOPIC_SENSOR_TELEMETRY` (same env vars, fallback defaults) |

### Producer call sites (where messages are written to the topic)

| Topic | Producer call | File:line |
|---|---|---|
| `j1.sos.raw-reports` | `kafka_producer.publish_sos_report(...)` invoked from `POST /api/v1/ingest/report` | [routes/events.py:79](j1-device-edge/backend/app/routes/events.py#L79) → executes [kafka_producer.py:43-51](j1-device-edge/backend/app/kafka_producer.py#L43-L51) |
| `j1.sensor.telemetry` | `kafka_producer.publish_sensor_telemetry(...)` invoked from `POST /api/v1/ingest/sensor` | [routes/events.py:139](j1-device-edge/backend/app/routes/events.py#L139) → executes [kafka_producer.py:53-61](j1-device-edge/backend/app/kafka_producer.py#L53-L61) |
| `j1.sensor.telemetry` | also written by the MQTT forwarder | [mqtt_kafka_bridge.py:105](j1-device-edge/backend/app/mqtt_kafka_bridge.py#L105) |

### Environment-variable injection (where Docker / PowerShell sets them)

| Location | Topic env vars set |
|---|---|
| [docker-compose.yml:72-73](docker-compose.yml#L72-L73) (root, `j1-bridge-api`) | `KAFKA_TOPIC_SOS_REPORTS`, `KAFKA_TOPIC_SENSOR_TELEMETRY` |
| [docker-compose.yml:99-100](docker-compose.yml#L99-L100) (root, `j1-mqtt-forwarder`) | same |
| [j1-device-edge/docker-compose.yml:30-31, 57-58](j1-device-edge/docker-compose.yml#L30-L31) | same |
| [j1-device-edge/.env.example:3-4](j1-device-edge/.env.example#L3-L4) | same |
| [start_platform.ps1:50-51, 60-61](start_platform.ps1#L50-L51) | same |

**Key point for viva:** topic names live in **one place** (env vars with defaults in `config.py` / `kafka_producer.py`). Every other file just reads them — that's how it should be.

### Topics also appear in:
- [k8s/infrastructure/kafka.yaml](k8s/infrastructure/kafka.yaml) — pre-creation declarations for the K8s deployment
- [j2-data-intelligence/app/](j2-data-intelligence/app/) — J2 reads the same two topics on the consumer side

---

## 4. Renaming `mqtt_kafka_bridge` → `mqtt_kafka_bridge`

The current name is genuinely misleading — there's no HTTP anywhere; it's a pure **MQTT → Kafka** bridge. `mqtt_kafka_bridge` is more accurate.

**Do not change yet** — these are the eight places that would need to be edited if you decide to rename later. The module is invoked as a Python module path (`app.mqtt_kafka_bridge`), so renaming the file means renaming every reference.

### Files that would need to change

| File | Line | Current reference | What to change to |
|---|---|---|---|
| [j1-device-edge/backend/app/mqtt_kafka_bridge.py](j1-device-edge/backend/app/mqtt_kafka_bridge.py) | filename + line 6 docstring | `python -m app.mqtt_kafka_bridge` | rename file to `mqtt_kafka_bridge.py`; update docstring |
| [docker-compose.yml](docker-compose.yml) | 96 | `command: ["python", "-m", "app.mqtt_kafka_bridge"]` | `app.mqtt_kafka_bridge` |
| [j1-device-edge/docker-compose.yml](j1-device-edge/docker-compose.yml) | 54 | `command: ["python", "-m", "app.mqtt_kafka_bridge"]` | same |
| [start_platform.ps1](start_platform.ps1) | 62 | `python -m app.mqtt_kafka_bridge` | same |
| [stop_platform.ps1](stop_platform.ps1) | 2 | comment "Kills all Python uvicorn and mqtt_kafka_bridge processes" | update comment |
| [j1-device-edge/DOCKER_NOTES.md](j1-device-edge/DOCKER_NOTES.md) | 16 | docs | update doc |
| [SYSTEM_ANALYSIS.md](SYSTEM_ANALYSIS.md) | 236 | docs | update doc |
| [docs/SYSTEM_ANALYSIS.md](docs/SYSTEM_ANALYSIS.md) | 144 | docs | update doc |

Logger name `j1.mqtt_forwarder` ([mqtt_kafka_bridge.py:28](j1-device-edge/backend/app/mqtt_kafka_bridge.py#L28)) is fine as-is, but if you want to be thorough rename it to `j1.mqtt_kafka_bridge`.

That's the entire blast radius — eight grep hits, all checked. No Kubernetes manifests reference it (good), no test files reference it (good), no Python imports reference it as a name (it's only ever invoked as a CLI module, never imported).

### Should it stay in `backend/`?

**Yes, it should stay in `j1-device-edge/backend/`.** Reasoning:

1. **It is a backend service**, not a device-side component. The "backend" folder contains the two server-side Python services (Bridge API + MQTT Forwarder). The other folders in `j1-device-edge/` (`Flood_Node/`, `Landside_Node/`, `Central_Node/`, `mobile_app/`) all contain on-device code (C++ firmware, Flutter app) that runs on physical hardware. The forwarder runs on a server.
2. **It shares code with the Bridge API.** It imports `from .kafka_producer import kafka_producer` ([mqtt_kafka_bridge.py:22](j1-device-edge/backend/app/mqtt_kafka_bridge.py#L22)) — that producer module lives in the same `app/` package. Splitting it out would require either duplicating `kafka_producer.py` or making both packages depend on a third shared library.
3. **They share the same Dockerfile and `requirements.txt`.** One image is built and both services run from it with different `CMD` overrides. Moving the forwarder out would mean a second Dockerfile, a second pip install, a second image — extra build time and complexity for no benefit.
4. **It's a backend concern semantically.** "Devices" in this folder hierarchy means actual sensor hardware. The MQTT bridge is the *server* listening for what those devices publish.

So: rename is reasonable, **moving is not.**

---

## 5. Where is the Bridge API?

**Folder:** [j1-device-edge/backend/](j1-device-edge/backend/)
**Entry point:** [j1-device-edge/backend/app/main.py](j1-device-edge/backend/app/main.py)
**Port:** `8081` (host) → `8081` (container)
**Framework:** FastAPI + uvicorn
**Launch command:** `uvicorn app.main:app --host 0.0.0.0 --port 8081`

### Full route list (every endpoint the Bridge API exposes)

| Method | Path | Handler file | Purpose |
|---|---|---|---|
| GET | `/` | [main.py:44-57](j1-device-edge/backend/app/main.py#L44-L57) | Service info banner |
| GET | `/health` | [routes/health.py](j1-device-edge/backend/app/routes/health.py) | Liveness/readiness probe |
| GET | `/docs` | (auto-generated by FastAPI) | Swagger UI |
| POST | `/api/v1/ingest/report` | [routes/events.py:26-86](j1-device-edge/backend/app/routes/events.py#L26-L86) | SOS report from mobile app → Kafka `j1.sos.raw-reports` |
| POST | `/api/v1/ingest/sensor` | [routes/events.py:89-151](j1-device-edge/backend/app/routes/events.py#L89-L151) | Sensor telemetry → Kafka `j1.sensor.telemetry` |
| GET | `/api/v1/resources` | [routes/resources.py](j1-device-edge/backend/app/routes/resources.py) | Returns 12 mock shelters/teams for offline cache in the mobile app |
| GET | `/api/v1/debug/kafka-test` | [routes/debug.py](j1-device-edge/backend/app/routes/debug.py) | Test Kafka connectivity (dev-only) |

### Bridge API module map (every Python file in the service)

```
j1-device-edge/backend/app/
├── __init__.py                         (package marker)
├── main.py                             FastAPI app setup, CORS, router registration
├── config.py                           Settings class (env-var loading)
├── models.py                           Pydantic request/response schemas
├── validation.py                       Field validation (lat/lon range, min description length, etc.)
├── idempotency.py                      Thread-safe LRU dedup store (50k keys)
├── kafka_producer.py                   Kafka producer wrapper (publish_sos_report, publish_sensor_telemetry)
├── mqtt_kafka_bridge.py              MQTT→Kafka bridge (runs as separate process, shares this same package)
└── routes/
    ├── __init__.py                     (package marker)
    ├── health.py                       GET /health
    ├── events.py                       POST /api/v1/ingest/report, POST /api/v1/ingest/sensor
    ├── resources.py                    GET /api/v1/resources
    └── debug.py                        GET /api/v1/debug/kafka-test
```

---

## 6. Dockerfiles — do we have enough?

J1 has **one Dockerfile** that builds an image used to run **two services**:

| Service | Dockerfile used | Build context | Run command |
|---|---|---|---|
| **j1-bridge-api** | [j1-device-edge/backend/Dockerfile](j1-device-edge/backend/Dockerfile) | `./j1-device-edge/backend` | (default `CMD`) `uvicorn app.main:app --host 0.0.0.0 --port 8081` |
| **j1-mqtt-forwarder** | same Dockerfile, same image | `./j1-device-edge/backend` | overridden in compose: `python -m app.mqtt_kafka_bridge` |

This is **correct as-is for J1** — both services share `kafka_producer.py`, identical Python dependencies, and the same Pydantic models. Building two images would duplicate ~150 MB of layers for no benefit.

### What about the IoT firmware and the mobile app?

- **ESP32 firmware (Flood_Node, Landside_Node, Central_Node):** No Dockerfile needed and none should be added. These are PlatformIO C++ projects that compile to ESP32 binaries flashed onto physical microcontrollers. Their build is `pio run`, not `docker build`. The existing CI for the firmware is [j1-device-edge/Flood_Node/.github/workflows/pio_build.yml](j1-device-edge/Flood_Node/.github/workflows/pio_build.yml).
- **Flutter mobile app:** No Dockerfile needed. Mobile apps are built with `flutter build apk` / `flutter build ipa` for distribution to phones, not containers. (A Docker build for the *Flutter SDK* could be added for a reproducible CI build environment, but that's a CI optimisation, not a deployment artefact.)

### Across the whole platform (for context)

| Subgroup | Dockerfile(s) | Builds |
|---|---|---|
| **J1** | `j1-device-edge/backend/Dockerfile` | Bridge API + MQTT Forwarder (one image, two containers) |
| **J2** | `j2-data-intelligence/Dockerfile` | Data intelligence FastAPI service |
| **J3** | `j3-system-interaction/dms/Dockerfile`, `Dockerfile.mock` | Dashboard (Next.js multi-stage), Event Bridge |
| **J4** | `j4-platform-security/blockchain-audit/Dockerfile`, `Dockerfile.hardhat`, `Dockerfile.deployer` | Audit API, Hardhat node, one-time contract deployer |

### Verdict

**For J1 specifically — no additional Dockerfiles needed.** The current setup is intentional and correct:
- 1 Dockerfile → 1 image → 2 running containers via different `command:` overrides.
- Firmware and mobile app deliberately have no Dockerfile (they're not server software).

If during the viva someone says *"why don't you have separate Dockerfiles for each microservice?"*, your answer is: **because the two services share 100% of their code dependencies and build steps. Splitting the Dockerfile would mean duplicating identical pip installs and identical layer caches with zero deployment benefit. The Docker pattern for sharing an image across services is exactly to override `command:` at the compose level, which is what we do.**

---

## 7. Full J1 system analysis

### What J1 is responsible for

J1 owns the **edge layer** — every component that produces data from the physical world or from end-users, plus the thin server-side adapters that funnel that data onto the Kafka event bus. After J1 hands a message to Kafka, J2/J3/J4 take over. J1 does not own any business logic, ML, dashboards, auth, or storage.

### Component inventory

```
j1-device-edge/
├── Central_Node/        ESP32 firmware — LoRa receiver + MQTT TLS gateway
├── Flood_Node/          ESP32 firmware — flood sensor (DHT11 + ultrasonic depth)
├── Landside_Node/       ESP32 firmware — landslide sensor (DHT11 + soil moisture + MPU6050 IMU)
├── mobile_app/          Flutter app — citizen SOS reporting + offline queue + resource catalog
├── backend/             Python services
│   ├── Bridge API       FastAPI on :8081 (HTTP → Kafka)
│   └── MQTT Forwarder   paho-mqtt subscriber (HiveMQ → Kafka)
├── docker-compose.yml   Local J1-only dev stack (uses external disaster-net)
└── .env.example         Env-var template
```

### End-to-end data flows

**Flow A: Mobile → Bridge API → Kafka**

1. Citizen fills `help_request_form.dart` or `data_report_form.dart`
2. Event is written to SQLite via [database_helper.dart](j1-device-edge/mobile_app/lib/services/database_helper.dart) with `status='QUEUED'`
3. [sync_service.dart](j1-device-edge/mobile_app/lib/services/sync_service.dart) polls every 30s ([constants.dart:25](j1-device-edge/mobile_app/lib/utills/constants.dart#L25))
4. If `/health` returns 200 ([network_service.dart](j1-device-edge/mobile_app/lib/services/network_service.dart)), it POSTs `/api/v1/ingest/report` with `Idempotency-Key: <eventId>`
5. Bridge API ([events.py](j1-device-edge/backend/app/routes/events.py)) validates the payload, checks idempotency, publishes to Kafka, returns 201
6. SQLite row flips to `status='SUBMITTED'`. 409 → `DUPLICATE`. 422/400 → `FAILED` (no retry). Otherwise → retry with exponential backoff (max 5 attempts).

**Flow B: ESP32 sensors → LoRa → Central Node → MQTT → MQTT Forwarder → Kafka**

1. Flood_Node ([main.cpp:99-141](j1-device-edge/Flood_Node/src/main.cpp#L99-L141)) reads DHT11 + ultrasonic, emits `{"id":"J1_TX_01","type":"FLOOD","temp":...,"hum":...,"depth":...}` over LoRa every ~1.2s
2. Landside_Node ([main.cpp:99-167](j1-device-edge/Landside_Node/src/main.cpp#L99-L167)) reads DHT11 + soil moisture + MPU6050, emits `{"id":"J1_TX_02","type":"LANDSLIDE",...}` every ~3.7s
3. Central_Node ([central_node.cpp](j1-device-edge/Central_Node/src/central_node.cpp)) receives LoRa, repairs corrupted JSON ([normalizeLoRaJson](j1-device-edge/Central_Node/src/central_node.cpp#L204-L269)), thresholds out non-critical readings (depth < 3cm, moisture < 40%), publishes to HiveMQ Cloud over TLS to `j1/disaster/flood` or `j1/disaster/landslide`
4. If WiFi/MQTT drops, the Central Node buffers up to 1 MB on LittleFS and replays on reconnect ([central_node.cpp:65-182](j1-device-edge/Central_Node/src/central_node.cpp#L65-L182))
5. MQTT Forwarder ([mqtt_kafka_bridge.py](j1-device-edge/backend/app/mqtt_kafka_bridge.py)) subscribes to both topics, normalises each payload, publishes to `j1.sensor.telemetry`

### Resilience features in J1

| Layer | Mechanism | Where |
|---|---|---|
| Mobile app | Offline SQLite queue + auto-retry with exponential backoff | [sync_service.dart:74-131](j1-device-edge/mobile_app/lib/services/sync_service.dart#L74-L131) |
| Mobile app | Idempotency-Key header prevents duplicate Kafka messages | [sync_service.dart:147](j1-device-edge/mobile_app/lib/services/sync_service.dart#L147) |
| Mobile app | Resources cached locally for offline browsing | [resource_service.dart](j1-device-edge/mobile_app/lib/services/resource_service.dart) |
| Central Node firmware | LittleFS buffer up to 1 MB during WiFi outage | [central_node.cpp:65-182](j1-device-edge/Central_Node/src/central_node.cpp#L65-L182) |
| Central Node firmware | Watchdog reboot after 45s of no LoRa packets | [central_node.cpp:421-430](j1-device-edge/Central_Node/src/central_node.cpp#L421-L430) |
| Sensor nodes | Hourly scheduled reboot to clear radio state | [Flood_Node/main.cpp:89-93](j1-device-edge/Flood_Node/src/main.cpp#L89-L93), [Landside_Node/main.cpp:86-90](j1-device-edge/Landside_Node/src/main.cpp#L86-L90) |
| Bridge API | Idempotency LRU store (50k keys, thread-safe) | [idempotency.py](j1-device-edge/backend/app/idempotency.py) |
| Bridge API | Strict validation rejects malformed payloads at the edge | [validation.py](j1-device-edge/backend/app/validation.py) |
| MQTT Forwarder | Auto-reconnect with 5s back-off on disconnect | [mqtt_kafka_bridge.py:135-143](j1-device-edge/backend/app/mqtt_kafka_bridge.py#L135-L143) |

### External dependencies J1 makes

| Dependency | Used by | Purpose |
|---|---|---|
| Kafka (`kafka:29092` Docker / `localhost:9092` host) | Bridge API, MQTT Forwarder | Outbound event bus |
| HiveMQ Cloud (`...hivemq.cloud:8883`) | Central Node firmware, MQTT Forwarder | MQTT TLS broker |
| WiFi network | Central Node firmware | Internet access for MQTT |
| LoRa 433MHz spectrum | All ESP32 nodes | Wireless sensor → gateway link |
| J1 Bridge API (`localhost:8081`) | Mobile app | HTTP ingestion target |

J1 has **no database, no external API calls outbound**, no auth dependency. That's intentional — the edge layer's job is to push raw events to Kafka, and Kafka is the single source of truth from then on.

### Known risks (be ready to acknowledge)

- **Hardcoded HiveMQ credentials in `central_node.cpp` ([line 14-15](j1-device-edge/Central_Node/src/central_node.cpp#L14-L15)) and `.env.example` ([line 9](j1-device-edge/.env.example#L9))** — committed to git. Should be rotated and moved to a build-time inject for firmware and to Vault for the forwarder.
- **In-memory idempotency store loses state on restart** — duplicate Kafka messages possible after a Bridge API restart. Production would need Redis.
- **CORS is set to `*`** ([main.py:30-36](j1-device-edge/backend/app/main.py#L30-L36)) — wide open. Fine for the viva, not for production.
- **Mobile app does no auth** when calling the Bridge API. Acceptable for citizen SOS (the threat model is spam, mitigated by idempotency keys), but Kong + Keycloak coverage is in J4's scope.
- **Sensor firmware uses `setInsecure()`** ([central_node.cpp:345](j1-device-edge/Central_Node/src/central_node.cpp#L345)) — skips TLS certificate validation. Pragmatic for ESP32 memory constraints, but a documented risk.

---

## 8. Testing plan — what to add (don't add yet, just decide)

Below is **a proposal**, not an action plan. Pick what you want demonstrated for the viva and tell me which ones to implement.

Current state of J1 tests:

| Layer | What exists today |
|---|---|
| Bridge API | [test_kafka.py](j1-device-edge/backend/test_kafka.py) — a single manual Kafka connectivity check. No pytest, no fixtures, no CI integration. |
| MQTT Forwarder | Nothing |
| Mobile app | [test/widget_test.dart](j1-device-edge/mobile_app/test/widget_test.dart) — one Flutter widget test (close to the auto-generated default) |
| ESP32 firmware | Nothing |
| End-to-end | Nothing automated |

### Proposed test pyramid for J1

#### Unit tests (Bridge API — Python, pytest)

| Test file | What it covers | Framework |
|---|---|---|
| `j1-device-edge/backend/tests/test_validation.py` | `ReportIngestionValidator` and `SensorIngestionValidator` — covers all field rules: empty strings, out-of-range coords, sub-10-char descriptions, invalid disaster types, missing sensor readings. Pure functions, no mocks needed. | pytest |
| `j1-device-edge/backend/tests/test_idempotency.py` | `IdempotencyStore` — `add`/`contains`/`size`, LRU eviction past 50k, thread-safety using `threading` to hammer the store from multiple threads. | pytest |
| `j1-device-edge/backend/tests/test_kafka_producer.py` | `KafkaProducerService` — mock `confluent_kafka.Producer`, assert correct topic, key, JSON-encoded value, and that `flush()` is called. | pytest + `unittest.mock` |
| `j1-device-edge/backend/tests/test_normalise_payload.py` | `_normalise_payload()` from the MQTT forwarder — hardcoded ESP32 payload in, expected normalised dict out (covers `id` vs `deviceId` aliasing, hazard type uppercase, event ID format). | pytest |

#### Component tests (Bridge API routes, in-process)

| Test file | What it covers | Framework |
|---|---|---|
| `j1-device-edge/backend/tests/test_events_route.py` | `POST /api/v1/ingest/report` and `/sensor` — uses `fastapi.testclient.TestClient` against the app with the Kafka producer monkey-patched. Covers: 201 happy path, 409 duplicate, 422 validation errors, 400 idempotency-key mismatch. | pytest + FastAPI TestClient |
| `j1-device-edge/backend/tests/test_health_route.py` | `GET /health` — trivial but it's the contract the mobile app relies on (status + service string). | pytest |
| `j1-device-edge/backend/tests/test_resources_route.py` | `GET /api/v1/resources` — query filters (type, district, status). | pytest |

#### Component tests (Mobile app — Dart, Flutter test)

| Test file | What it covers | Framework |
|---|---|---|
| `j1-device-edge/mobile_app/test/services/sync_service_test.dart` | Mocks `HttpClient` and `DatabaseHelper`. Covers: queue → submit happy path, 409 → marks DUPLICATE, 422 → marks FAILED (no retry), 5xx → retries with backoff and increments `sync_attempts`. | flutter_test + mockito |
| `j1-device-edge/mobile_app/test/services/database_helper_test.dart` | In-memory SQLite via `sqflite_common_ffi`. Tests event insertion, status transitions, queue ordering. | flutter_test + sqflite_common_ffi |
| `j1-device-edge/mobile_app/test/services/network_service_test.dart` | Mocks `http.get`, asserts `isOnline()` returns `true` only when response body has `status:"ok"` AND `service:"j1-bridge-api"`. | flutter_test + mockito |

#### System / integration tests

| Test | What it proves | How |
|---|---|---|
| `j1-device-edge/backend/tests/integration/test_kafka_flow.py` | A POST to `/api/v1/ingest/report` actually lands a message on `j1.sos.raw-reports`. | pytest + `testcontainers` (spins up real Kafka in Docker) OR a `pytest.mark.integration` test against the running `docker compose` Kafka |
| `j1-device-edge/backend/tests/integration/test_mqtt_to_kafka.py` | Publishing to an MQTT topic results in a normalised message on `j1.sensor.telemetry`. | testcontainers Mosquitto + Kafka, run the forwarder as a subprocess |
| `j1-device-edge/backend/tests/integration/test_idempotency_e2e.py` | Same Idempotency-Key sent twice → 201 then 409, exactly one Kafka message. | TestClient + mocked Kafka producer that records calls |
| `tests/e2e/test_mobile_to_kafka.sh` | Smoke script: `curl` the Bridge API with a real payload, then `kafka-console-consumer` to verify the message arrived. | bash + Kafka CLI inside the docker-compose network |

#### CI integration

Add a `j1-tests` job to [.github/workflows/ci.yml](.github/workflows/ci.yml) that runs:
1. `pip install -r j1-device-edge/backend/requirements.txt pytest pytest-asyncio`
2. `pytest j1-device-edge/backend/tests/ -m "not integration"` (unit + component)
3. For PRs to `main`: also run `-m integration` (boots Kafka via `docker compose up -d kafka`)

For Flutter:
1. `flutter pub get` in `j1-device-edge/mobile_app/`
2. `flutter test`

#### What to **realistically add for viva** (minimum viable evidence)

If you want testing to *look* present but stay scoped:

1. **`test_validation.py`** — ~15 quick assertions over `ReportIngestionValidator`. Pure functions, no infra, runs in < 1s. Easy win.
2. **`test_idempotency.py`** — ~6 assertions over `IdempotencyStore`. Tiny.
3. **`test_events_route.py`** with FastAPI TestClient — proves the route layer wires together correctly, even with a mocked Kafka producer.
4. Optionally one **Flutter widget test** for `help_request_form.dart` that asserts the form fields render and a "submit when empty" tap shows the expected error.
5. A short **`docs/J1_TESTING.md`** describing the strategy and pointing at the above — this is what an examiner skims first.

That's roughly 100–150 lines of test code total and gives you concrete, runnable artefacts to show. Tell me which of these to implement and I'll add them (and only them — no scope creep).

---

## Quick reference card (keep open during the viva)

| Question | Answer | Where |
|---|---|---|
| What language is the Bridge API? | Python 3.11 / FastAPI | [j1-device-edge/backend/app/main.py](j1-device-edge/backend/app/main.py) |
| What port does the Bridge API listen on? | 8081 | [docker-compose.yml:69](docker-compose.yml#L69) |
| What Kafka topics does J1 produce to? | `j1.sos.raw-reports`, `j1.sensor.telemetry` | [config.py:14-15](j1-device-edge/backend/app/config.py#L14-L15) |
| Where does the MQTT bridge connect? | HiveMQ Cloud (port 8883, TLS) | [.env.example:7-8](j1-device-edge/.env.example#L7-L8) |
| How does the mobile app survive offline? | SQLite queue + 30s sync poll + exponential backoff retry | [sync_service.dart](j1-device-edge/mobile_app/lib/services/sync_service.dart) |
| How does the firmware survive WiFi loss? | LittleFS buffer up to 1 MB, replay on reconnect | [central_node.cpp:65-182](j1-device-edge/Central_Node/src/central_node.cpp#L65-L182) |
| How are duplicates prevented? | `Idempotency-Key` header + 50k LRU store | [idempotency.py](j1-device-edge/backend/app/idempotency.py) |
| What sensors does Flood Node use? | DHT11 (temp/humidity) + HC-SR04 ultrasonic (depth) | [Flood_Node/src/main.cpp:9-13](j1-device-edge/Flood_Node/src/main.cpp#L9-L13) |
| What sensors does Landslide Node use? | DHT11 + capacitive soil moisture + MPU6050 (accel/gyro) | [Landside_Node/src/main.cpp:10-12](j1-device-edge/Landside_Node/src/main.cpp#L10-L12) |
