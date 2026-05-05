# Backend Schema Update Analysis Report
**Date:** May 5, 2026  
**Analysis Type:** Database Schema Migration & Synchronization Assessment  
**Status:** PRE-IMPLEMENTATION REVIEW (No Code Changes Made Yet)

---

## Executive Summary

Your backend has undergone a **major database schema expansion** adding **5 new database tables/models** to the PostgreSQL instance. The current **mobile app (J1) uses only a single SQLite table** for local queueing, creating a **critical data model mismatch** that will block proper synchronization when offline data attempts to sync with the backend.

### Key Finding
The mobile app and backend are **completely out of sync** in terms of data models. The mobile app needs restructuring to support the new backend schema before synchronization can work properly.

---

## 1. BACKEND SCHEMA UPDATE - What Changed

### New Schema Location
**File:** `J1-device-edge/mobile_app/databaseforreference.prisma`  
**Status:** Recently added (new file in latest commit)  
**Database:** PostgreSQL (Backend)

### 5 New Tables/Models Added

#### **Table 1: User Model**
```
Columns: id (UUID), email (unique), name, role (enum), createdAt
Purpose: User identity and role management
Related Data: reviewedReports (one-to-many)
```
- **New Concept for Mobile:** User authentication metadata
- **Roles Defined:** PUBLIC_USER, OFFICER, RESOURCE_MANAGER, ADMIN

#### **Table 2: IncomingReport Model** 
```
Columns: 
  - id (UUID PRIMARY KEY)
  - source (enum: J1_SOS_APP, J3_PUBLIC_PORTAL, J1_SENSOR_SYSTEM, WEATHER_API, OFFICER_CREATED)
  - disasterType (enum: FLOOD, LANDSLIDE, OTHER)
  - district (String)
  - latitude, longitude (Float)
  - description, contact (String, optional)
  - mediaUrls (String array)
  - verificationStatus (enum: PENDING_REVIEW, VERIFIED, REJECTED, DUPLICATE, CONVERTED_TO_INCIDENT)
  - createdAt, reviewedAt (DateTime)
  - sosId, deviceId (optional external IDs)
  - officerNotes (optional)
  - reviewedById (FK to User)
  - incidentId (FK to ConfirmedIncident, optional)
  
Purpose: Incoming disaster reports for officer review
Relations: User (reviewer), ConfirmedIncident (converted to)
```
- **This replaces the generic 'events' table concept**
- **Adds verification workflow tracking**

#### **Table 3: ConfirmedIncident Model**
```
Columns:
  - id (UUID PRIMARY KEY)
  - title, district, description (String)
  - disasterType (enum)
  - severity (enum: LOW, MEDIUM, HIGH, CRITICAL)
  - status (enum: ACTIVE, UNDER_RESPONSE, RESOLVED, CLOSED)
  - latitude, longitude (Float)
  - publicVisibility (Boolean)
  - affectedPeople (Int)
  - createdAt, updatedAt (DateTime)

Purpose: Verified incidents that have been elevated from IncomingReports
Relations: IncomingReport[], Resource[] (one-to-many)
```
- **New workflow state** - Not all reports become incidents
- **Public visibility flag** - Incidents can be public or restricted

#### **Table 4: Resource Model**
```
Columns:
  - id (UUID PRIMARY KEY)
  - type (enum: RESCUE_TEAM, BOAT, AMBULANCE, SHELTER, MEDICAL_TEAM, FOOD_WATER)
  - name, district (String)
  - status (enum: AVAILABLE, ASSIGNED, BUSY, OUT_OF_SERVICE)
  - latitude, longitude (Float, optional)
  - capacity, currentLoad (Int, optional)
  - lastUpdated (DateTime)
  - incidentId (FK to ConfirmedIncident, optional)

Purpose: Disaster response resources and their deployment status
Relations: ConfirmedIncident (many-to-one)
```
- **New table entirely** - Mobile app had no resource tracking locally
- **Tracks real-time deployment** status of resources

#### **Table 5: Alert Model**
```
Columns:
  - id (UUID PRIMARY KEY)
  - type (enum: RISK_ALERT, PUBLIC_ALERT, SHELTER_CAPACITY, RESOURCE_SHORTAGE, INCIDENT_STATUS)
  - severity (enum: LOW, MEDIUM, HIGH, CRITICAL)
  - title, description, district (String)
  - isPublic, isActive (Boolean)
  - source (String, optional)
  - createdAt, expiresAt (DateTime)

Purpose: Push alerts and public warnings
Relations: None (standalone)
```
- **New alert system** - Mobile app doesn't currently cache alerts
- **Supports multiple alert types** for different scenarios

---

## 2. CURRENT MOBILE APP DATABASE - What Exists

### Current SQLite Schema
**File:** `lib/services/database_helper.dart`  
**Database:** SQLite (Local Only)  
**Tables:** 1 table only

#### **Current Table: events**
```sql
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp_created TEXT NOT NULL,
  timestamp_submitted TEXT
)
```

**Structure Analysis:**
- **Minimal fields:** event_id, type, data (generic JSON?), status
- **Generic 'data' field:** All event details stored as blob/JSON
- **No structured relationships:** Everything is flat
- **No verification workflow:** Simple queued → submitted
- **Version:** 1 (never upgraded)

### Associated Models

**EventModel (Dart):**
```dart
- eventId (String)
- type (String)
- data (String - JSON blob)
- status (String - QUEUED/SUBMITTED)
- timestampCreated (String)
- timestampSubmitted (nullable)
```

**RequestModel:** Wrapper around EventModel for UI display

---

## 3. THE MISMATCH - Critical Gaps Identified

### Gap Analysis Table

| Aspect | Backend (Prisma) | Mobile (SQLite) | Match? | Severity |
|--------|------------------|-----------------|--------|----------|
| **Table Count** | 5 tables | 1 table | ❌ NO | CRITICAL |
| **User Management** | User model with roles | None | ❌ NO | HIGH |
| **Report Tracking** | IncomingReport (structured) | events (generic) | ❌ NO | CRITICAL |
| **Incident Verification** | Full workflow (5 statuses) | No verification | ❌ NO | CRITICAL |
| **Resources** | Resource model tracked | No tracking | ❌ NO | HIGH |
| **Alerts** | Alert model | No alert storage | ❌ NO | MEDIUM |
| **Relationships** | User→Reports, Incidents→Resources | Flat structure | ❌ NO | CRITICAL |
| **Enums/Constraints** | Strongly typed enums | String types | ❌ NO | MEDIUM |
| **Media URLs** | String array support | Generic JSON field | ⚠️ PARTIAL | MEDIUM |
| **Timestamps** | DateTime ISO 8601 | String ISO 8601 | ✅ YES | LOW |
| **Geographic Data** | lat/long Float | Embedded in JSON | ⚠️ PARTIAL | MEDIUM |

### Critical Issues

#### **Issue #1: Generic vs Structured Data**
- Backend expects **structured field mapping** for each entity
- Mobile stores **all data in a generic 'data' JSON field**
- **Impact:** Impossible to query by specific fields on mobile without JSON parsing

#### **Issue #2: Relationship Support**
- Backend uses **foreign keys** (FK relationships between tables)
- Mobile has **no relationship model** - everything is flat
- **Impact:** Cannot maintain referential integrity locally; offline-first sync will be broken

#### **Issue #3: Verification Workflow**
- Backend tracks **5 verification statuses:** PENDING_REVIEW → VERIFIED/REJECTED/DUPLICATE/CONVERTED_TO_INCIDENT
- Mobile only tracks **2 states:** QUEUED → SUBMITTED
- **Impact:** Mobile cannot represent the full lifecycle of a report

#### **Issue #4: Missing Tables**
- Backend has **User, Resource, Alert models** with full CRUD operations
- Mobile has **zero support** for these entities
- **Impact:** Mobile app cannot manage resources or display alerts locally

#### **Issue #5: Type Safety**
- Backend uses **strict enums** (ReportSource, DisasterType, IncidentStatus, etc.)
- Mobile uses **generic String fields** with no validation
- **Impact:** Type mismatches when syncing; data corruption possible

---

## 4. SPECIFIC DATA FLOW PROBLEMS

### Scenario 1: Creating a SOS Report Offline
```
Current Mobile Flow:
1. User fills form → stored as generic JSON in 'events' table
2. Queued for sync

Expected Backend Expectation:
1. Parse into IncomingReport model
2. Extract: source, disasterType, district, lat, long, description, contact, mediaUrls
3. Set: verificationStatus = PENDING_REVIEW, createdAt timestamp
4. Route to VerificationStatus workflow
```
**Problem:** Mobile sends raw JSON; backend doesn't know which fields map to which IncomingReport columns

### Scenario 2: Officer Verification
```
Backend Process:
1. Officer reviews IncomingReport
2. Updates: verificationStatus (VERIFIED/REJECTED/etc)
3. Officer notes go in officerNotes field
4. If CONVERTED_TO_INCIDENT: creates ConfirmedIncident, sets incidentId FK

Mobile Expectation:
❌ No concept of verification
❌ No model for ConfirmedIncident
❌ No way to receive verification feedback
❌ No way to display verified incidents
```
**Problem:** Mobile cannot participate in verification workflow at all

### Scenario 3: Resource Assignment
```
Backend System:
1. Incident created (ConfirmedIncident)
2. Resources assigned: Resource.incidentId = incident.id
3. Resource.status updated: ASSIGNED, IN_TRANSIT, etc.
4. Mobile app should display this

Mobile Reality:
❌ No Resource table
❌ No way to query assigned resources
❌ No real-time status updates
❌ No incident-to-resource relationship model
```
**Problem:** Mobile cannot display resource deployment

---

## 5. SYNCHRONIZATION FAILURE ANALYSIS

### Current Mobile Sync Process (from `sync_service.dart`)
- Pull queued events from SQLite
- Send to backend
- Mark as SUBMITTED on sync

### What Will Fail

1. **Data Parsing Error**
   - Backend receives event with generic `data: "{ ... }"` JSON
   - Backend doesn't have a parser for EventModel → IncomingReport
   - **Result:** Sync fails with validation error

2. **Missing Field Validation**
   - Backend IncomingReport requires: source, disasterType, district, lat, long, description
   - Mobile generic event might not have structured fields
   - **Result:** 400 Bad Request on backend

3. **Return Data Cannot Be Stored**
   - Backend returns verification status updates
   - Mobile has no User, ConfirmedIncident, or Alert tables to store responses
   - **Result:** Mobile cannot cache offline verification data

4. **Enum Type Mismatch**
   - Backend sends: `{ "status": "CONVERTED_TO_INCIDENT", "verificationStatus": "VERIFIED" }`
   - Mobile expects: `{ "status": "SUBMITTED" }`
   - **Result:** Type conversion errors

---

## 6. IMPACT ASSESSMENT

### For Mobile App Functionality
| Feature | Current | With Backend Schema | Status |
|---------|---------|-------------------|--------|
| Create SOS Report | ✅ Works | ✅ Works (if schema updated) | FIXABLE |
| Offline Queue | ✅ Works | ✅ Works (if schema updated) | FIXABLE |
| View Verification | ❌ N/A | ✅ Needed | MISSING |
| Display Incidents | ⚠️ Limited | ✅ Full | NEEDS UPGRADE |
| Manage Resources | ❌ No | ✅ Expected | MISSING |
| Receive Alerts | ❌ No | ✅ Expected | MISSING |
| Officer Role Features | ❌ No | ✅ Expected | MISSING |

### For System Synchronization
- **Current:** Mobile → Backend (one-way, basic sync)
- **Expected:** Bi-directional sync with full data model support
- **Risk:** Sync will break without schema alignment

---

## 7. RECOMMENDATIONS - Before You Code

### Priority 1: Schema Alignment (BLOCKING)
1. **Expand SQLite Schema** to match backend structure
   - Add `users` table (minimal: userId, email, role, name)
   - Add `incoming_reports` table with **all fields from IncomingReport** model
   - Add `confirmed_incidents` table
   - Add `resources` table
   - Add `alerts` table

2. **Replace Generic 'events' Table**
   - Current `events` table is too generic
   - Migrate to structured `incoming_reports` table
   - Keep a sync queue table separate if needed

3. **Add Relationship Support**
   - SQLite foreign keys: `incident_id` → `confirmed_incidents.id`
   - SQLite foreign keys: `user_id` → `users.id`
   - Track verification chain

### Priority 2: Model/Type Safety (HIGH)
1. **Create Dart Models** matching backend enums
   - `ReportSource` enum (J1_SOS_APP, J3_PUBLIC_PORTAL, etc)
   - `VerificationStatus` enum (PENDING_REVIEW, VERIFIED, REJECTED, etc)
   - `ResourceType`, `ResourceStatus`, `AlertType` enums

2. **Structured Serialization**
   - Replace generic JSON blobs with typed models
   - IncomingReportModel with all fields
   - ConfirmedIncidentModel, ResourceModel, AlertModel

### Priority 3: Bi-directional Sync (HIGH)
1. **Sync Service Upgrade**
   - Currently: Pull from SQLite → Send to backend
   - Needed: Also receive and store: verification status, confirmed incidents, resources, alerts

2. **Conflict Resolution**
   - Handle offline changes while backend made changes
   - Last-write-wins? Or merge logic?

3. **Database Migrations**
   - Version 2: Add new tables
   - Version 3: Add relationship support
   - Handle schema version mismatches gracefully

### Priority 4: Feature Enablement (MEDIUM)
1. **Officer Mobile Features**
   - If app supports OFFICER role, add verification workflow UI
   - Display incoming reports pending review
   - Update verification status

2. **Resource Management**
   - Display assigned resources for incidents
   - Show resource status changes (deployment, availability)

3. **Alert Display**
   - Cache alerts locally
   - Display based on severity/district
   - Support alert expiration

---

## 8. DATABASE SCHEMA UPGRADE PLAN

### Current State
```
SQLite (Mobile Local)
└── events [generic queue table]
```

### Target State
```
SQLite (Mobile Local)
├── sync_queue [pending uploads]
├── users [local user cache]
├── incoming_reports [SOS reports with full structure]
├── confirmed_incidents [verified incidents from backend]
├── resources [available resources with status]
└── alerts [active alerts and warnings]
```

### Migration Steps Required
1. **Step 1:** Update database schema version (1 → 2)
2. **Step 2:** Create new tables in `_onCreate` or migration in `_onUpgrade`
3. **Step 3:** Migrate data from old `events` to new `incoming_reports` (with field extraction)
4. **Step 4:** Update all Dart models to match schema
5. **Step 5:** Update sync service to handle 5 entity types
6. **Step 6:** Update UI to display new entity types

---

## 9. TIMELINE ESTIMATE (Pre-Implementation)

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| **Schema Design** | Finalize SQLite schema, migrations, version strategy | 2-3 hours |
| **Model Creation** | Dart models, enums, serialization for 5 entities | 4-5 hours |
| **Database Layer** | Migration code, CRUD operations, relationships | 5-6 hours |
| **Sync Service** | Bi-directional sync, conflict resolution | 6-8 hours |
| **UI Integration** | Display new entity types, verification workflow | 8-10 hours |
| **Testing** | Offline sync, data consistency, edge cases | 5-6 hours |
| **Documentation** | Schema docs, API mappings, sync flow diagrams | 2-3 hours |
| **TOTAL** | | **33-41 hours** |

---

## 10. DIAGNOSIS SUMMARY

### What Backend Changed
✅ **5 new database tables added** to PostgreSQL with structured schemas
✅ **Rich data models** for reports, incidents, resources, alerts, users
✅ **Verification workflow** with 5 status states
✅ **Relationships** between entities (FK constraints)
✅ **Type safety** with enums

### What Mobile App Has Now
⚠️ **Single generic table** (`events`) with JSON blob field
⚠️ **No relationship support** between data entities
⚠️ **No verification workflow** tracking
⚠️ **No type safety** - all fields are generic Strings
⚠️ **No support** for users, resources, or alerts

### The Gap
🔴 **CRITICAL MISMATCH:** Mobile and backend are fundamentally out of sync  
🔴 **Sync will break** without schema alignment  
🔴 **Data cannot be properly mapped** between systems  
🔴 **Verification workflow cannot function** on mobile  
🔴 **Bi-directional sync impossible** with current structure

### Before You Code
1. ✅ Understand the new backend structure (DONE - this report)
2. ⏳ Plan SQLite schema upgrade (5 new tables)
3. ⏳ Create Dart models matching backend enums
4. ⏳ Update sync service for bi-directional flow
5. ⏳ Implement migration strategy
6. ⏳ Update UI to display/manage new entities

---

## Appendix A: Backend Enum Definitions

### ReportSource (5 values)
```
J1_SOS_APP         → SOS app on device
J3_PUBLIC_PORTAL   → Web portal submission
J1_SENSOR_SYSTEM   → Automated sensor reading
WEATHER_API        → Weather service alert
OFFICER_CREATED    → Officer manual entry
```

### VerificationStatus (5 values)
```
PENDING_REVIEW        → Awaiting officer review
VERIFIED              → Officer approved
REJECTED              → Officer rejected
DUPLICATE             → Duplicate of existing report
CONVERTED_TO_INCIDENT → Became confirmed incident
```

### DisasterType (3 values)
```
FLOOD              → Flood event
LANDSLIDE          → Landslide event
OTHER              → Other disaster type
```

### IncidentSeverity (4 values)
```
LOW                → Low severity
MEDIUM             → Medium severity
HIGH               → High severity
CRITICAL           → Critical severity
```

### IncidentStatus (4 values)
```
ACTIVE             → Active incident
UNDER_RESPONSE     → Response in progress
RESOLVED           → Situation resolved
CLOSED             → Incident closed
```

### ResourceType (6 values)
```
RESCUE_TEAM        → Rescue personnel
BOAT               → Water rescue boat
AMBULANCE          → Medical transport
SHELTER            → Emergency shelter
MEDICAL_TEAM       → Medical personnel
FOOD_WATER         → Food/water supply
```

### ResourceStatus (4 values)
```
AVAILABLE          → Ready for assignment
ASSIGNED           → Assigned to incident
BUSY               → Currently engaged
OUT_OF_SERVICE     → Not available
```

### AlertType (5 values)
```
RISK_ALERT         → Risk warning
PUBLIC_ALERT       → Public notification
SHELTER_CAPACITY   → Shelter full alert
RESOURCE_SHORTAGE  → Resource shortage alert
INCIDENT_STATUS    → Incident status update
```

---

**Report Generated:** May 5, 2026 10:15 UTC  
**Status:** Ready for Development Planning
