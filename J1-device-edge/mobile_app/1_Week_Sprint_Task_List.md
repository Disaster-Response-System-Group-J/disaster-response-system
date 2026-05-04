# J1 Mobile App - 1 Week Sprint (7 Days)
## Condensed Task List for 2 People

**Timeline:** Monday - Friday (5 working days, or 7 days if including weekend)
**Goal:** Ship a working offline-first disaster response app with forms, SQLite, and basic MQTT integration

---

## Daily Task Overview

### **Day 1 (Monday): Foundation**

#### Person 1 (UI Lead):
- [ ] Create Flutter project: `flutter create j1_disaster_response`
- [ ] Add dependencies: `flutter pub add sqflite uuid intl`
- [ ] Create folder structure: `lib/screens/`, `lib/widgets/`, `lib/models/`
- [ ] Build `main.dart` with bottom tab navigation (5 tabs)
- [ ] Test: `flutter run` - see 5 empty tabs

#### Person 2 (Backend/Sync Lead):
- [ ] Create `database_helper.dart` with SQLite schema
  - [ ] events table: event_id, type, data, status, timestamp_created, timestamp_submitted
  - [ ] metadata table: sync_stats, queue_count, last_sync
- [ ] Implement functions: saveEvent(), getQueuedEvents(), updateEventStatus(), getQueueCount()
- [ ] Create `event_model.dart` - define Event class
- [ ] Test: Can create and read events from SQLite

**EOD Standup (15 min):**
- Person 1 shows: Navigation structure working
- Person 2 shows: Database working with test data
- Share code: Person 1 gets database_helper.dart, Event model

**Deliverable:** App shell + working database ✓

---

### **Day 2 (Tuesday): Forms & Components**

#### Person 1 (UI Lead):
- [ ] Create `form_widgets.dart` with reusable components:
  - [ ] CustomTextInput (with validation)
  - [ ] CustomDropdown
  - [ ] CustomNumberInput
  - [ ] CustomToggle
- [ ] Create `status_bar.dart` showing Online/Offline + queue count
- [ ] Build `help_request_form.dart`:
  - [ ] Type, Description, People count, Mobility, Injuries toggles
  - [ ] Location field (placeholder for GPS)
  - [ ] Submit button → calls Person 2's function
- [ ] Integrate forms into Report screen (toggle between Help Request & Data Report)
- [ ] Test: Forms display and validate

#### Person 2 (Backend/Sync Lead):
- [ ] Create `mqtt_config.dart` - define MQTT broker details
- [ ] Add MQTT dependency: `flutter pub add mqtt5_client`
- [ ] Create `mqtt_client_service.dart`:
  - [ ] MQTT connection setup
  - [ ] Publisher function for events
  - [ ] Subscriber function for incoming updates
  - [ ] Connection state listener
- [ ] Create `event_schema.dart` - normalize events to JSON schema
- [ ] Test: MQTT client can connect (mock broker or Mosquitto)

**EOD Standup (15 min):**
- Person 1 shows: Help Request form working
- Person 2 shows: MQTT client connecting
- Share: MQTT topics and message format

**Deliverable:** All forms built + MQTT client ready ✓

---

### **Day 3 (Wednesday): Data Report Form & Status Bar**

#### Person 1 (UI Lead):
- [ ] Build `data_report_form.dart`:
  - [ ] Data Type dropdown, Description
  - [ ] Location field (will be mandatory GPS)
  - [ ] Timestamp auto-set (UTC when form opens)
  - [ ] Submit button
- [ ] Integrate Data Report into Report screen toggle
- [ ] Wire Status Bar to show queue count from Person 2's sync status
- [ ] Build `my_requests_screen.dart`:
  - [ ] List of all user events from SQLite
  - [ ] Status badges (Pending/Synced/Acknowledged)
  - [ ] Pull-to-refresh
- [ ] Test: Switch between forms, status bar updates

#### Person 2 (Backend/Sync Lead):
- [ ] Create `sync_service.dart` - background sync engine:
  - [ ] Poll SQLite queue every 10 seconds
  - [ ] Publish to MQTT with QoS 1
  - [ ] Update event status on ACK
  - [ ] Retry logic (max 5 retries)
- [ ] Create `network_service.dart` - network state listener:
  - [ ] Detect online/offline
  - [ ] Emit events when status changes
  - [ ] Trigger sync when network returns
- [ ] Create `sync_status_emitter.dart`:
  - [ ] Emit queue_count, sync_in_progress, last_sync_time
  - [ ] Person 1 listens to update status bar
- [ ] Test: Submit form → syncs to MQTT

**EOD Standup (15 min):**
- Person 1 shows: Data Report form + My Requests screen
- Person 2 shows: Forms syncing to MQTT, status bar live updates
- Verify: Queue count updates in real-time

**Deliverable:** All forms + syncing to MQTT ✓

---

### **Day 4 (Thursday): GPS**

#### Person 1 (UI Lead):
- [ ] Add GPS dependency: `flutter pub add geolocator`
- [ ] Create `gps_service.dart`:
  - [ ] Get current location (lat, lon)
  - [ ] Request permissions
  - [ ] Fallback to manual text input if GPS fails
- [ ] Update Help Request form:
  - [ ] Auto-capture GPS (with text fallback)
  - [ ] Show coordinates in location field
- [ ] Update Data Report form:
  - [ ] Make GPS mandatory (cannot submit without)
  - [ ] Show error if GPS unavailable
- [ ] Test: GPS capture works

#### Person 2 (Backend/Sync Lead):
- [ ] Create `offline_queue_manager.dart`:
  - [ ] Queue events in SQLite before network
  - [ ] Generate UUID v4 for each event
  - [ ] Set status to QUEUED
  - [ ] Only mark SUBMITTED after MQTT ACK
- [ ] Create `error_handler.dart`:
  - [ ] Handle MQTT connection failures
  - [ ] Exponential backoff on retries
  - [ ] Log all failures
- [ ] Implement network detection:
  - [ ] When network returns → trigger immediate sync
  - [ ] Queue doesn't get lost on app close
- [ ] Test: Submit form offline → kill app → relaunch → verify data still queued

**EOD Standup (15 min):**
- Person 1 shows: GPS working
- Person 2 shows: Offline queue survives app close
- Test: Submit form offline, close app, relaunch, see it sync

**Deliverable:** Full offline-first pipeline working ✓

---

### **Day 5 (Friday): Give Help Screen, Map & Testing**

#### Person 1 (UI Lead):
- [ ] Add map dependency: `flutter pub add google_maps_flutter`
- [ ] Build `give_help_screen.dart`:
  - [ ] List of open help requests (from MQTT subscription)
  - [ ] "I Can Help" button
  - [ ] Claim functionality
- [ ] Build `map_view.dart` (MVP):
  - [ ] User location (blue dot)
  - [ ] Help request pins (red/orange)
  - [ ] Tap pin → show details
- [ ] Polish all screens:
  - [ ] Add error messages (red text)
  - [ ] Loading spinners on submit
  - [ ] Offline indicator banner
  - [ ] Notification badges on tabs
- [ ] Full E2E testing:
  - [ ] Submit 10 forms offline
  - [ ] Kill app mid-sync
  - [ ] Relaunch → verify all sync
  - [ ] Test with network toggle

#### Person 2 (Backend/Sync Lead):
- [ ] Implement `claim_request.dart`:
  - [ ] Create claim event when volunteer taps "I Can Help"
  - [ ] Publish to MQTT
  - [ ] Update SQLite with claim status
- [ ] Subscribe to help requests from J2:
  - [ ] Listen to incoming requests
  - [ ] Store in SQLite cache
  - [ ] Emit to Person 1 for "Give Help" list
- [ ] Build sync analytics:
  - [ ] Track events submitted
  - [ ] Track failures
  - [ ] Log performance (sync time)
- [ ] Create developer documentation:
  - [ ] MQTT topics list
  - [ ] Message format examples
  - [ ] How to test locally
  - [ ] How to integrate with J2

**Full E2E Testing Both:**
- [ ] Offline scenario: 10 forms offline → close → relaunch → all sync ✓
- [ ] Network toggle: Submit offline, toggle network, verify auto-sync ✓
- [ ] GPS: Both mandatory and fallback modes work ✓
- [ ] Concurrency: Rapid submissions have unique IDs ✓
- [ ] Performance: 100 queued events sync in <5 sec ✓

**EOD Standup (15 min):**
- Full app review (all screens working)
- E2E testing results
- Document any known issues
- Prepare for handoff to J2

**Deliverable:** Production-ready app for demo ✓

---

## Task List by Feature (Parallel Work)

### **Forms & UI (Person 1's Tracks)**

**Track A: Basic Screens**
- [ ] Day 1: Navigation shell (5 tabs)
- [ ] Day 2: Help Request form + form components
- [ ] Day 3: Data Report form + My Requests screen
- [ ] Day 4: GPS integration on both forms
- [ ] Day 5: Give Help screen + Map + Polish

**Track B: Offline Indicators**
- [ ] Day 2: Status bar (Online/Offline + queue count)
- [ ] Day 5: Offline banner + badges

---

### **Backend & Sync (Person 2's Tracks)**

**Track C: Database**
- [ ] Day 1: SQLite schema + DAO functions
- [ ] Day 3: Sync status emitter

**Track D: MQTT & Sync Engine**
- [ ] Day 2: MQTT client + event schema
- [ ] Day 3: Sync service + network listener
- [ ] Day 4: Offline queue + error handling
- [ ] Day 5: Claim request + incoming subscriptions

---

## Daily Checklist Template

Use this each day:

```
## Day X Checklist

### Person 1:
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Testing: ___
- [ ] Code pushed to git

### Person 2:
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Testing: ___
- [ ] Code pushed to git

### EOD Standup (15 min):
- Person 1 demo: ___
- Person 2 demo: ___
- Blockers: ___
- Tomorrow: ___
```

---

## Must-Have by End of Day

### **Day 1 (EOD):**
- App shell with navigation ✓
- SQLite database working ✓

### **Day 2 (EOD):**
- Help Request form complete ✓
- MQTT client connecting ✓

### **Day 3 (EOD):**
- Data Report form complete ✓
- Forms syncing to MQTT ✓
- Status bar live updating ✓

### **Day 4 (EOD):**
- GPS working on both forms ✓
- Offline queue tested ✓

### **Day 5 (EOD):**
- Give Help screen working ✓
- Map working ✓
- All E2E tests passing ✓
- Ready for demo ✓

---

## Testing at End of Week

### **Critical Tests (Must Pass):**

1. **Offline Submission Test**
   - [ ] Turn off WiFi/Airplane mode
   - [ ] Submit Help Request form
   - [ ] See "Saved offline, syncing when possible"
   - [ ] Kill app
   - [ ] Relaunch app
   - [ ] Verify event still in SQLite queue
   - [ ] Turn WiFi back on
   - [ ] Verify event syncs to MQTT

2. **GPS Mandatory Test**
   - [ ] Open Data Report form
   - [ ] Deny GPS permission
   - [ ] Try to submit
   - [ ] See error: "GPS signal required"

3. **Queue Count Test**
   - [ ] Submit 5 forms offline
   - [ ] See status bar show "5 pending"
   - [ ] Each form syncs
   - [ ] See count decrease: 4, 3, 2, 1, 0

4. **Network Reconnect Test**
   - [ ] Submit form while offline
   - [ ] Toggle WiFi ON/OFF rapidly
   - [ ] Verify no data loss
   - [ ] Eventually all syncs

---

## Dependency List (Add on Day 1)

```bash
flutter pub add sqflite uuid intl mqtt5_client geolocator google_maps_flutter
```

---

## File Structure (End of Week)

```
j1_disaster_response/
├── lib/
│   ├── main.dart
│   ├── models/
│   │   ├── event_model.dart
│   ├── services/
│   │   ├── database_helper.dart
│   │   ├── mqtt_client_service.dart
│   │   ├── sync_service.dart
│   │   ├── network_service.dart
│   │   ├── gps_service.dart
│   │   ├── event_schema.dart
│   ├── screens/
│   │   ├── home_screen.dart
│   │   ├── report_screen.dart
│   │   ├── help_request_form.dart
│   │   ├── data_report_form.dart
│   │   ├── give_help_screen.dart
│   │   ├── my_requests_screen.dart
│   │   ├── map_view.dart
│   │   ├── settings_screen.dart
│   ├── widgets/
│   │   ├── form_widgets.dart
│   │   ├── status_bar.dart
│   ├── utils/
│   │   ├── constants.dart
│   │   ├── error_handler.dart
├── pubspec.yaml
├── README.md
```

---

## Collaboration Points (Must Sync Daily)

**Day 1 Sync:** Person 1 & 2 agree on Event data structure
**Day 2 Sync:** Person 1 shows forms, Person 2 shows MQTT integration
**Day 3 Sync:** Verify forms → SQLite → MQTT flow works
**Day 4 Sync:** Offline queue tested, Person 1 adds GPS
**Day 5 Sync:** E2E testing together, prepare demo

---

## Success = Demo Ready

By end of Friday:
- [ ] App runs offline without network
- [ ] Can submit forms and they save locally
- [ ] Status bar shows queue count in real-time
- [ ] Network returns → events auto-sync
- [ ] App survives force-close (data not lost)
- [ ] GPS works on both forms
- [ ] Give Help screen shows requests
- [ ] Map displays incidents
- [ ] Zero data loss in any scenario

**Ready to hand off to J2 for MQTT integration** ✓

---

## If You Run Out of Time

**Must-Have (Days 1-3):**
- All forms working ✓
- SQLite persisting data ✓
- Status bar updating ✓

**Nice-to-Have (Days 4-5):**
- GPS integration
- Give Help screen
- Map view

**Can Do Post-Week:**
- Final polish
- Performance optimization
- Advanced error handling

Focus on **forms + offline persistence first**. Everything else builds on that.

---

**Start Monday morning. EOD standup every day. You've got this! 🚀**
