# Quick Reference: Schema Comparison

## Current Mobile (What Exists Now)
```
SQLite Database: j1_disaster_response.db
Version: 1

TABLE: events
┌─────────────────────┐
│ event_id (PK)       │ ← TEXT
│ type                │ ← TEXT (generic)
│ data                │ ← TEXT (JSON blob)
│ status              │ ← TEXT (QUEUED/SUBMITTED)
│ timestamp_created   │ ← TEXT
│ timestamp_submitted │ ← TEXT (nullable)
└─────────────────────┘

Data Flow:
User fills form → Stored as JSON → Queued → Sent to backend
```

## Backend Schema (What's Expected Now)
```
PostgreSQL Database: j3db
Provider: PostgreSQL with Prisma ORM

TABLE 1: User
┌──────────────────┐
│ id (PK, UUID)    │
│ email (unique)   │
│ name             │
│ role (enum)      │ ← PUBLIC_USER, OFFICER, RESOURCE_MANAGER, ADMIN
│ createdAt        │
└──────────────────┘

TABLE 2: IncomingReport (★ CRITICAL FOR SYNC)
┌──────────────────────────────┐
│ id (PK, UUID)                │
│ source (enum)                │ ← J1_SOS_APP, J3_PUBLIC_PORTAL, J1_SENSOR, WEATHER, OFFICER_CREATED
│ disasterType (enum)          │ ← FLOOD, LANDSLIDE, OTHER
│ district                     │
│ latitude, longitude          │
│ description, contact         │
│ mediaUrls (array)            │
│ verificationStatus (enum)    │ ← PENDING_REVIEW, VERIFIED, REJECTED, DUPLICATE, CONVERTED_TO_INCIDENT
│ createdAt, reviewedAt        │
│ officerNotes                 │
│ sosId, deviceId              │
│ reviewedById (FK→User)       │
│ incidentId (FK→Incident)     │
└──────────────────────────────┘

TABLE 3: ConfirmedIncident (★ NEW CONCEPT)
┌──────────────────────────────┐
│ id (PK, UUID)                │
│ title, district, description │
│ disasterType (enum)          │
│ severity (enum)              │ ← LOW, MEDIUM, HIGH, CRITICAL
│ status (enum)                │ ← ACTIVE, UNDER_RESPONSE, RESOLVED, CLOSED
│ latitude, longitude          │
│ publicVisibility (bool)      │
│ affectedPeople (int)         │
│ createdAt, updatedAt         │
│ sourceReports[] (1→many)     │
│ assignedResources[] (1→many) │
└──────────────────────────────┘

TABLE 4: Resource (★ NO MOBILE SUPPORT)
┌──────────────────────────────┐
│ id (PK, UUID)                │
│ type (enum)                  │ ← RESCUE_TEAM, BOAT, AMBULANCE, SHELTER, MEDICAL_TEAM, FOOD_WATER
│ name, district               │
│ status (enum)                │ ← AVAILABLE, ASSIGNED, BUSY, OUT_OF_SERVICE
│ latitude, longitude (optional)│
│ capacity, currentLoad        │
│ lastUpdated                  │
│ incidentId (FK→Incident)     │
└──────────────────────────────┘

TABLE 5: Alert (★ NO MOBILE SUPPORT)
┌──────────────────────────────┐
│ id (PK, UUID)                │
│ type (enum)                  │ ← RISK_ALERT, PUBLIC_ALERT, SHELTER_CAPACITY, RESOURCE_SHORTAGE, INCIDENT_STATUS
│ severity (enum)              │
│ title, description, district │
│ isPublic, isActive           │
│ source                       │
│ createdAt, expiresAt         │
└──────────────────────────────┘
```

## The Problem in One Picture

```
MOBILE APP (SQLite)              BACKEND (PostgreSQL)
═══════════════════════           ════════════════════════
                                  
  events (generic)                User (structured)
  ├─ event_id                     ├─ id
  ├─ type                         ├─ email
  ├─ data (JSON blob) ----X       ├─ role
  ├─ status                       └─ ...
  └─ timestamps                   
                                  IncomingReport (structured)
        ❌ NO MODELS              ├─ id
        ❌ NO RELATIONSHIPS       ├─ source (enum!)
        ❌ NO VERIFICATION        ├─ disasterType (enum!)
        ❌ NO RESOURCES           ├─ verificationStatus (enum!)
        ❌ NO ALERTS              └─ ... 10 more fields
                                  
                                  ConfirmedIncident (structured)
                                  ├─ id
                                  ├─ severity (enum!)
                                  ├─ status (enum!)
                                  └─ ...
                                  
                                  Resource (structured)
                                  Alert (structured)

SYNC ATTEMPT:
Mobile sends: { "type": "SOS", "data": "{...}" }
Backend expects: { "source": "J1_SOS_APP", "disasterType": "FLOOD", "district": "Colombo", ... }
Result: 🔴 MISMATCH - SYNC FAILS
```

## What Needs to Happen

### Mobile SQLite Upgrade Plan

```
PHASE 1: Add 5 New Tables
────────────────────────────────────

TABLE users
├─ user_id (TEXT PK)
├─ email (TEXT UNIQUE)
├─ name (TEXT)
├─ role (TEXT) ← Must match enum
└─ created_at (TEXT)

TABLE incoming_reports (★ REPLACES 'events')
├─ id (TEXT PK)
├─ source (TEXT) ← Must be J1_SOS_APP | J3_PUBLIC_PORTAL | J1_SENSOR_SYSTEM | ...
├─ disaster_type (TEXT) ← FLOOD | LANDSLIDE | OTHER
├─ district (TEXT)
├─ latitude (REAL)
├─ longitude (REAL)
├─ description (TEXT)
├─ contact (TEXT)
├─ media_urls (TEXT) ← JSON array as string
├─ verification_status (TEXT) ← PENDING_REVIEW | VERIFIED | REJECTED | DUPLICATE | ...
├─ created_at (TEXT)
├─ reviewed_at (TEXT NULLABLE)
├─ officer_notes (TEXT NULLABLE)
├─ sos_id (TEXT NULLABLE)
├─ device_id (TEXT NULLABLE)
├─ reviewed_by_id (TEXT FK→users NULLABLE)
├─ incident_id (TEXT FK→confirmed_incidents NULLABLE)
└─ timestamp_submitted (TEXT NULLABLE) ← For sync tracking

TABLE confirmed_incidents
├─ id (TEXT PK)
├─ title (TEXT)
├─ disaster_type (TEXT) ← FLOOD | LANDSLIDE | OTHER
├─ district (TEXT)
├─ severity (TEXT) ← LOW | MEDIUM | HIGH | CRITICAL
├─ status (TEXT) ← ACTIVE | UNDER_RESPONSE | RESOLVED | CLOSED
├─ latitude (REAL)
├─ longitude (REAL)
├─ description (TEXT)
├─ public_visibility (INTEGER) ← BOOLEAN as int
├─ affected_people (INTEGER)
├─ created_at (TEXT)
└─ updated_at (TEXT)

TABLE resources
├─ id (TEXT PK)
├─ type (TEXT) ← RESCUE_TEAM | BOAT | AMBULANCE | SHELTER | MEDICAL_TEAM | FOOD_WATER
├─ name (TEXT)
├─ district (TEXT)
├─ status (TEXT) ← AVAILABLE | ASSIGNED | BUSY | OUT_OF_SERVICE
├─ latitude (REAL NULLABLE)
├─ longitude (REAL NULLABLE)
├─ capacity (INTEGER NULLABLE)
├─ current_load (INTEGER NULLABLE)
├─ last_updated (TEXT)
├─ incident_id (TEXT FK→confirmed_incidents NULLABLE)
└─ synced (INTEGER) ← 0/1 for sync tracking

TABLE alerts
├─ id (TEXT PK)
├─ type (TEXT) ← RISK_ALERT | PUBLIC_ALERT | SHELTER_CAPACITY | RESOURCE_SHORTAGE | INCIDENT_STATUS
├─ severity (TEXT) ← LOW | MEDIUM | HIGH | CRITICAL
├─ title (TEXT)
├─ description (TEXT)
├─ district (TEXT)
├─ is_public (INTEGER) ← BOOLEAN as int
├─ is_active (INTEGER) ← BOOLEAN as int
├─ source (TEXT NULLABLE)
├─ created_at (TEXT)
├─ expires_at (TEXT NULLABLE)
└─ received_at (TEXT) ← For local timestamp


PHASE 2: Create Dart Models
────────────────────────────────────

Required Enums:
├─ ReportSource (enum)
├─ DisasterType (enum)
├─ VerificationStatus (enum)
├─ IncidentSeverity (enum)
├─ IncidentStatus (enum)
├─ ResourceType (enum)
├─ ResourceStatus (enum)
├─ AlertType (enum)
└─ UserRole (enum)

Required Models:
├─ UserModel
├─ IncomingReportModel (replaces EventModel)
├─ ConfirmedIncidentModel
├─ ResourceModel
├─ AlertModel
└─ SyncModel (for tracking sync state)


PHASE 3: Update Database Helper
────────────────────────────────────

New CRUD Methods:
├─ saveIncomingReport()
├─ getIncomingReportsByStatus()
├─ updateReportVerificationStatus()
├─ saveConfirmedIncident()
├─ getIncidentsByDistrict()
├─ saveResource()
├─ getResourcesByStatus()
├─ saveAlert()
├─ getActiveAlerts()
└─ getUnsyncedRecords()


PHASE 4: Update Sync Service
────────────────────────────────────

Bi-directional Sync:
├─ Upload Phase:
│  ├─ Get all QUEUED incoming_reports
│  ├─ Send to backend
│  ├─ Receive verification status
│  ├─ Update local verification_status
│  └─ Mark as SUBMITTED
│
└─ Download Phase:
   ├─ Get new confirmed_incidents from backend
   ├─ Cache locally
   ├─ Get updated resources
   ├─ Cache locally
   ├─ Get new alerts
   └─ Cache locally
```

## Field-by-Field Mapping Needed

### When User Submits SOS Report via Mobile

```
Mobile Form Input          → IncomingReport Backend Fields
─────────────────────────────────────────────────────────

User's description         → description
User's latitude            → latitude
User's longitude           → longitude
User's contact             → contact
Photos/videos uploaded     → mediaUrls (as JSON array)
Selected disaster type     → disasterType (FLOOD|LANDSLIDE|OTHER)
Selected district          → district
Device ID from app         → deviceId (auto-captured)
Current timestamp          → createdAt (auto-set)

System Generated Fields    → 
─────────────────────────────────────────────────────────
Random UUID                → id
"J1_SOS_APP"              → source (system knows it's from SOS)
"PENDING_REVIEW"          → verificationStatus (default)
Null                      → reviewedById (no officer yet)
Null                      → incidentId (not incident yet)
```

## Critical Numbers to Track

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Database Tables | 1 | 6 | +5 tables |
| Fields per Report | 6 | 15 | +9 fields |
| Verification States | 2 | 5 | +3 states |
| Supported Enum Types | 0 | 8 | +8 enums |
| Relationships | 0 | 3 | +3 FK constraints |
| Supported Entity Types | 1 | 5 | +4 types |

---

## Implementation Checklist (Before Coding)

- [ ] Review this analysis document fully
- [ ] Understand backend Prisma schema structure
- [ ] Plan SQLite migration strategy (version 1→2)
- [ ] Design Dart enum definitions
- [ ] Design Dart model classes
- [ ] Plan database helper new methods
- [ ] Plan sync service bi-directional flow
- [ ] Design UI components for new data types
- [ ] Plan error handling for schema mismatches
- [ ] Design data validation for enums
- [ ] Plan rollback strategy for migrations
- [ ] Document mapping between mobile/backend fields

---

**Document Version:** 1.0  
**Last Updated:** May 5, 2026  
**Status:** Pre-Implementation Analysis Complete ✅
