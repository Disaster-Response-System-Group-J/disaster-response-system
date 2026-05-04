# J1 Mobile App Offline + Prisma Sync Plan

This app is the public-facing mobile client for disaster reporting and help requests.
It must stay lightweight, work offline first, and sync with the main backend when internet is available.

## Goal

- Save user submissions locally when offline.
- Fetch live incident and help status data when online.
- Sync queued submissions back to the main Prisma-backed backend.
- Keep the mobile app focused on public user actions only.
- Avoid heavy features that do not help the core offline flow.

## Current Direction

- Local SQLite remains the offline queue and cache.
- The main Prisma database is the source of truth when online.
- The mobile app should use structured payloads that align with the backend contract.
- The app should not carry image handling or map UI to keep it lightweight.

## What Needs To Change

### 1. Keep the app focused on public user flows

- Submit help requests.
- Submit disaster reports.
- View cached public status data.
- Sync local submissions when internet returns.

### 2. Read from the main backend when online

- Fetch current incidents.
- Fetch public alerts.
- Fetch any public help or resource status that should be visible to users.
- Refresh cached data at startup and when the network returns.

### 3. Sync local data back to the backend

- Queue submissions locally first.
- Upload queued items when online.
- Mark items as submitted only after backend confirmation.
- Keep retry handling for unstable connectivity.

### 4. Keep the UI lightweight

- No image upload or compression flow.
- No map view or GIS screen.
- Keep forms simple and fast.
- Show clear online/offline state and sync status.

## Prisma-Aligned Data Areas

These are the backend areas the mobile app should align with:

- `IncomingReport`
- `ConfirmedIncident`
- `Resource`
- `Alert`

`User` and `Role` should only matter if the mobile app later adds identity or permissions.

## Suggested Mobile Responsibilities

### Public user app

- Submit a disaster report.
- Submit a help request.
- See current incidents and alerts while online.
- See cached status data while offline.
- Work offline and sync later.

### Not in scope for this app

- Officer review workflows.
- Admin-only incident conversion flows.
- Resource management operations.
- Map screens.
- Image capture or upload flows.

## Task List

### Backend contract

- [ ] Confirm which Prisma models the mobile app can read publicly.
- [ ] Confirm which Prisma models the mobile app can create or update.
- [ ] Define the API or sync protocol for online fetch and submit.
- [ ] Define how local queue items map to Prisma records.
- [ ] Define conflict handling for duplicate or stale submissions.

### Local storage

- [ ] Keep SQLite as the offline queue store.
- [ ] Store drafts and unsynced submissions locally.
- [ ] Store a cached copy of online incidents and alerts if needed.
- [ ] Track sync status per item.
- [ ] Track last successful sync time.

### Data mapping

- [ ] Map help request fields to the correct backend model.
- [ ] Map report fields to `IncomingReport` or the agreed backend entity.
- [ ] Normalize location, type, description, contact, and media-related placeholders.
- [ ] Ensure enums and status values match backend naming exactly.
- [ ] Keep local event names aligned with backend payload names.

### Online fetch

- [ ] Fetch active incidents when the app opens and when the network returns.
- [ ] Fetch public alerts when the app opens and when the network returns.
- [ ] Fetch any public help/status data that should be visible to users.
- [ ] Cache the latest response locally for offline viewing.
- [ ] Show cached data when offline and refresh when back online.

### Sync upload

- [ ] Send queued submissions to the backend when online.
- [ ] Retry failed uploads with backoff.
- [ ] Prevent duplicate submission of the same local item.
- [ ] Save backend IDs returned after a successful upload.
- [ ] Update local sync state after acknowledgment.

### UI changes

- [ ] Show online and offline status clearly.
- [ ] Show queued item count in the UI.
- [ ] Show sync success, retry, and failure states.
- [ ] Make it clear which data is local draft data and which is live backend data.

### Testing

- [ ] Test offline submit with no internet.
- [ ] Test reconnect and auto-sync.
- [ ] Test fetch from the main database while online.
- [ ] Test app restart with queued items still pending.
- [ ] Test duplicate suppression if the same item is retried.
- [ ] Test stale cache behavior when backend data changes.

## Recommended Sync Flow

1. User submits a report or help request.
2. App saves it locally first.
3. If online, app sends it to the main backend immediately.
4. If offline, app keeps it queued.
5. App fetches live incidents and alerts when online.
6. App refreshes cached public data when sync succeeds.
7. App marks the local item as submitted only after backend confirmation.

## Important Notes

- The current app code is still closer to a local event queue than a Prisma client.
- The Prisma schema in the main project should be treated as the backend contract.
- The mobile app should not duplicate officer/admin workflows unless that becomes a separate app.
- Lightweight public user flows should stay the priority.

## Questions To Confirm

- [ ] Which Prisma models should the mobile app read publicly?
- [ ] Which Prisma models should the mobile app create or update?
- [ ] Should help requests and reports become separate backend objects or one unified submission type?
- [ ] Should the mobile app send data directly to the database layer or through an API service?

