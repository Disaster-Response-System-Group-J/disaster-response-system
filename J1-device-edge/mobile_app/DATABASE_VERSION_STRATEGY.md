# Step 1: Database Version Strategy & Migration Planning

**Date Created:** May 5, 2026  
**Status:** Planning Phase Complete  
**Version:** 1.0

---

## Executive Summary

This document defines the database versioning strategy and migration path from SQLite v1 (current single-table schema) to v2 (new 6-table schema supporting backend synchronization).

---

## Current State (Database Version 1)

### Current Schema
```
Database: j1_disaster_response.db
Version: 1 (in AppConstants.databaseVersion)

Single Table: events
├─ event_id (TEXT PRIMARY KEY)
├─ type (TEXT NOT NULL)
├─ data (TEXT NOT NULL) - JSON blob
├─ status (TEXT NOT NULL) - QUEUED | SUBMITTED | FAILED
├─ timestamp_created (TEXT NOT NULL)
└─ timestamp_submitted (TEXT) - nullable

Estimated Records: 0-100 per user (small dataset)
```

### Current Usage Pattern
```
User creates SOS event
  → Stored in events table as generic JSON
  → Status: QUEUED
  → On sync: Status: SUBMITTED
```

### Current AppConstants
```dart
static const String databaseName = 'j1_disaster_response.db';
static const int databaseVersion = 1;  ← WILL CHANGE TO 2
static const String eventsTable = 'events';
static const String statusQueued = 'QUEUED';
static const String statusSubmitted = 'SUBMITTED';
static const String statusFailed = 'FAILED';
```

---

## Versioning Strategy Decision

### Decision: BACKWARD COMPATIBLE MIGRATION

**Chosen Approach:** Keep old `events` table + Create new tables  
**Rationale:**
- Users with existing queued data won't lose it
- Smooth upgrade path for active users
- Less risky than data migration
- Can deprecate old table in v3

### Migration Path
```
Version 1 (Current)
    ↓ (new app install or upgrade)
Version 2 (Target)
    ↓ (future releases)
Version 3+ (deprecation of events table)
```

---

## Database Version 2 Schema Design

### Version 2 Changes

**New Tables to Add (6 total):**
```
Table 1: users
├─ user_id TEXT PRIMARY KEY
├─ email TEXT UNIQUE
├─ name TEXT
├─ role TEXT (enum string)
└─ created_at TEXT (ISO 8601)

Table 2: incoming_reports
├─ id TEXT PRIMARY KEY (replaces events for new data)
├─ source TEXT (enum string)
├─ disaster_type TEXT (enum string)
├─ district TEXT
├─ latitude REAL
├─ longitude REAL
├─ description TEXT
├─ contact TEXT
├─ media_urls TEXT (JSON array as string)
├─ verification_status TEXT (enum string)
├─ created_at TEXT (ISO 8601)
├─ reviewed_at TEXT (nullable)
├─ officer_notes TEXT (nullable)
├─ sos_id TEXT (nullable)
├─ device_id TEXT (nullable)
├─ reviewed_by_id TEXT FK (nullable)
├─ incident_id TEXT FK (nullable)
└─ timestamp_submitted TEXT (nullable)

Table 3: confirmed_incidents
├─ id TEXT PRIMARY KEY
├─ title TEXT
├─ disaster_type TEXT (enum string)
├─ district TEXT
├─ severity TEXT (enum string)
├─ status TEXT (enum string)
├─ latitude REAL
├─ longitude REAL
├─ description TEXT
├─ public_visibility INTEGER (0/1 for bool)
├─ affected_people INTEGER
├─ created_at TEXT (ISO 8601)
└─ updated_at TEXT (ISO 8601)

Table 4: resources
├─ id TEXT PRIMARY KEY
├─ type TEXT (enum string)
├─ name TEXT
├─ district TEXT
├─ status TEXT (enum string)
├─ latitude REAL (nullable)
├─ longitude REAL (nullable)
├─ capacity INTEGER (nullable)
├─ current_load INTEGER (nullable)
├─ last_updated TEXT (ISO 8601)
├─ incident_id TEXT FK (nullable)
└─ synced INTEGER (0/1)

Table 5: alerts
├─ id TEXT PRIMARY KEY
├─ type TEXT (enum string)
├─ severity TEXT (enum string)
├─ title TEXT
├─ description TEXT
├─ district TEXT
├─ is_public INTEGER (0/1 for bool)
├─ is_active INTEGER (0/1 for bool)
├─ source TEXT (nullable)
├─ created_at TEXT (ISO 8601)
└─ expires_at TEXT (nullable)

Table 6: sync_metadata
├─ record_id TEXT PRIMARY KEY
├─ record_type TEXT (enum: report|incident|resource|alert|user)
├─ sync_status TEXT (enum: pending|uploading|uploaded|failed)
├─ last_sync_attempt TEXT (ISO 8601, nullable)
├─ sync_error_message TEXT (nullable)
├─ retry_count INTEGER (default 0)
└─ created_at TEXT (ISO 8601)

Old Table (Deprecated but Kept):
Table: events (FROM V1)
├─ event_id TEXT PRIMARY KEY
├─ type TEXT NOT NULL
├─ data TEXT NOT NULL
├─ status TEXT NOT NULL
├─ timestamp_created TEXT NOT NULL
└─ timestamp_submitted TEXT
```

**Retention Strategy for V1:**
- Keep `events` table for backward compatibility
- Mark as deprecated in code comments
- New data goes to `incoming_reports`
- Data in `events` can be manually cleared via admin function
- Will be dropped in v3 (planned for Q3 2026)

---

## Data Migration Strategy

### Scenario 1: Fresh Install (No Existing Data)
```
User installs app fresh
  → Database created with v2 schema
  → All 6 new tables created
  → No migration needed
  → events table exists but empty
```

### Scenario 2: App Upgrade (Has Existing Data)
```
User has app v1 with 10 queued events
  → App triggers database upgrade
  → onUpgrade(1, 2) called
  ├─ Backup events table data (in memory)
  ├─ Create 6 new tables
  ├─ Optional: Migrate events data to incoming_reports
  │   └─ Parse JSON from events.data
  │   └─ Map to incoming_reports structure
  │   └─ Keep track of migration
  └─ Update version to 2

Post-Migration Status:
  ├─ events table: has original data (unchanged)
  ├─ incoming_reports: has migrated data (optional)
  └─ Ready for new sync with v2 schema
```

### Migration Decision: OPTIONAL DATA MIGRATION

**Recommended Approach:** NO automatic migration of events data

**Reasons:**
- `events.data` is generic JSON blob (can't reliably parse)
- Risk of data corruption
- Users likely want fresh sync anyway
- Can provide manual migration tool if needed
- Cleaner approach for new schema adoption

**Instead:**
- Keep events table untouched
- Warn user if events table has unsynced data
- User can re-create SOS reports manually
- Or provide export/import tool separately

---

## Timestamp Format Decision

### Format: ISO 8601 String (RFC 3339)

**Chosen Format:** `2026-05-05T14:30:45Z` (UTC always)

**Storage:**
- SQLite: TEXT type
- Dart: String (parse with DateTime.parse())
- Backend: JSON DateTime format

**Reasoning:**
- Backend Prisma uses DateTime ISO 8601
- Easy to compare (string comparison works for ISO 8601)
- Sortable directly in SQL
- Human-readable for debugging
- No timezone ambiguity (always UTC)

**Examples:**
```sql
-- Current system time in UTC
SELECT datetime('now') || 'Z'  -- 2026-05-05T14:30:45Z

-- Comparison in SQL
WHERE created_at > '2026-05-04T00:00:00Z'

-- Sorting
ORDER BY created_at DESC
```

**Dart Parsing:**
```dart
DateTime created = DateTime.parse(timestamp); // Handles ISO 8601
String iso = DateTime.now().toUtc().toIso8601String(); // Create ISO
```

---

## Database Version Update Checklist

### Update AppConstants
```dart
// BEFORE (v1):
static const int databaseVersion = 1;

// AFTER (v2):
static const int databaseVersion = 2;

// ADD new table names:
static const String usersTable = 'users';
static const String incomingReportsTable = 'incoming_reports';
static const String confirmedIncidentsTable = 'confirmed_incidents';
static const String resourcesTable = 'resources';
static const String alertsTable = 'alerts';
static const String syncMetadataTable = 'sync_metadata';
```

---

## Error Handling & Rollback Strategy

### Rollback Scenarios

#### Scenario 1: Migration Fails
```
onUpgrade fails halfway through
  → Database left in inconsistent state
  → SQLite has transaction support
  → Wrap in transaction
  → On error: rollback automatically

Solution:
  db.transaction(() async {
    // All new table creates
    // If any fails, entire transaction rolls back
  });
```

#### Scenario 2: Old Version Requirement
```
User downgrades app (unlikely but possible)
  → App expects v2
  → Database is v2
  → No backwards compatibility in onUpgrade
  
Solution:
  - Document minimum version requirement
  - Request app update in UI
  - Prevent downgrade in store deployment
```

#### Scenario 3: Corrupted Migration
```
Database file corrupted during upgrade
  → onUpgrade has error
  → Database unusable

Solution:
  - Catch exception in _initDatabase()
  - Delete corrupted database file
  - Recreate from scratch (v2)
  - Log incident for debugging
  
Code:
  try {
    await openDatabase(...)
  } catch (e) {
    await deleteDatabase(path);
    return await openDatabase(...); // Fresh v2
  }
```

---

## Data Retention Policies

### events Table (Deprecated)
- **Retention Period:** Until v3 release (Q3 2026)
- **Cleanup:** Optional - admin can call `clearOldEventTable()`
- **Purpose:** Backward compatibility for v1 users
- **Risk:** None - doesn't interfere with v2 operations

### incoming_reports Table (New)
- **Retention Period:** Until DELETED by user or CONVERTED_TO_INCIDENT
- **Cleanup:** Manual - user can delete old reports
- **Sync:** Synced to backend before deletion recommended
- **Risk:** Data loss if deleted before sync

### confirmed_incidents Table (New)
- **Retention Period:** Indefinite (reference data)
- **Cleanup:** Manual - user can archive old incidents
- **Sync:** Downloaded from backend (should not delete)
- **Risk:** None - view-only primarily

### resources & alerts Tables (New)
- **Retention Period:** Until expires or manually cleared
- **Cleanup:** Auto-delete expired alerts
- **Sync:** Downloaded from backend
- **Risk:** None - refreshed from backend regularly

### sync_metadata Table (New)
- **Retention Period:** 7 days after successful sync
- **Cleanup:** Auto-cleanup on full sync
- **Purpose:** Track sync state and retry logic
- **Risk:** Disk space (minimal) - should stay <1MB

---

## Version Upgrade Transition Plan

### Phase 1: Deploy v1.1
- Include database v2 preparation code
- Add deprecation warnings in logs
- Document migration steps for users
- **Timeline:** Week 1

### Phase 2: Deploy v2.0
- Activate onUpgrade(1, 2) logic
- Create all new tables
- Users auto-upgrade on app open
- **Timeline:** Week 2-3

### Phase 3: Monitor & Stabilize
- Check error logs for migration issues
- Support users with upgrade problems
- Verify sync works with new schema
- **Timeline:** Week 3-4

### Phase 4: v3 Plan (Future)
- Deprecate events table
- Migrate any remaining v1 data
- Clean up backward compatibility code
- **Timeline:** Q3 2026

---

## Testing Strategy for Migration

### Unit Tests Needed
```dart
- Test _onCreate() creates all 6 tables
- Test _onUpgrade(1, 2) succeeds
- Test onUpgrade preserves events table
- Test transactions rollback on error
- Test corrupted database recovery
```

### Integration Tests Needed
```dart
- Fresh install: creates v2 database ✓
- v1 → v2 upgrade: preserves data ✓
- Multiple upgrades in sequence ✓
- Corrupted database recovery ✓
- Sync with new tables ✓
```

### Manual Testing Checklist
```
- [ ] Fresh install on Android: schema v2
- [ ] Fresh install on iOS: schema v2
- [ ] Upgrade from v1 (if test build available)
- [ ] All CRUD operations work on new tables
- [ ] Timestamps format correct in SQLite
- [ ] Sync works with new structure
- [ ] No crashes on app open
```

---

## Decisions Made for Step 1

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Migration Strategy** | Backward Compatible (keep v1 table) | Safe for active users |
| **Data Migration** | Optional (no auto-migration) | events data is generic JSON |
| **Timestamp Format** | ISO 8601 UTC strings | Backend compatible |
| **Version Number** | v1 → v2 | Major schema change |
| **Transaction Support** | Yes (wrap in db.transaction) | Safety for partial failures |
| **Rollback Strategy** | Auto-rollback on error | SQLite transactions handle |
| **Deprecation** | v1 table deprecated at v3 | Grace period for v1 users |
| **Error Recovery** | Delete + recreate on corruption | Prevents stuck database |

---

## Next Steps (For Step 2 & Beyond)

After this Step 1 planning, here's what comes next:

1. **Step 2:** Enum specification (what values each enum has)
2. **Step 3:** Model design (Dart class structure)
3. **Step 4-6:** Create actual enum code
4. **Step 7-11:** Create actual model classes
5. **Step 12:** Use this plan to update AppConstants
6. **Step 13:** Use this plan to write CREATE TABLE statements
7. **Step 14:** Implement the _onUpgrade() based on this strategy

---

## Files That Will Be Modified (in later steps)

```
Step 12-14 will modify:
  lib/services/database_helper.dart
    ├─ AppConstants.databaseVersion = 2
    ├─ Add new table constant names
    ├─ Update _onCreate() to create 6 tables
    └─ Implement _onUpgrade(1, 2)
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Migration fails | Low | High | Transaction + rollback |
| Data corruption | Low | Medium | Delete + recreate |
| User confusion | Medium | Low | Clear UI messages |
| Sync incompatibility | Low | High | Testing before deploy |
| Disk space issues | Very Low | Low | sync_metadata cleanup |

---

## Approval & Sign-Off

**Strategy Approved:** ✅ Yes  
**Ready for Step 2:** ✅ Yes  
**Ready for Implementation:** ✅ Yes (Steps 12-14)

---

**Document Status:** Complete  
**Last Updated:** May 5, 2026  
**Next Document:** ENUM_SPECIFICATION.md (Step 2)
