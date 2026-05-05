# Step 3: Dart Model Design (Model → SQLite Mapping)

**Location:** `J1-device-edge/mobile_app/MODEL_DESIGN.md`
**Purpose:** Definitive design for Dart model classes and their SQLite mappings. This document guides implementation of model files and serialization logic.

---

## Design Principles
- Match backend field names and types where practical.
- Persist enums as exact API strings (use helper methods for conversion).
- Store timestamps as ISO 8601 UTC strings (`DateTime.toUtc().toIso8601String()`).
- Use JSON string for arrays (`mediaUrls`) in SQLite; parse to List<String> in Dart.
- Keep relations via UUID foreign keys (no JOIN-heavy logic on mobile).
- Provide `toMap()` and `fromMap()` for each model to interact with SQLite.
- Validate required fields in constructors and throw `ArgumentError` for invalid input.

---

## Models Summary
- `UserModel` → `users` table
- `IncomingReportModel` → `incoming_reports` table (primary mobile-write model)
- `ConfirmedIncidentModel` → `confirmed_incidents` table
- `ResourceModel` → `resources` table
- `AlertModel` → `alerts` table
- `SyncMetadataModel` → `sync_metadata` table

Each model file will live in `lib/models/` and be named `*_model.dart` (e.g., `incoming_report_model.dart`).

---

## 1) `UserModel` (lib/models/user_model.dart)

Fields:
- `id` String (UUID) — `user_id` TEXT PRIMARY KEY
- `email` String — `email` TEXT UNIQUE
- `name` String — `name` TEXT
- `role` UserRole (enum) — `role` TEXT
- `createdAt` DateTime — `created_at` TEXT (ISO 8601)

Dart types & SQLite types mapping:
- `String` ↔ `TEXT`
- `UserRole` ↔ `TEXT` (use `toApiValue()`)
- `DateTime` ↔ `TEXT` (ISO string)

Methods:
- `Map<String, dynamic> toMap()`
- `factory UserModel.fromMap(Map<String, dynamic> m)`
- `String toString()`

Validation:
- `email` must be non-empty and valid-ish (contains '@'); otherwise throw.
- `role` must map to enum; unknown -> `UserRole.PUBLIC_USER` as fallback.

Indexes/Constraints:
- Unique index on `email`.

---

## 2) `IncomingReportModel` (lib/models/incoming_report_model.dart)

Fields (mobile primary write model):
- `id` String (UUID) — `id` TEXT PRIMARY KEY
- `source` ReportSource — `source` TEXT
- `disasterType` DisasterType — `disaster_type` TEXT
- `district` String — `district` TEXT
- `latitude` double — `latitude` REAL
- `longitude` double — `longitude` REAL
- `description` String — `description` TEXT
- `contact` String? — `contact` TEXT NULLABLE
- `mediaUrls` List<String> — `media_urls` TEXT (JSON array)
- `verificationStatus` VerificationStatus — `verification_status` TEXT
- `createdAt` DateTime — `created_at` TEXT
- `reviewedAt` DateTime? — `reviewed_at` TEXT NULLABLE
- `officerNotes` String? — `officer_notes` TEXT NULLABLE
- `sosId` String? — `sos_id` TEXT NULLABLE
- `deviceId` String? — `device_id` TEXT NULLABLE
- `reviewedById` String? — `reviewed_by_id` TEXT NULLABLE (FK to `users`)
- `incidentId` String? — `incident_id` TEXT NULLABLE (FK to `confirmed_incidents`)
- `timestampSubmitted` DateTime? — `timestamp_submitted` TEXT NULLABLE

Serialization notes:
- `mediaUrls` stored as JSON string: `jsonEncode(mediaUrls)` in `toMap()`, `jsonDecode` in `fromMap()`.
- Enum fields use `.toApiValue()` on write and `fromApiValue()` on read.

Validation:
- Required: `source`, `disasterType`, `district`, `latitude`, `longitude`, `description`, `createdAt`.
- If `latitude` or `longitude` are missing or invalid, throw `ArgumentError`.

Indexes:
- Index on `verification_status` and `created_at`.

---

## 3) `ConfirmedIncidentModel` (lib/models/confirmed_incident_model.dart)

Fields:
- `id` String (UUID) — `id` TEXT PRIMARY KEY
- `title` String — `title` TEXT
- `disasterType` DisasterType — `disaster_type` TEXT
- `district` String — `district` TEXT
- `severity` IncidentSeverity — `severity` TEXT
- `status` IncidentStatus — `status` TEXT
- `latitude` double — `latitude` REAL
- `longitude` double — `longitude` REAL
- `description` String — `description` TEXT
- `publicVisibility` bool — `public_visibility` INTEGER (0/1)
- `affectedPeople` int — `affected_people` INTEGER
- `createdAt` DateTime — `created_at` TEXT
- `updatedAt` DateTime — `updated_at` TEXT

Helpers:
- `bool isActive() => status == IncidentStatus.ACTIVE`
- `bool isCritical() => severity == IncidentSeverity.CRITICAL`

Validation:
- `title`, `disasterType`, `severity`, `status`, `createdAt` required.

Indexes:
- Index on `status` and `created_at`.

---

## 4) `ResourceModel` (lib/models/resource_model.dart)

Fields:
- `id` String — `id` TEXT PRIMARY KEY
- `type` ResourceType — `type` TEXT
- `name` String — `name` TEXT
- `district` String — `district` TEXT
- `status` ResourceStatus — `status` TEXT
- `latitude` double? — `latitude` REAL NULLABLE
- `longitude` double? — `longitude` REAL NULLABLE
- `capacity` int? — `capacity` INTEGER NULLABLE
- `currentLoad` int? — `current_load` INTEGER NULLABLE
- `lastUpdated` DateTime — `last_updated` TEXT
- `incidentId` String? — `incident_id` TEXT NULLABLE
- `synced` bool — `synced` INTEGER (0/1)

Validation:
- `type`, `name`, `status` required.

Indexes:
- Index on `incident_id` and `status`.

---

## 5) `AlertModel` (lib/models/alert_model.dart)

Fields:
- `id` String — `id` TEXT PRIMARY KEY
- `type` AlertType — `type` TEXT
- `severity` IncidentSeverity — `severity` TEXT
- `title` String — `title` TEXT
- `description` String — `description` TEXT
- `district` String — `district` TEXT
- `isPublic` bool — `is_public` INTEGER (0/1)
- `isActive` bool — `is_active` INTEGER (0/1)
- `source` String? — `source` TEXT NULLABLE
- `createdAt` DateTime — `created_at` TEXT
- `expiresAt` DateTime? — `expires_at` TEXT NULLABLE

Helpers:
- `bool isExpired()` compare `expiresAt` to `DateTime.now()`

Indexes:
- Index on `is_active` and `expires_at`.

---

## 6) `SyncMetadataModel` (lib/models/sync_metadata_model.dart)

Fields:
- `recordId` String (PK) — `record_id` TEXT PRIMARY KEY
- `recordType` String — `record_type` TEXT (report|incident|resource|alert|user)
- `syncStatus` String — `sync_status` TEXT (pending|uploading|uploaded|failed)
- `lastSyncAttempt` DateTime? — `last_sync_attempt` TEXT NULLABLE
- `syncErrorMessage` String? — `sync_error_message` TEXT NULLABLE
- `retryCount` int — `retry_count` INTEGER
- `createdAt` DateTime — `created_at` TEXT

Notes:
- Keep small; used by sync service to manage retries.
- Add method `shouldRetry()` to decide retries based on `retryCount` and timestamp.

---

## Serialization Examples (pseudocode)

IncomingReportModel.toMap():
```dart
Map<String, dynamic> toMap() => {
  'id': id,
  'source': source.toApiValue(),
  'disaster_type': disasterType.toApiValue(),
  'district': district,
  'latitude': latitude,
  'longitude': longitude,
  'description': description,
  'contact': contact,
  'media_urls': jsonEncode(mediaUrls),
  'verification_status': verificationStatus.toApiValue(),
  'created_at': createdAt.toUtc().toIso8601String(),
  'reviewed_at': reviewedAt?.toUtc().toIso8601String(),
  'officer_notes': officerNotes,
  'sos_id': sosId,
  'device_id': deviceId,
  'reviewed_by_id': reviewedById,
  'incident_id': incidentId,
  'timestamp_submitted': timestampSubmitted?.toUtc().toIso8601String(),
};
```

IncomingReportModel.fromMap(Map m):
```dart
return IncomingReportModel(
  id: m['id'],
  source: ReportSource.fromApiValue(m['source']),
  disasterType: DisasterType.fromApiValue(m['disaster_type']),
  district: m['district'],
  latitude: (m['latitude'] as num).toDouble(),
  longitude: (m['longitude'] as num).toDouble(),
  description: m['description'],
  contact: m['contact'],
  mediaUrls: (m['media_urls'] != null) ? List<String>.from(jsonDecode(m['media_urls'])) : [],
  verificationStatus: VerificationStatus.fromApiValue(m['verification_status']),
  createdAt: DateTime.parse(m['created_at']),
  reviewedAt: m['reviewed_at'] != null ? DateTime.parse(m['reviewed_at']) : null,
  // ... other fields
);
```

---

## Error Handling & Validation Patterns
- Use `try/catch` around `jsonDecode` for `media_urls` and default to empty list on error.
- For enum parsing, if unknown string received, log warning and map to safe default (e.g., `DisasterType.OTHER`).
- When writing numeric values, ensure they are non-null and of type `num` before casting to `double`.

---

## File Names to Implement Next (Step 4-11)
- `lib/models/enums.dart` (Step 4)
- `lib/models/user_model.dart` (Step 7)
- `lib/models/incoming_report_model.dart` (Step 8)
- `lib/models/confirmed_incident_model.dart` (Step 9)
- `lib/models/resource_model.dart` (Step 10)
- `lib/models/alert_model.dart` (Step 10)
- `lib/models/sync_metadata_model.dart` (Step 11)

---

## Acceptance Criteria for Step 3
- `MODEL_DESIGN.md` exists in project root (under `mobile_app`) and details mapping for all models.
- All required fields identified, with types, SQLite column names, validation, and serialization rules.
- Ready to implement enums and model files in code.

---

**Step 3 status:** Complete — Implementation ready (Step 3 marked `in-progress` earlier, now complete). Next: Step 4 (create `lib/models/enums.dart`).
