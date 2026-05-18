# J1 Mobile App Tests (Flutter)

These tests focus on **J1 only** (mobile client behavior + J1 Bridge API contract):

- **Unit**: parsing/normalization + health-check logic
- **Component**: widget behavior using the real services (backed by a local fake J1 server)
- **System**: end-to-end inside one process (SQLite queue → SyncService → HTTP → status update)
- **Integration**: optional smoke test against a real running J1 backend

## Run

From `j1-device-edge/mobile_app/`:

- Run everything:
  - `flutter test`

- Run a subset (examples):
  - `flutter test test/unit`
  - `flutter test test/component`
  - `flutter test test/system`

## Optional: run against real J1 backend

The integration test is skipped unless you set `J1_INTEGRATION_BASE_URL`.

PowerShell example:

- `$env:J1_INTEGRATION_BASE_URL = "http://127.0.0.1:8081"`
- `flutter test test/integration/j1_real_backend_smoke_test.dart`

Notes:
- The integration smoke test only calls `/health` and `/api/v1/resources` (no Kafka publish side-effects).
