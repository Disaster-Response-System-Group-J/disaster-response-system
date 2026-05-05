# 20-Step Implementation Plan
## Complete Roadmap for Backend Schema Synchronization

**Status:** Ready to Execute  
**Estimated Total Time:** 33-41 hours (distributed across 20 steps)  
**Difficulty:** Medium (requires database, ORM, and API changes)

---

## PHASE 1: PLANNING & PREPARATION (Steps 1-3)

### Step 1: Database Version Strategy & Migration Planning
**Objective:** Define how SQLite schema will evolve  
**Files to Touch:** None yet (planning phase)  
**Deliverable:** Migration strategy document

**Tasks:**
- [ ] Decide: Keep old "events" table or migrate to new "incoming_reports"?
- [ ] Plan backward compatibility (old data handling)
- [ ] Design database version upgrade path: v1 → v2
- [ ] Document rollback strategy
- [ ] Decide on timestamps format (ISO 8601 preferred)

**Questions to Answer:**
- Should we keep old events data or start fresh?
- Should we have data migration script?
- How to handle users already using the app?

**Time Estimate:** 30-45 minutes

---

### Step 2: Create Enum Specification Document
**Objective:** Lock down all enum values that must match backend  
**Files to Touch:** Create `ENUM_SPECIFICATION.md`  
**Deliverable:** Enumeration reference document

**Tasks:**
- [ ] List all 8 enums with all values
- [ ] Document what each enum value means
- [ ] Verify enum values match backend Prisma schema
- [ ] Document validation rules for each enum
- [ ] Create mapping between frontend display names and enum values

**Enums to Document:**
1. ReportSource (5 values)
2. DisasterType (3 values)
3. VerificationStatus (5 values)
4. IncidentSeverity (4 values)
5. IncidentStatus (4 values)
6. ResourceType (6 values)
7. ResourceStatus (4 values)
8. AlertType (5 values)

**Time Estimate:** 30-45 minutes

---

### Step 3: Design Dart Model Structure
**Objective:** Plan how Dart models will map to SQLite tables  
**Files to Touch:** Create `MODEL_DESIGN.md`  
**Deliverable:** Model class specifications

**Tasks:**
- [ ] Design UserModel structure
- [ ] Design IncomingReportModel structure
- [ ] Design ConfirmedIncidentModel structure
- [ ] Design ResourceModel structure
- [ ] Design AlertModel structure
- [ ] Plan serialization strategy (toMap/fromMap)
- [ ] Plan relationship handling (UUIDs as foreign keys)
- [ ] Document nullable vs required fields

**For Each Model Document:**
```
- Field name
- Dart type
- SQLite column type
- Validation rules
- Backend mapping
```

**Time Estimate:** 45-60 minutes

---

## PHASE 2: ENUM CREATION (Steps 4-6)

### Step 4: Create Base Enum File
**Objective:** Create all enum definitions in one file  
**Files to Create:** `lib/models/enums.dart`  
**Deliverable:** Complete enums.dart file

**Tasks:**
- [ ] Create `lib/models/enums.dart`
- [ ] Define ReportSource enum (J1_SOS_APP, J3_PUBLIC_PORTAL, J1_SENSOR_SYSTEM, WEATHER_API, OFFICER_CREATED)
- [ ] Define DisasterType enum (FLOOD, LANDSLIDE, OTHER)
- [ ] Add documentation comments to each enum

**Code Structure:**
```dart
enum ReportSource {
  j1SosApp('J1_SOS_APP', 'SOS App'),
  j3PublicPortal('J3_PUBLIC_PORTAL', 'Public Portal'),
  // ... more
  
  final String apiValue;
  final String displayName;
  
  const ReportSource(this.apiValue, this.displayName);
}
```

**Time Estimate:** 30-45 minutes

---

### Step 5: Create Status & Type Enums
**Objective:** Add verification, incident, resource, and alert enums  
**Files to Modify:** `lib/models/enums.dart`  
**Deliverable:** Extended enums.dart with 6 more enums

**Tasks:**
- [ ] Add VerificationStatus enum (5 values)
- [ ] Add IncidentSeverity enum (4 values)
- [ ] Add IncidentStatus enum (4 values)
- [ ] Add UserRole enum (PUBLIC_USER, OFFICER, RESOURCE_MANAGER, ADMIN)
- [ ] Add comments and documentation
- [ ] Test enum compilation

**Time Estimate:** 30-45 minutes

---

### Step 6: Create Resource & Alert Enums
**Objective:** Add final enums for resources and alerts  
**Files to Modify:** `lib/models/enums.dart`  
**Deliverable:** Complete enums.dart (all 8 enums)

**Tasks:**
- [ ] Add ResourceType enum (6 values)
- [ ] Add ResourceStatus enum (4 values)
- [ ] Add AlertType enum (5 values)
- [ ] Add helper functions for enum conversion (string ↔ enum)
- [ ] Add unit tests for enum parsing
- [ ] Verify all enums match backend values exactly

**Bonus Helper Methods:**
```dart
// Convert API string to enum
static ReportSource fromApiValue(String value) { ... }

// Convert enum back to API string
String toApiValue() { ... }
```

**Time Estimate:** 30-45 minutes

---

## PHASE 3: MODEL CREATION (Steps 7-11)

### Step 7: Create UserModel
**Objective:** First data model for user identity  
**Files to Create:** `lib/models/user_model.dart`  
**Deliverable:** Complete UserModel class

**Tasks:**
- [ ] Create UserModel class with fields:
  - userId (String)
  - email (String)
  - name (String)
  - role (UserRole enum)
  - createdAt (DateTime)
- [ ] Implement toMap() method for SQLite storage
- [ ] Implement fromMap() factory constructor for retrieval
- [ ] Implement toString() for debugging
- [ ] Add field validation in constructor

**Time Estimate:** 30-45 minutes

---

### Step 8: Create IncomingReportModel
**Objective:** Model for disaster reports (replaces old EventModel partially)  
**Files to Create:** `lib/models/incoming_report_model.dart`  
**Deliverable:** Complete IncomingReportModel class

**Tasks:**
- [ ] Create IncomingReportModel with 15 fields:
  - id, source, disasterType, district, latitude, longitude
  - description, contact, mediaUrls, verificationStatus
  - createdAt, reviewedAt, officerNotes, sosId, deviceId
- [ ] Handle mediaUrls as JSON array serialization
- [ ] Implement toMap() for SQLite
- [ ] Implement fromMap() factory
- [ ] Add field validation

**Special Handling:**
- mediaUrls: Convert List<String> ↔ JSON string
- Enums: Use .toApiValue() / fromApiValue() helpers

**Time Estimate:** 45-60 minutes

---

### Step 9: Create ConfirmedIncidentModel
**Objective:** Model for verified incidents  
**Files to Create:** `lib/models/confirmed_incident_model.dart`  
**Deliverable:** Complete ConfirmedIncidentModel class

**Tasks:**
- [ ] Create ConfirmedIncidentModel with fields:
  - id, title, disasterType, district, severity, status
  - latitude, longitude, description, publicVisibility
  - affectedPeople, createdAt, updatedAt
- [ ] Implement toMap() / fromMap()
- [ ] Add helper method: isActive (check if status == ACTIVE)
- [ ] Add helper method: isCritical (check if severity == CRITICAL)
- [ ] Add validation for severity/status enums

**Time Estimate:** 30-45 minutes

---

### Step 10: Create ResourceModel & AlertModel
**Objective:** Models for resources and alerts  
**Files to Create:** 
- `lib/models/resource_model.dart`
- `lib/models/alert_model.dart`  
**Deliverable:** Two complete model classes

**ResourceModel Fields:**
- id, type, name, district, status
- latitude, longitude, capacity, currentLoad
- lastUpdated, incidentId

**AlertModel Fields:**
- id, type, severity, title, description
- district, isPublic, isActive
- source, createdAt, expiresAt

**Tasks for Each:**
- [ ] Create model class with all fields
- [ ] Implement toMap() / fromMap()
- [ ] Add helper methods (isExpired, isUrgent, etc.)
- [ ] Add validation

**Time Estimate:** 45-60 minutes

---

### Step 11: Create SyncMetadataModel
**Objective:** Track sync state of records  
**Files to Create:** `lib/models/sync_metadata_model.dart`  
**Deliverable:** SyncMetadataModel class

**Tasks:**
- [ ] Create SyncMetadataModel to track:
  - recordId (the UUID being synced)
  - recordType (report, incident, resource, alert, user)
  - syncStatus (pending, uploading, uploaded, failed)
  - lastSyncAttempt (DateTime)
  - syncErrorMessage (if failed)
  - retryCount (int)
- [ ] Implement toMap() / fromMap()
- [ ] Add helper methods: isRetryable(), shouldRetry()

**Time Estimate:** 30-45 minutes

---

## PHASE 4: DATABASE SCHEMA UPDATES (Steps 12-14)

### Step 12: Plan & Create Database Migration Strategy
**Objective:** Update database schema from v1 to v2  
**Files to Modify:** `lib/services/database_helper.dart`  
**Deliverable:** Migration-ready database helper

**Tasks:**
- [ ] Update databaseVersion from 1 to 2
- [ ] Create _onUpgrade() method (currently empty)
- [ ] Plan migration logic:
  - Keep old events table or migrate to incoming_reports
  - Create new tables (users, incoming_reports, confirmed_incidents, resources, alerts)
  - Handle existing data
- [ ] Write SQL for creating all new tables
- [ ] Plan transaction handling for safety

**SQL to Create (in _onUpgrade):**
```sql
CREATE TABLE users (...)
CREATE TABLE incoming_reports (...)
CREATE TABLE confirmed_incidents (...)
CREATE TABLE resources (...)
CREATE TABLE alerts (...)
CREATE TABLE sync_metadata (...)
```

**Time Estimate:** 45-60 minutes

---

### Step 13: Implement New Table Creation
**Objective:** Write actual CREATE TABLE statements  
**Files to Modify:** `lib/services/database_helper.dart`  
**Deliverable:** Complete _onCreate() with 6 tables

**Tasks:**
- [ ] Add users table creation
- [ ] Add incoming_reports table creation
- [ ] Add confirmed_incidents table creation
- [ ] Add resources table creation
- [ ] Add alerts table creation
- [ ] Add sync_metadata table creation
- [ ] Add indexes for frequently queried columns:
  - incoming_reports: verification_status, created_at
  - confirmed_incidents: status, created_at
  - resources: incident_id, status
  - alerts: is_active, expires_at
- [ ] Test that onCreate runs without errors

**Key Constraints to Add:**
- Foreign keys (if SQLite supports them)
- Unique constraints (email in users)
- Check constraints (for enums)

**Time Estimate:** 60-75 minutes

---

### Step 14: Implement Database Migration Logic
**Objective:** Handle upgrade from v1 to v2  
**Files to Modify:** `lib/services/database_helper.dart`  
**Deliverable:** Working _onUpgrade() method

**Tasks:**
- [ ] Implement _onUpgrade() logic:
  ```
  if oldVersion == 1 and newVersion == 2:
    - Backup events table
    - Create new tables
    - Migrate events → incoming_reports (if keeping)
    - Update version
  ```
- [ ] Handle edge cases:
  - Empty database
  - Partial data
  - Corrupted records
- [ ] Add error handling and logging
- [ ] Test upgrade path manually

**Time Estimate:** 60-75 minutes

---

## PHASE 5: DATABASE HELPER UPDATES (Steps 15-17)

### Step 15: Implement CRUD for Reports & Incidents
**Objective:** Add database methods for reports and incidents  
**Files to Modify:** `lib/services/database_helper.dart`  
**Deliverable:** New CRUD methods

**Methods to Add (IncomingReport):**
```dart
- saveIncomingReport(IncomingReportModel) → Future<int>
- getIncomingReportById(String id) → Future<IncomingReportModel?>
- getIncomingReportsByStatus(VerificationStatus) → Future<List<IncomingReportModel>>
- updateReportVerificationStatus(String id, VerificationStatus) → Future<int>
- getUnverifiedReports() → Future<List<IncomingReportModel>>
- deleteIncomingReport(String id) → Future<int>
```

**Methods to Add (ConfirmedIncident):**
```dart
- saveConfirmedIncident(ConfirmedIncidentModel) → Future<int>
- getConfirmedIncidentById(String id) → Future<ConfirmedIncidentModel?>
- getIncidentsByStatus(IncidentStatus) → Future<List<ConfirmedIncidentModel>>
- getIncidentsByDistrict(String district) → Future<List<ConfirmedIncidentModel>>
- updateIncidentStatus(String id, IncidentStatus) → Future<int>
```

**Time Estimate:** 60-75 minutes

---

### Step 16: Implement CRUD for Resources, Alerts & Users
**Objective:** Add methods for remaining entities  
**Files to Modify:** `lib/services/database_helper.dart`  
**Deliverable:** Complete CRUD suite

**Methods to Add (Resource):**
```dart
- saveResource(ResourceModel) → Future<int>
- getResourcesByStatus(ResourceStatus) → Future<List<ResourceModel>>
- getResourcesByIncident(String incidentId) → Future<List<ResourceModel>>
- updateResourceStatus(String id, ResourceStatus) → Future<int>
- getAvailableResources() → Future<List<ResourceModel>>
```

**Methods to Add (Alert):**
```dart
- saveAlert(AlertModel) → Future<int>
- getActiveAlerts() → Future<List<AlertModel>>
- getAlertsByDistrict(String district) → Future<List<AlertModel>>
- getExpiredAlerts() → Future<List<AlertModel>>
- markAlertInactive(String id) → Future<int>
```

**Methods to Add (User):**
```dart
- saveUser(UserModel) → Future<int>
- getUserById(String id) → Future<UserModel?>
- cacheCurrentUser(UserModel) → Future<void>
- getCurrentUser() → Future<UserModel?>
```

**Time Estimate:** 60-75 minutes

---

### Step 17: Implement Sync Helper Methods
**Objective:** Add methods to support synchronization  
**Files to Modify:** `lib/services/database_helper.dart`  
**Deliverable:** Sync-specific helper methods

**Methods to Add:**
```dart
// Get all unsynced records across all tables
- getUnsyncedReports() → Future<List<IncomingReportModel>>
- getUnsyncedIncidents() → Future<List<ConfirmedIncidentModel>>
- getUnsyncedResources() → Future<List<ResourceModel>>

// Batch update for sync results
- markReportsSynced(List<String> ids) → Future<int>
- updateReportsFromBackend(List<IncomingReportModel>) → Future<int>
- updateIncidentsFromBackend(List<ConfirmedIncidentModel>) → Future<int>

// Sync metadata tracking
- saveSyncMetadata(SyncMetadataModel) → Future<int>
- getSyncMetadata(String recordId) → Future<SyncMetadataModel?>
- retryFailedSyncs() → Future<int>
- getLastSyncTime() → Future<DateTime?>

// Conflict resolution
- resolveConflicts() → Future<void>
```

**Time Estimate:** 60-75 minutes

---

## PHASE 6: SYNC SERVICE UPDATES (Steps 18-19)

### Step 18: Update Sync Service - Upload Phase
**Objective:** Make upload support all 5 entity types  
**Files to Modify:** `lib/services/sync_service.dart`  
**Deliverable:** Enhanced upload sync logic

**Current State:**
- Uploads only generic "events"
- One-way: mobile → backend

**Changes Needed:**
- [ ] Get queued incoming_reports (instead of events)
- [ ] Format as IncomingReport JSON (not generic event)
- [ ] Send to backend: `POST /api/v1/system/reports`
- [ ] Handle verification status in response
- [ ] Update local reports with verification status
- [ ] Mark successfully synced as SUBMITTED

**Code Structure:**
```dart
Future<void> syncUploadReports() async {
  - Get unsynced incoming_reports from DB
  - Convert to JSON payload matching backend schema
  - POST to backend reports endpoint
  - For each successful response:
    - Update verification_status in local DB
    - Mark as synced
  - For failures:
    - Log error
    - Keep for retry
  - Update sync metadata
}
```

**Time Estimate:** 60-90 minutes

---

### Step 19: Update Sync Service - Download Phase
**Objective:** Implement bi-directional sync (download from backend)  
**Files to Modify:** `lib/services/sync_service.dart`  
**Deliverable:** Complete bi-directional sync

**New Operations:**
- [ ] Download verified incidents from backend
  - GET `/api/v1/system/incidents?since=lastSyncTime`
  - Cache locally in confirmed_incidents table
  
- [ ] Download assigned resources
  - GET `/api/v1/system/resources`
  - Cache locally in resources table
  
- [ ] Download active alerts
  - GET `/api/v1/system/alerts?active=true`
  - Cache locally in alerts table
  
- [ ] Handle conflicts (what if data changed offline?)
  - Last-write-wins strategy
  - Or merge strategy
  
- [ ] Update sync metadata for all operations

**Code Structure:**
```dart
Future<void> syncDownloadData() async {
  - Download incidents since lastSync
  - Save to DB
  - Download resources
  - Save to DB
  - Download alerts
  - Save to DB
  - Update lastSyncTime
}

Future<void> fullSync() async {
  - uploadReports()
  - downloadData()
  - resolveConflicts()
  - updateSyncMetadata()
}
```

**Time Estimate:** 75-90 minutes

---

## PHASE 7: UI & INTEGRATION (Step 20)

### Step 20: Update UI & Screens to Use New Models
**Objective:** Integrate new models with existing UI  
**Files to Modify:** Multiple screen files  
**Deliverable:** Functional UI with new data models

**Tasks:**
- [ ] Update `MyRequestsScreen` to display IncomingReportModel
  - Show verification status
  - Show officer notes
  
- [ ] Update `GiveHelpScreen` to display ConfirmedIncidentModel
  - Show severity levels
  - Show incident status
  
- [ ] Add new screens:
  - `ResourcesScreen` - Display available resources
  - `AlertsScreen` - Display active alerts
  - `IncidentDetailsScreen` - Show incident details + resources
  
- [ ] Update offline banner to show more data
  
- [ ] Update FormWidgets to use proper enums
  
- [ ] Add error handling for type conversion
  
- [ ] Update mock data to use new models (for testing)
  
- [ ] Test all screens work with SQLite data

**Screens to Update/Create:**
```
├── my_requests_screen.dart (update to show IncomingReportModel)
├── give_help_screen.dart (update to show ConfirmedIncidentModel)
├── resources_screen.dart (NEW - display resources)
├── alerts_screen.dart (NEW - display alerts)
├── incident_details_screen.dart (NEW - full incident view)
├── verification_status_screen.dart (NEW - officer review UI)
└── offline_banner.dart (update with more sync info)
```

**Time Estimate:** 90-120 minutes

---

## Summary of 20 Steps

| Phase | Steps | Focus | Time |
|-------|-------|-------|------|
| **Planning** | 1-3 | Strategy & Design | 1.5-2.5 hrs |
| **Enums** | 4-6 | Enum Definitions | 1.5-2 hrs |
| **Models** | 7-11 | Dart Model Classes | 3-4 hrs |
| **Database Schema** | 12-14 | SQLite Structure | 2.5-3.5 hrs |
| **Database Helpers** | 15-17 | CRUD Operations | 3-4 hrs |
| **Sync Service** | 18-19 | Bi-directional Sync | 2.5-3.5 hrs |
| **UI Integration** | 20 | Screen Updates | 1.5-2.5 hrs |
| | **TOTAL** | | **17.5-23 hrs** |

---

## Execution Guidelines

### Before Starting Each Step
1. Read the step completely
2. Check time estimate
3. Understand dependencies from previous steps
4. Review any related analysis document sections

### While Executing Each Step
1. Create/modify only files specified
2. Test compilation after changes
3. Run relevant widget tests if applicable
4. Commit after completing step: `git commit -m "Step X: [description]"`

### Quality Checkpoints
- After Step 6: All 8 enums compile correctly
- After Step 11: All 5 models serialize/deserialize correctly
- After Step 14: Database migrations run without errors
- After Step 17: All CRUD methods work with SQLite
- After Step 19: Sync service uploads and downloads data
- After Step 20: UI displays all new data types correctly

---

## Notes for Implementation

### Recommended Order
- Do not skip steps - they build on each other
- Steps 1-3 are critical for planning; do not rush
- Steps 4-6 are quick and foundational
- Steps 7-11 are longest; take breaks
- Steps 12-14 are risky; test thoroughly
- Steps 15-17 are tedious but straightforward
- Steps 18-19 are complex; plan carefully
- Step 20 is integration; can be done in parallel

### Git Workflow Suggestion
```bash
# After each step, commit:
git add .
git commit -m "Step X: [title] - [brief description]"

# Example:
git commit -m "Step 4: Create Base Enum File - ReportSource, DisasterType"
git commit -m "Step 12: Plan Database Migration - v1 to v2"
```

### Testing After Each Phase
- Phase 1-3: No compilation needed yet
- Phase 4-6: Run `flutter pub get` and check for errors
- Phase 7-11: Run unit tests for model serialization
- Phase 12-14: Test database creation on fresh install
- Phase 15-17: Test each CRUD method
- Phase 18-19: Test sync with mock backend
- Phase 20: Run full app and verify UI

---

**Status:** Ready to Execute Step 1  
**Start:** When you're ready, reply with "Start Step 1" and I'll guide you through each one

