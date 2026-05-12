# J1 Bridge API

FastAPI service that bridges the Flutter mobile app to Kafka.

```text
Mobile App (HTTP POST) -> Bridge API -> Kafka topic j1.events
```

## Endpoints

| Method | Path | Purpose | Response |
|---|---|---|---|
| `POST` | `/api/v1/events/ingest` | Receive events from mobile app | `202`, `409`, or `503` |
| `GET` | `/api/v1/events` | List recent events for debugging | `200` |
| `GET` | `/api/v1/resources` | Mock emergency resources | `200` |
| `GET` | `/health` | Health check | `200` |
| `GET` | `/docs` | Swagger UI | `200` |

## Event Flow

1. Mobile app saves an event to SQLite with a UUID.
2. SyncService POSTs the event with `Idempotency-Key: <eventId>`.
3. Bridge validates the event and checks idempotency.
4. Bridge produces the event to Kafka topic `j1.events`.
5. Bridge returns `202 Accepted` after Kafka delivery is confirmed.
6. Mobile app marks the event as `SUBMITTED`.

Duplicate idempotency keys return `409 Conflict`. Kafka failures return `503 Service Unavailable` so the mobile app keeps the event queued and retries.

## Event Envelope

```json
{
  "eventId": "uuid-v4",
  "eventType": "HELP_REQUEST",
  "eventVersion": "1.0",
  "timestamp": "2026-05-07T00:00:00Z",
  "userId": "user-uuid",
  "deviceId": "device-uuid",
  "payload": {
    "request_type": "Medical help",
    "description": "Need assistance",
    "people_count": 3,
    "location": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612
  },
  "metadata": {
    "appVersion": "1.0.0"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:29092` | Kafka broker address |
| `KAFKA_TOPIC_EVENTS` | `j1.events` | Target Kafka topic |
| `KAFKA_PRODUCER_TIMEOUT` | `10` | Delivery timeout in seconds |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8000` | API port |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `IDEMPOTENCY_MAX_KEYS` | `50000` | Max in-memory idempotency keys |

Use the stack-level environment template at ../.env.example if you want to create a local .env file for Docker Compose.

## Run With Docker

From `J1-device-edge`:

```bash
docker compose up -d --build
```

## Run Locally Without Docker

Kafka must be reachable at `KAFKA_BOOTSTRAP_SERVERS`.

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
