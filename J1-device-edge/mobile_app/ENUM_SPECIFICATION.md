# Enum Specification

**Location:** J1-device-edge/mobile_app/ENUM_SPECIFICATION.md
**Purpose:** Definitive source of truth for all enums used by the mobile app. Values must match the backend Prisma schema exactly.

---

## 1) `ReportSource`
- Type: enum
- Backend values (must match exactly):
  - `J1_SOS_APP` — Reports created from the J1 SOS mobile app (this device)
  - `J3_PUBLIC_PORTAL` — Reports from the public web portal
  - `J1_SENSOR_SYSTEM` — Automated sensor/system-generated reports
  - `WEATHER_API` — Reports or alerts ingested from weather APIs
  - `OFFICER_CREATED` — Reports created manually by officers

Validation rules:
- Required for all `incoming_reports` created locally
- Mapping: mobile UI should store `ReportSource.J1_SOS_APP` as string `"J1_SOS_APP"` in SQLite and JSON payloads

---

## 2) `DisasterType`
- Type: enum
- Values:
  - `FLOOD`
  - `LANDSLIDE`
  - `OTHER`

Validation rules:
- Required for incoming reports; default to `OTHER` if unknown

---

## 3) `VerificationStatus`
- Type: enum
- Values:
  - `PENDING_REVIEW`
  - `VERIFIED`
  - `REJECTED`
  - `DUPLICATE`
  - `CONVERTED_TO_INCIDENT`

Validation rules:
- New local reports default to `PENDING_REVIEW` on backend creation
- Mobile must accept backend updates and persist them locally

---

## 4) `IncidentSeverity`
- Type: enum
- Values:
  - `LOW`
  - `MEDIUM`
  - `HIGH`
  - `CRITICAL`

Validation rules:
- Used on `confirmed_incidents`; mobile should treat as required for incidents

---

## 5) `IncidentStatus`
- Type: enum
- Values:
  - `ACTIVE`
  - `UNDER_RESPONSE`
  - `RESOLVED`
  - `CLOSED`

Validation rules:
- Use this to display state badges in UI; always persisted as string

---

## 6) `ResourceType`
- Type: enum
- Values:
  - `RESCUE_TEAM`
  - `BOAT`
  - `AMBULANCE`
  - `SHELTER`
  - `MEDICAL_TEAM`
  - `FOOD_WATER`

Validation rules:
- Required when creating or processing `resources` from backend

---

## 7) `ResourceStatus`
- Type: enum
- Values:
  - `AVAILABLE`
  - `ASSIGNED`
  - `BUSY`
  - `OUT_OF_SERVICE`

Validation rules:
- Stored as string; mobile UI should map to display-friendly labels

---

## 8) `AlertType`
- Type: enum
- Values:
  - `RISK_ALERT`
  - `PUBLIC_ALERT`
  - `SHELTER_CAPACITY`
  - `RESOURCE_SHORTAGE`
  - `INCIDENT_STATUS`

Validation rules:
- Use to categorize alerts in UI; backend will set `isPublic` and `isActive`

---

## 9) `UserRole`
- Type: enum
- Values:
  - `PUBLIC_USER`
  - `OFFICER`
  - `RESOURCE_MANAGER`
  - `ADMIN`

Validation rules:
- Used to gate UI features; mobile should cache current user's `role` in `users` table

---

## Serialization / Parsing Rules (Mobile)
- Persist enums in SQLite as their exact API strings (e.g. `"J1_SOS_APP"`).
- In Dart, implement `toApiValue()` and `fromApiValue(String)` helper methods for each enum.
- When serializing models for backend, always pass enum fields as strings.
- When parsing backend responses, validate enum strings; unknown values should map to safe default (e.g., `OTHER` for `DisasterType`) and log a warning.

Example helper (pseudocode):

```dart
// ReportSource helper
ReportSource fromApiValue(String v) {
  switch(v) {
    case 'J1_SOS_APP': return ReportSource.J1_SOS_APP;
    case 'J3_PUBLIC_PORTAL': return ReportSource.J3_PUBLIC_PORTAL;
    // ...
    default: return ReportSource.J1_SOS_APP; // fallback for local reports
  }
}

String toApiValue(ReportSource r) {
  return r.name; // or dedicated field to match exactly
}
```

---

## Display Mapping (UI friendly labels)
- `J1_SOS_APP` → "SOS App"
- `J3_PUBLIC_PORTAL` → "Public Portal"
- `J1_SENSOR_SYSTEM` → "Sensor System"
- `WEATHER_API` → "Weather API"
- `OFFICER_CREATED` → "Officer"

- `FLOOD` → "Flood"
- `LANDSLIDE` → "Landslide"
- `OTHER` → "Other"

- `PENDING_REVIEW` → "Pending review"
- `VERIFIED` → "Verified"
- `REJECTED` → "Rejected"
- `DUPLICATE` → "Duplicate"
- `CONVERTED_TO_INCIDENT` → "Converted"

- `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` → show colors green/yellow/orange/red

---

## Validation Rules Summary
- All required enum fields must be present for backend-bound payloads.
- Unknown enum values from backend must be handled gracefully and logged.
- Enum strings are case-sensitive and must match the backend exactly.

---

## Next Step
- Implement `lib/models/enums.dart` with these enums and helper methods (Step 4).

