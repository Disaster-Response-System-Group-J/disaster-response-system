# J1 Disaster Response Mobile App

Offline-first Flutter application for disaster reporting, help requests, and local case management.

The mobile app is designed to work even when the network is unavailable. It stores user actions in SQLite first, uses the local database to power the UI, and syncs queued events when connectivity returns.

## Overview

- Platform: Flutter
- Local storage: SQLite
- Authentication: Local SQLite-backed register/login/session
- Offline queue: Event-based local persistence with UUIDs and idempotency
- Location: GPS capture via `geolocator`
- Sync: Network-aware background flush to backend API
- Optional transport layer: MQTT client service exists in the codebase, but the current main sync path is HTTP-based

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

The user interface is SQLite-first.

- The UI reads from local SQLite tables and local event objects
- The app does not read directly from Prisma at runtime on the device
- Prisma is the reference backend schema that the server must map to during sync

### Data flow

1. User signs in or registers locally
2. User submits a help request or data report
3. The form builds a JSON payload
4. `OfflineQueueManager` generates a UUID event and saves it to SQLite
5. The UI immediately reflects the local state
6. `SyncService` checks connectivity and posts queued events to the backend
7. Backend deduplicates using `eventId` / `Idempotency-Key`
8. On success, local status changes from `QUEUED` to `SUBMITTED`

### Claim flow

The Give Help tab shows help requests from other users only.

- The volunteer taps `I Can Help`
- The app asks for confirmation
- If confirmed, the local SQLite row is updated to `CLAIMED`
- The card updates to show claimed state and claimant details

## Key Features

- Local register/login
- Mock user for testing
- SQLite-backed session persistence
- SQLite-first UI
- Help request form
- Data report form
- GPS capture with manual fallback where allowed
- My Requests view from local SQLite
- Give Help view for other users' requests
- Claim request workflow
- Offline queue with UUIDs
- Duplicate prevention using payload signature
- Idempotent sync key support
- Network status awareness
- Demo data seeding for testing
- Local schema migration and rebuild for older SQLite layouts

## Screens

### Startup

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
- Give Help
- My Requests
- Settings

### Reporting

`report_screen.dart` switches between:

- Help Request form
- Data Report form

### Give Help

`give_help_screen.dart` lists open help requests from other users and allows claiming them locally.

### My Requests

`my_requests_screen.dart` shows the current user's locally stored requests and their queue/sync status.

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
- claim help requests locally
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

### Give Help behavior

- Shows help requests from other users only
- Hides the current user’s own requests
- Asks for confirmation before claiming
- Marks the request as `CLAIMED`
- Shows claimant details in the card

### My Requests behavior

- Shows the current user’s local events
- Displays status badges for queue/sync state

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

Important diagnosis:

- The current mobile app does not persist Prisma entities directly on the device
- It persists generic local events
- The backend must map those events into Prisma models during sync

This means the mobile event payloads and Prisma schema are related, but not identical.

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

Seeded demo help request users:

- `demo-user-1`
- `demo-user-2`

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
9. The system shall show the current user’s submitted requests in `My Requests`.
10. The system shall show help requests from other users in `Give Help`.
11. The system shall allow a volunteer to claim a help request after confirmation.
12. The system shall mark a claimed request as `CLAIMED` in SQLite.
13. The system shall prevent duplicate inserts for the same event signature.
14. The system shall sync queued events to the backend when network is available.
15. The system shall support GPS capture for location-aware submissions.

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
- `lib/screens/give_help_screen.dart`
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

- Backend sync target is still a placeholder
- Data report image picker is not implemented yet
- MQTT support exists but is not the primary production path in the current app
- Some legacy sync code paths are still present in the repository

## Summary

This codebase is a local-first disaster response app with:

- SQLite as the on-device source of truth
- local registration and login
- offline queueing
- GPS-aware submissions
- help request claiming
- duplicate prevention
- backend sync readiness

For SRS work, the most important fact is this:

> The mobile app is not a Prisma client. It is a local event app that syncs into a Prisma-backed backend model.

