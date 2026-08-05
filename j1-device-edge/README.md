# J1 Device-Edge

Local development stack for the J1 Flutter mobile app and the HTTP-to-Kafka bridge.

## What This Starts

| Service | URL | Purpose |
|---|---|---|
| Bridge API | http://localhost:8000 | Receives mobile events and produces to Kafka |
| Swagger docs | http://localhost:8000/docs | API inspection and manual testing |
| Kafka UI | http://localhost:18085 | View topic `j1.events` and produced messages |
| Kafka external listener | localhost:29092 | Host access for Kafka tooling |

Kafka runs in KRaft mode. No Zookeeper service is used.

## Start The Backend Stack

```bash
docker compose up -d --build
```

Check health:

```bash
curl http://localhost:8000/health
```

Open Kafka UI at http://localhost:18085 and select the `j1-local` cluster.
The `j1.events` topic is created automatically when the bridge starts or when the first event is produced.

## Run The Flutter App

Android emulator default:

```bash
cd mobile_app
flutter pub get
flutter run
```

The app defaults to `http://10.0.2.2:8000`, which maps Android emulator traffic to your host machine.

Physical Android device on the same Wi-Fi/LAN:

```bash
flutter run --dart-define=J1_API_BASE_URL=http://<YOUR_PC_LAN_IP>:8000
```

Find your Windows LAN IP with:

```powershell
ipconfig
```

Use the IPv4 address of the active Wi-Fi/Ethernet adapter.

## End-To-End Test

1. Start Docker: `docker compose up -d --build`.
2. Run the mobile app.
3. Log in with the local mock account if needed.
4. Submit a help request or data report.
5. Confirm the request changes from `QUEUED` to `SUBMITTED`.
6. Open Kafka UI at http://localhost:18085.
7. Inspect topic `j1.events` and confirm the event payload is present.

## Useful Commands

```bash
docker compose logs -f j1-bridge-api
docker compose logs -f kafka
docker compose down
docker compose down -v
```

## API Contract

Mobile sync endpoint:

```http
POST /api/v1/events/ingest
Idempotency-Key: <eventId>
Content-Type: application/json
```

Successful produce returns `202 Accepted`. Duplicate idempotency keys return `409 Conflict`. If Kafka is unavailable, the bridge returns `503` so the mobile app keeps the event queued and retries later.


