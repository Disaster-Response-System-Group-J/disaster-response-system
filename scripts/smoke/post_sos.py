"""POST a test SOS report to j1-bridge-api.
Verifies: mobile app path → Kafka j1.sos.raw-reports → IncomingReport row.
"""
import uuid
import requests

EVENT_ID = str(uuid.uuid4())
BODY = {
    "eventId":      EVENT_ID,
    "deviceId":     "smoke-phone-01",
    "disasterType": "FLOOD",
    "district":     "Colombo",
    "latitude":     6.9271,
    "longitude":    79.8612,
    "description":  "Smoke test SOS — flood on Galle Road near Mount Lavinia",
    "contact":      "+94771234567",
    "mediaUrls":    [],
    "timestamp":    "2026-05-17T10:00:00Z",
}

r = requests.post(
    "http://localhost:8081/api/v1/ingest/report",
    json=BODY,
    headers={"Idempotency-Key": EVENT_ID},
    timeout=10,
)
print(f"HTTP {r.status_code}  {r.text}")
print(f"eventId = {EVENT_ID}")
print(f"  Check J2 logs: IncomingReport inserted: sosId={EVENT_ID}")

# Idempotency check — same event ID must return 409 with no second DB row
r2 = requests.post(
    "http://localhost:8081/api/v1/ingest/report",
    json=BODY,
    headers={"Idempotency-Key": EVENT_ID},
    timeout=10,
)
print(f"\nIdempotency re-send: HTTP {r2.status_code} (expected 409)")
