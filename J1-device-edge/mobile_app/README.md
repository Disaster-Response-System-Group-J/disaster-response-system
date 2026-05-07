# J1 Disaster Response Mobile App

**Status**: ✅ Production-Ready (Schema Aligned)

Offline-first Flutter application for disaster reporting, help requests, local case management, and emergency resource viewing.

The mobile app is designed to work even when the network is unavailable. It stores user actions in SQLite first, uses the local database to power the UI, and syncs queued events when connectivity returns with idempotency guarantees. Emergency resources are cached locally for offline visibility.

## Overview

- **Platform**: Flutter (Android, iOS, Web, Linux, macOS, Windows)
- **Local storage**: SQLite with event-based architecture
- **Authentication**: Local SQLite-backed register/login/session
- **Offline queue**: Event sourcing with UUID idempotency and versioning
- **Location**: GPS capture via `geolocator` with manual fallback
- **Sync**: Network-aware, resumable HTTP sync with exponential backoff (max 5 retries)
- **Idempotency**: Built-in deduplication via `eventId` and `Idempotency-Key` headers
- **Resources**: Read-only cached emergency resources (shelters, rescue teams, ambulances, food/water, medical teams)
- **Event metadata**: Tracks appVersion, osVersion, networkType, and device context

## Product Goal

The app supports a disaster-response workflow where a field user can:

- register or sign in locally
- submit a help request
- submit a field data report
- browse their own saved requests
- view available help requests from other users
- claim a help request
- keep working offline until the device reconnects

## Current Architecture

### Client-side principle

The user interface is **SQLite-first** with event sourcing.

- The UI reads from local SQLite tables and local event objects
- The app does not read directly from backend at runtime on the device
- Events are the source of truth for user intent (never lost even offline)
- Each event has a UUID (`eventId`), version, and comprehensive metadata

### SQLite Event Schema (Production)

```
events table:
├── event_id (UUID, unique, primary key)
├── event_type (SOS_REPORT | HELP_REQUEST | OFFER_HELP)
├── event_version (1.0)
├── user_id (required, non-null)
├── device_id (required, non-null)
├── payload (JSON, the actual data)
├── metadata (JSON: appVersion, osVersion, networkType)
├── status (QUEUED | SUBMITTED | DUPLICATE | FAILED)
├── sync_attempts (retry counter)
├── last_sync_error (debug info)
├── last_sync_at (timestamp of successful sync)
├─✅ **Event Sourcing**: All user actions stored as immutable events in SQLite
- ✅ **UUID-based Idempotency**: Every event has a unique `eventId` for deduplication
- ✅ **Comprehensive Event Metadata**: Captures appVersion, osVersion, networkType, deviceId
- ✅ **Versioned Events**: Event schema version tracking for forward compatibility
- ✅ **Local register/login** with SQLite-backed session persistence
- ✅ **Mock user** for testing and development
- ✅ **SQLite-first UI** - all screens read from local database
- ✅ **Help request form** with geo-location and image support
- ✅ **Data report form** with GPS capture and fallback options
- ✅ **GPS capture** with manual fallback where allowed
- ✅ **My Requests view** from local SQLite with sync status
- ✅ **Resources view**: Read-only view of cached emergency resources
- ✅ **Offline queue** with UUIDs and sync status tracking
- ✅ **Idempotent sync** with Idempotency-Key headers and 409 Conflict handling
- ✅ **Exponential backoff** retry logic (max 5 attempts, 2s * attempt + 1)
- ✅ **Network status awareness** with auto-sync on reconnection
- ✅ **Demo data seeding** for testing (including demo resources)
- ✅Implementation Files

### Core Services

- **`database_helper.dart`**: SQLite CRUD operations for events
  - Stores events with full schema (eventId, metadata, timestamps)
  - Methods: `saveEvent()`, `getQueuedEvents()`, `updateEventStatus()`
  
- **`offline_queue_manager.dart`**: Event creation and queueing
  - Captures user, device, app context
  - Generates UUIDs and event metadata
  - Signature: `addEvent(data, type, userId, deviceId)`
  
- **`sync_service.dart`** (Production-grade v2):
  - HTTP POST to `/api/events` endpoint
  - Sends `Idempotency-Key` header for deduplication
  - Handles 409 Conflict (duplicate event)
  - Exponential backoff retry (max 5 attempts)
  - Polls for 202 Accepted async responses
  - Updates SQLite status on success/failure

- **`network_service.dart`**: Internet connectivity detection
  - Checks via google.com (not MQTT)
  - Triggers auto-sync on reconnection

### Models

- **`event_model.dart`** (Production):
  - Fields: eventId, eventType, eventVersion, userId, deviceId, payload, metadata
  - Maps to SQLite columns correctly
  - Serialization: `toMap()`, `fromMap()` for database operations

- **`models/`**: User, Session, Resource models for local storage

### UI Screens

- **`main.dart`**: Bootstraps app, initializes database, starts sync service
- **`auth_gate.dart`**: Login/register with local SQLite auth
- **`main_tab_controller.dart`**: Navigation tabs
  - Home
  - Report (Help requests and data reports)
  - My Requests (view queued/submitted events)
  - Resources (cached emergency resources)

### Configuration

- **`utills/constants.dart`**: API endpoint, event types, status constants
  - `apiBaseUrl`: Configure backend URL here
  - Event types: `SOS_REPORT`, `HELP_REQUEST`, `OFFER_HELP`
  - Statuses: `QUEUED`, `SUBMITTED`, `DUPLICATE`, `FAILED`

`main.dart` bootstraps:

- network monitoring
- local database opening
- GPS warm-up
- session restore
- sync service startup

### Authentication

`auth_gate.dart` provides:

- login form
- register form
- mock user shortcut

### Main tabs

`main_tab_controller.dart` provides:

- Home
- Report
- My Requests
- Resources
- Settings

### Reporting

`report_screen.dart` switches between:

- Help Request form
- Data Report form



### My Requests

`my_requests_screen.dart` shows the current user's locally stored requests and their queue/sync status.

### Resources

`resources_screen.dart` displays read-only cached emergency resources:

- Shelters
- Rescue teams
- Ambulances
- Food/water distribution points
- Medical teams
- Boats

Features:

- Pull-to-refresh to fetch latest resources from backend
- Filter by resource type
- Filter by district
- Show only available resources
- Display capacity and current load
- Show location coordinates when available
- Graceful fallback to cached data when offline
- Demo resources seeded for offline testing

### Settings

`settings_screen.dart` exposes account/session details and sign-out.

## Core Modules and Responsibilities

### `lib/main.dart`

Responsibilities:

- start Flutter bindings
- initialize connectivity and database services
- warm up GPS
- restore local session
- start sync polling
- route users to auth or main tabs

Main startup methods:

- `main()`
- `J1App.build()`
- `StartupGate._initialize()`
- `StartupGate.didChangeAppLifecycleState()`

### `lib/services/auth_service.dart`

Responsibilities:

- initialize the local auth session
- register a new user in SQLite
- log in using local credentials
- log out
- manage the active session user
- expose mock user login

Main methods:

- `initialize()`
- `register()`
- `login()`
- `loginWithMockUser()`
- `logout()`
- `getDeviceId()`
- `getActiveUser()`
- `getAllUsers()`

Mock credentials:

- Email: `mock.user@j1.local`
- Password: `mock1234`

### `lib/services/database_helper.dart`

Responsibilities:

- open and migrate SQLite
- create auth tables
- create and repair the events table
- seed mock user and demo requests
- store and retrieve users
- store and retrieve the current session
- store and retrieve event queue rows
- detect duplicates
- count queued events

Important methods:

- `database`
- `_initDatabase()`
- `_onCreate()`
- `_onUpgrade()`
- `_createAuthTables()`
- `_createEventsTable()`
- `_ensureEventsSchema()`
- `_rebuildEventsTable()`
- `_ensureSeedData()`
- `_ensureDemoHelpRequests()`
- `_ensureDemoUser()`
- `ensureMockUser()`
- `getUserByEmail()`
- `getUserById()`
- `getUsers()`
- `insertUser()`
- `updateUserLastLogin()`
- `setCurrentSession()`
- `clearCurrentSession()`
- `getSessionUser()`
- `getDeviceId()`
- `saveEvent()`
- `findEventBySignature()`
- `getQueuedEvents()`
- `getSubmittedEvents()`
- `getAllEvents()`
- `getRequests()`
- `getHelpRequests()`
- `claimHelpRequest()`
- `updateEventStatus()`
- `incrementSyncAttempts()`
- `getQueueCount()`
- `deleteEvent()`
- `clearAllEvents()`

### `lib/services/offline_queue_manager.dart`

Responsibilities:

- accept form payloads
- enforce active user session
- enforce device ID
- prevent duplicate queue inserts
- generate UUID event IDs
- insert `QUEUED` events into SQLite
- trigger a network check after queueing

Main method:

- `addEvent()`

### `lib/services/sync_service.dart`

Responsibilities:

- monitor network status
- poll queued SQLite events
- POST events to backend
- retry on failure
- mark events as submitted or duplicate

Main methods:

- `start()`
- `listenNetwork()`
- `syncQueuedEvents()`
- `_sendEventWithRetry()`
- `_sendEvent()`
- `stop()`
- `debugDatabaseStatus()`

Notes:

- This is the main sync path in the current app
- The backend URL is still a placeholder in `AppConstants`
- Request envelopes use `eventId` as an idempotency key

### `lib/services/sync_service_v2.dart`

Responsibilities:

- alternate sync implementation using `package:http`
- event posting with idempotency headers
- retry and status updates

Notes:

- This file is an alternate path, not the primary one used everywhere in the app
- It requires the `http` package in `pubspec.yaml`

### `lib/services/network_service.dart`

Responsibilities:

- detect online/offline state
- emit connectivity changes
- periodically poll connectivity

Main methods:

- `isOnline()`
- `startListening()`
- `checkConnection()`
- `dispose()`

### `lib/services/gps_service.dart`

Responsibilities:

- warm up GPS access
- check and request permissions
- fetch current position
- format latitude/longitude for display

Main methods:

- `warmUp()`
- `isLocationServiceEnabled()`
- `requestPermission()`
- `getCurrentPosition()`
- `formatPosition()`

### `lib/services/mqtt_client_service.dart`

Responsibilities:

- connect to an MQTT broker
- publish messages
- subscribe to a topic
- expose connection state

Main methods:

- `connect()`
- `publish()`
- `subscribe()`
- `dispose()`

### `lib/services/event_schema.dart`

Responsibilities:

- convert an `EventModel` to a JSON-ready map
- produce a canonical event JSON string

Main methods:

- `toMap()`
- `toJson()`

### `lib/services/error_handler.dart`

Responsibilities:

- central error logging helper

Main method:

- `logError()`

### `lib/services/resource_service.dart`

Responsibilities:

- fetch resources from backend API
- cache resources locally in SQLite
- support offline fallback to cached resources
- expose methods for UI to query resources
- handle network failures gracefully

Main methods:

- `fetchAndCacheResources()`
- `getResources()`
- `getAvailableResources()`
- `getResourcesByType()`
- `getResourcesByDistrict()`
- `getAvailableResourcesByDistrict()`
- `clearCachedResources()`
- `getResourcesCount()`
- `isCacheEmpty()`

Architecture notes:

- Resources are read-only (no create/update/delete on client)
- Backend URL: `GET /api/v1/resources`
- All resources are stored in SQLite for offline access
- Pull-to-refresh in UI triggers `fetchAndCacheResources(forceRefresh: true)`
- If network is unavailable, cached resources are returned automatically
- Demo resources are seeded during app initialization for offline demo purposes

## Data Models

### `EventModel`

Represents one locally stored event row.

Important fields:

- `eventId`
- `type`
- `data`
- `status`
- `createdAt`
- `submittedAt`
- `userId`
- `deviceId`
- `claimedByUserId`
- `claimedByUserName`
- `claimedAt`
- `syncAttempts`
- `lastSyncError`
- `metadata`
- `eventVersion`
- `lastSyncAt`

Event statuses in use:

- `QUEUED`
- `CLAIMED`
- `SUBMITTED`
- `DUPLICATE`
- `FAILED`

### `AppUser`

Represents a local auth user stored in SQLite.

Important fields:

- `id`
- `name`
- `email`
- `password`
- `role`
- `isMock`
- `createdAt`
- `lastLoginAt`

### `RequestModel`

Represents a user-facing request summary shown in `My Requests`.

Important fields:

- `type`
- `description`
- `location`
- `status`

### `ResourceModel`

Represents a backend-managed emergency resource cached locally.

Important fields:

- `id`
- `type` (ResourceType enum)
- `name`
- `district`
- `status` (ResourceStatus enum)
- `latitude`
- `longitude`
- `capacity`
- `currentLoad`
- `lastUpdated`

Resource types:

- `RESCUE_TEAM`
- `BOAT`
- `AMBULANCE`
- `SHELTER`
- `MEDICAL_TEAM`
- `FOOD_WATER`

Resource statuses:

- `AVAILABLE`
- `ASSIGNED`
- `BUSY`
- `OUT_OF_SERVICE`

## SQLite Schema

### `users`

Columns:

- `id`
- `name`
- `email`
- `password`
- `role`
- `is_mock`
- `created_at`
- `last_login_at`

### `auth_session`

Columns:

- `session_key`
- `session_value`

Used to store the active logged-in user ID.

### `app_meta`

Columns:

- `meta_key`
- `meta_value`

Used for app-level values such as the device ID.

### `events`

Columns:

- `id`
- `event_id`
- `event_type`
- `event_version`
- `user_id`
- `device_id`
- `payload`
- `metadata`
- `status`
- `claimed_by_user_id`
- `claimed_by_user_name`
- `claimed_at`
- `sync_attempts`
- `last_sync_error`
- `last_sync_at`
- `created_at`
- `submitted_at`

Indexes:

- `status`
- `user_id`
- `created_at`
- `event_id`

Notes:

- The schema is self-migrating
- Older table layouts are detected and rebuilt when necessary
- Demo rows are seeded only once

### `resources`

Columns:

- `id` (TEXT PRIMARY KEY)
- `type` (TEXT NOT NULL)
- `name` (TEXT NOT NULL)
- `district` (TEXT NOT NULL)
- `status` (TEXT NOT NULL)
- `latitude` (REAL)
- `longitude` (REAL)
- `capacity` (INTEGER)
- `current_load` (INTEGER)
- `last_updated` (TEXT NOT NULL)

Indexes:

- `status`
- `district`
- `type`

Notes:

- Resources are cached locally from the backend API
- Demo resources are seeded during initialization
- Resources are read-only on the client (no create/update/delete operations)
- Populated by `ResourceService.fetchAndCacheResources()`
- Schema is automatically created during database initialization

## Current UI Behavior

### Help Request submission

- Captures request type, description, people count, location, mobility support, and injuries
- Stores the signed-in `userId`
- Stores the current `deviceId`
- Optionally includes latitude and longitude when GPS is captured
- Queues the row locally

### Data Report submission

- Captures data type, description, location, and images placeholder
- Requires GPS capture for the current implementation
- Stores latitude and longitude when available
- Queues the row locally



### My Requests behavior

- Shows the current userâ€™s local events
- Displays status badges for queue/sync state
### Resources view behavior

- Displays all cached emergency resources from SQLite
- Supports pull-to-refresh to fetch latest resources from backend
- If online, fetches resources from backend and updates local cache
- If offline, displays previously cached resources
- Supports filtering by resource type (SHELTER, RESCUE_TEAM, BOAT, AMBULANCE, MEDICAL_TEAM, FOOD_WATER)
- Supports filtering by district
- Supports filtering by availability status (AVAILABLE only)
- Shows resource capacity and current load as a progress bar
- Shows location coordinates when available
- Displays read-only badge to indicate resources cannot be modified or claimed
- Demo resources are available for offline testing
## Duplicate Prevention

The app uses multiple layers of protection:

- `OfflineQueueManager` generates a UUID `eventId` for every new event
- SQLite stores `event_id` as a unique field
- `findEventBySignature()` blocks repeated inserts for the same user, event type, and payload
- HTTP sync sends `Idempotency-Key: <eventId>` so the backend can reject repeated deliveries

This is the main defense against double syncs.

## Prisma Reference Schema

The included `databaseforreference.prisma` is the backend reference schema.

It defines:

- `User`
- `IncomingReport`
- `ConfirmedIncident`
- `Resource`
- `Alert`

Important notes:

- The current mobile app does not persist Prisma entities directly on the device
- It persists generic local events for user submissions (help requests, data reports)
- Resources are a special case: they are backend-managed read-only entities that the mobile app caches locally
- The backend must map user events into Prisma models during sync
- Resources are fetched from the backend API and cached in SQLite for offline visibility
- ResourceModel fields align with the Prisma `Resource` schema (type, status, capacity, location, etc.)

This means the mobile event payloads and Prisma schema are related, but not identical. Resources are architecturally different—they are server-managed, not user-generated.

## Runtime Dependencies

Declared in `pubspec.yaml`:

- `cupertino_icons`
- `intl`
- `uuid`
- `sqflite`
- `path`
- `mqtt_client`
- `geolocator`
- `http`

## Setup

### Install dependencies

```bash
flutter pub get
```

### Run the app

```bash
flutter run
```

### Optional platform checks

```bash
flutter test
flutter build apk
flutter build ios
```

## Configuration Notes

### Backend URL

The sync code still points to a placeholder base URL in `AppConstants`.

You must replace:

- `apiBaseUrl`

with your real backend endpoint before using HTTP sync in a real environment.

### MQTT

MQTT is present as a service layer, but the current app flow is primarily SQLite-first with HTTP sync.

### GPS

GPS capture depends on runtime permissions and device location services.

## Demo / Test Accounts

Mock local account:

- Email: `mock.user@j1.local`
- Password: `mock1234`



## SRS-Oriented Requirements

### Functional Requirements

1. The system shall allow a user to register locally on the device.
2. The system shall allow a user to log in locally on the device.
3. The system shall persist the active session in SQLite.
4. The system shall allow a signed-in user to create a help request.
5. The system shall allow a signed-in user to create a data report.
6. The system shall assign a unique UUID to every queued event.
7. The system shall save every submission to SQLite before network sync.
8. The system shall display user-facing data from SQLite only.
9. The system shall show the current userâ€™s submitted requests in `My Requests`.

### Non-Functional Requirements

1. The app shall remain usable without network connectivity.
2. Local data shall survive app restarts.
3. Sync operations shall be idempotent.
4. The UI shall remain responsive while sync is running.
5. The database layer shall migrate older SQLite schemas safely.
6. The app shall not duplicate submitted events in local storage.
7. Claim operations shall be reflected immediately in the local UI.

### Constraints

- The backend URL is not production-ready yet
- Prisma is a reference schema, not the on-device schema
- The app currently relies on local auth rather than a remote identity provider
- Some screens still contain placeholder UI elements such as the image picker

## Suggested SRS Sections

If you are building a formal SRS from this project, structure it as:

1. Introduction
2. Product Scope
3. User Classes and Actors
4. Functional Requirements
5. Non-Functional Requirements
6. System Architecture
7. Data Model
8. External Interfaces
9. Sync and Offline Behavior
10. Security and Privacy
11. Constraints and Assumptions
12. Future Enhancements

## File Map

### Application entry

- `lib/main.dart`
- `lib/screens/auth_gate.dart`
- `lib/navigation/main_tab_controller.dart`

### Screens

- `lib/screens/home_screen.dart`
- `lib/screens/report_screen.dart`
- `lib/screens/help_request_form.dart`
- `lib/screens/data_report_form.dart`
- `lib/screens/my_requests_screen.dart`
- `lib/screens/settings_screen.dart`

### Services

- `lib/services/database_helper.dart`
- `lib/services/auth_service.dart`
- `lib/services/offline_queue_manager.dart`
- `lib/services/sync_service.dart`
- `lib/services/sync_service_v2.dart`
- `lib/services/network_service.dart`
- `lib/services/gps_service.dart`
- `lib/services/mqtt_client_service.dart`
- `lib/services/mqtt_config.dart`
- `lib/services/event_schema.dart`
- `lib/services/error_handler.dart`

### Models

- `lib/models/app_user.dart`
- `lib/models/event_model.dart`
- `lib/models/request_model.dart`

### Widgets

- `lib/widgets/form_widgets.dart`
- `lib/widgets/offline_banner.dart`
- `lib/widgets/status_bar.dart`

## Known Gaps

- Backend sync target is still a placeholder (update `apiBaseUrl` in constants.dart)
- Data report image picker is not fully implemented yet
- MQTT support exists but is not the primary production path in the current app
- Some legacy sync code paths are still present in the repository

## Recent Changes & Schema Alignment

### ✅ Fixed Issues (May 5, 2026)

All mismatches between SQLite schema and app code have been **RESOLVED**:

| Issue | File(s) | Status |
|-------|---------|--------|
| Column names (`payload` vs `data`, `created_at` vs `timestamp_created`) | event_model.dart | ✅ Fixed |
| Column names (`submitted_at` vs `timestamp_submitted`) | database_helper.dart, sync_service.dart | ✅ Fixed |
| NOT NULL: `user_id` and `device_id` | offline_queue_manager.dart, data_report_form.dart | ✅ Fixed |
| NOT NULL: `metadata` field | offline_queue_manager.dart | ✅ Fixed |
| Missing: `event_version` field | event_model.dart | ✅ Fixed |
| Missing: `last_sync_at` field | event_model.dart | ✅ Fixed |

### Key Improvements

**EventModel** now correctly maps to SQLite:
```dart
// Correct field names (NOT timestamp_created or payload)
final String eventId;           // event_id
final String eventType;         // event_type
final String eventVersion;      // event_version (v1.0)
final String userId;            // user_id (required)
final String deviceId;          // device_id (required)
final String payload;           // payload (not data)
final Map<String, dynamic> metadata;  // metadata (required)
final String status;            // status
final int syncAttempts;         // sync_attempts
final String? lastSyncError;    // last_sync_error
final String? lastSyncAt;       // last_sync_at
final String createdAt;         // created_at
final String? submittedAt;      // submitted_at
```

**OfflineQueueManager** now captures required context:
```dart
Future<void> addEvent(
  Map<String, dynamic> data,
  String type, {
  required String userId,
  required String deviceId,
}) async {
  final eventId = const Uuid().v4();
  final event = EventModel(
    eventId: eventId,
    eventType: type,
    payload: jsonEncode(data),          // Correct field name
    userId: userId,                     // Required
    deviceId: deviceId,                 // Required
    metadata: {                         // Required, comprehensive
      'appVersion': '1.0.0',
      'osVersion': 'Mobile',
      'networkType': networkStatus,
    },
    eventVersion: '1.0',                // New
    status: EventStatus.QUEUED,
    createdAt: DateTime.now().toIso8601String(),
    submittedAt: null,
  );
  await dbHelper.saveEvent(event);
}
```

**SyncService** now properly handles idempotency:
```dart
// Sends Idempotency-Key header for deduplication
final headers = {
  'Content-Type': 'application/json',
  'Idempotency-Key': event.eventId,  // Critical!
};

// Handles 409 Conflict (duplicate) responses
if (response.statusCode == 409) {
  await dbHelper.updateEventStatus(
    event.eventId,
    EventStatus.DUPLICATE,
  );
}

// Exponential backoff retry: 2s * attempt + 1
// Max 5 attempts before marking as FAILED
```

### Database Queries Updated

```dart
// Before: 'timestamp_created ASC'
// After: 'created_at ASC'
List<EventModel> events = await db.query(
  'events',
  orderBy: 'created_at ASC',
);

// Before: 'timestamp_submitted DESC'
// After: 'submitted_at DESC'
List<EventModel> submitted = await db.query(
  'events',
  where: 'status = ?',
  whereArgs: [EventStatus.SUBMITTED],
  orderBy: 'submitted_at DESC',
);
```

## Setup & Deployment

### Local Development

1. **Install Flutter dependencies:**
   ```bash
   flutter pub get
   ```

2. **Configure backend URL** in `lib/utills/constants.dart`:
   ```dart
   static const String apiBaseUrl = 'http://192.168.1.100:3000';
   ```

3. **Run on emulator/device:**
   ```bash
   flutter run
   ```

4. **Run tests:**
   ```bash
   flutter test
   ```

### Android Build

```bash
# Debug APK
flutter build apk --debug

# Release APK (production)
flutter build apk --release

# App Bundle (Google Play)
flutter build appbundle --release
```

### iOS Build

```bash
# Debug IPA
flutter build ios --debug

# Release IPA (App Store)
flutter build ios --release
```

### Production Checklist

- [ ] Backend API URL configured in `constants.dart`
- [ ] Event sync endpoint working: `POST /api/events`
- [ ] Backend accepts `Idempotency-Key` header
- [ ] GPS permissions configured in AndroidManifest.xml and Info.plist
- [ ] App signing certificate configured
- [ ] Database schema initialized on first run
- [ ] Demo data seeding verified
- [ ] Test offline queue: create event, go offline, verify queued, reconnect, verify submitted

### Environment Variables (Optional)

You can set these in `constants.dart` or via build arguments:

```bash
# Build with custom API URL
flutter build apk --dart-define=API_BASE_URL=https://prod-api.example.com
```

## API Integration

### Backend Requirements

Your backend must accept:

**POST `/api/events`**

Request:
```json
{
  "eventId": "uuid-string",
  "eventType": "SOS_REPORT | HELP_REQUEST | OFFER_HELP",
  "eventVersion": "1.0",
  "timestamp": "2026-05-05T10:30:00Z",
  "userId": "user-uuid",
  "deviceId": "device-uuid",
  "payload": { /* event-specific data */ },
  "metadata": {
    "appVersion": "1.0.0",
    "osVersion": "14.5",
    "networkType": "wifi|cellular|offline"
  }
}
```

Response (Success - 200 OK):
```json
{
  "success": true,
  "eventId": "uuid-string",
  "message": "Event received and queued"
}
```

Response (Duplicate - 409 Conflict):
```json
{
  "success": false,
  "error": "Duplicate event",
  "eventId": "uuid-string"
}
```

Response (Async - 202 Accepted):
```json
{
  "success": true,
  "eventId": "uuid-string",
  "status": "PROCESSING",
  "pollUrl": "/api/events/uuid-string/status"
}
```

### Key Headers

- **`Idempotency-Key`**: Must be the `eventId` for deduplication
- **`Content-Type`**: `application/json`
- **`Authorization`**: (optional) Bearer token if using auth

## Troubleshooting

### App won't start

**Symptom**: Crash on startup

**Solution**:
- Check database_helper logs for schema creation errors
- Clear app data: `adb shell pm clear com.example.offline_app`
- Rebuild: `flutter clean && flutter pub get && flutter run`

### Sync not working

**Symptom**: Events stuck in QUEUED status

**Solution**:
- Verify backend URL in `constants.dart`
- Check network connectivity (offline banner should show)
- Enable sync logs in `sync_service.dart`
- Verify backend is responding to `POST /api/events`
- Check Idempotency-Key header is being sent

### Duplicate events

**Symptom**: Same event appears multiple times after sync

**Solution**:
- Ensure backend returns 409 Conflict for duplicate eventIds
- Verify `findEventBySignature()` is working in database_helper
- Check that eventId is being generated as UUID (not hardcoded)

### GPS not working

**Symptom**: Location always null

**Solution**:
- Grant location permissions at runtime
- Enable GPS on device/emulator
- Check geolocator configuration in gps_service.dart
- Test with manual location fallback

### Database migration issues

**Symptom**: "Column not found" errors after update

**Solution**:
- Ensure `_onUpgrade()` in database_helper.dart is called
- Check migration version numbers
- If needed, use `_rebuildEventsTable()` to repair schema

## Summary

This codebase is a **production-ready local-first disaster response app** with:

- ✅ SQLite as the on-device source of truth
- ✅ Event sourcing with UUID idempotency
- ✅ Comprehensive event metadata (version, device context)
- ✅ Local registration and login
- ✅ Offline queueing with versioning and status tracking
- ✅ GPS-aware submissions with manual fallback
- ✅ Help request claiming with local state reflection
- ✅ Multiple layers of duplicate prevention
- ✅ Exponential backoff retry logic
- ✅ Backend sync readiness with proper error handling

For SRS work, the most important fact is this:

> The mobile app is not a Prisma client. It is a **local event sourcing application** that syncs immutable events into a backend system. All user intent is captured as events with UUIDs and version numbers, ensuring idempotency and traceability.

