# J1 Testing Guide

This document describes how to test the J1 device-edge layer in a way that is easy to explain in a viva.

## Testing Goal

The goal of testing J1 is to prove that:

- valid disaster reports are accepted
- invalid inputs are rejected with clear errors
- duplicate submissions are blocked using idempotency
- sensor readings are normalized correctly
- resources can be fetched through a simple API
- the backend stays stable when J2 is unavailable

## What Should Be Tested

### 1. Health Endpoint

Test:

- `GET /health`

Expected:

- response status `200`
- service name is `j1-bridge-api`
- idempotency store size is returned

Why it matters:

- proves the backend is running
- gives a quick system check during a demo

### 2. Report Ingestion

Test:

- `POST /api/v1/ingest/report`

Expected success:

- valid payload returns `201 Created`
- response contains `ACCEPTED`
- request is forwarded to J2

Validation failures:

- missing required fields return `422`
- invalid coordinates return `422`
- invalid timestamp returns `422`
- `Idempotency-Key` mismatch returns `400`

Duplicate behavior:

- same `eventId` sent again returns `409 Conflict`

Why it matters:

- shows the system protects data quality
- proves duplicate prevention works

### 3. Sensor Ingestion

Test:

- `POST /api/v1/ingest/sensor`

Expected success:

- valid payload returns `201 Created`
- response contains `ACCEPTED`
- sensor data is normalized before forwarding

Validation failures:

- no sensor reading values returns `422`
- invalid `hazardType` returns `422`
- invalid timestamp returns `422`
- `Idempotency-Key` mismatch returns `400`

Why it matters:

- demonstrates support for IoT and edge devices
- shows the API can handle both structured and raw payloads

### 4. Resources Endpoint

Test:

- `GET /api/v1/resources`
- `GET /api/v1/resources?type=SHELTER`
- `GET /api/v1/resources?district=Colombo`
- `GET /api/v1/resources?status=AVAILABLE`

Expected:

- response status `200`
- filtered results match the query

Why it matters:

- proves the app can fetch local emergency support data

### 5. Upstream Failure Handling

Test:

- stop or disconnect the J2 service
- send a valid report or sensor request

Expected:

- J1 returns `503 Service Unavailable`
- request is not treated as successfully accepted

Why it matters:

- proves the system fails safely
- the mobile app can retry later instead of losing data

## Manual Test Cases

| Test Case | Input | Expected Result |
|---|---|---|
| Health check | `GET /health` | `200 OK` and service details |
| Valid report | correct report payload + matching `Idempotency-Key` | `201 Created` |
| Duplicate report | same `eventId` twice | `409 Conflict` |
| Invalid report | missing `district` or `description` | `422 Unprocessable Entity` |
| Valid sensor reading | sensor payload with depth/temp/humidity/moisture | `201 Created` |
| Invalid sensor payload | no sensor values | `422 Unprocessable Entity` |
| Resource filter | `?district=Kandy` | Only Kandy resources |
| J2 unavailable | stop J2 and submit valid data | `503 Service Unavailable` |

## Suggested Demo Flow for Viva

1. Start the backend using Docker.
2. Open `http://localhost:8000/docs`.
3. Run the health endpoint first.
4. Submit one valid report request.
5. Repeat the same request to show duplicate protection.
6. Submit an invalid request to show validation.
7. Call the resources endpoint with a filter.
8. Explain that J1 forwards only valid, normalized data to J2.

## Sample Report Payload

```json
{
  "eventId": "b7f7ef54-5d72-4a9d-b6b1-5b2e4b0d5f10",
  "timestamp": "2026-05-17T10:30:00Z",
  "deviceId": "mobile-001",
  "disasterType": "FLOOD",
  "district": "Colombo",
  "latitude": 6.9271,
  "longitude": 79.8612,
  "description": "Water level rising in the area",
  "contact": "0771234567",
  "mediaUrls": [
    "https://example.com/photo1.jpg"
  ]
}
```

## Sample Sensor Payload

```json
{
  "eventId": "sensor-001",
  "timestamp": "2026-05-17T10:31:00Z",
  "deviceId": "iot-bridge-01",
  "hazardType": "LANDSLIDE",
  "depth": 1.2,
  "temperature": 28.4,
  "humidity": 86,
  "moisture": 74,
  "latitude": 7.2906,
  "longitude": 80.6337
}
```

## Viva Explanation Points

- Validation happens before forwarding, which reduces bad data reaching J2.
- Idempotency ensures retries do not create duplicates.
- The system returns clear HTTP codes so the mobile app can react properly.
- Resources are mocked locally so the UI can still show support options during development.
- The bridge is designed for reliability at the edge, where unstable connectivity is expected.

## Notes

- If you want, this testing guide can later be turned into automated unit tests.
- The current document is suitable for manual demonstration, lab submission, and viva explanation.

## Automated Test Files

The backend also now includes real test files in:

- `backend/tests/test_validation.py`
- `backend/tests/test_idempotency.py`
- `backend/tests/test_routes.py`

To run them from the `backend` folder:

```bash
python -m unittest discover -s tests -v
```
