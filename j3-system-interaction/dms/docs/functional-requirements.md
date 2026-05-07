# J3 DMS — Functional Requirements

---

## FR-01: Authentication

**FR-01-1** The system shall provide a login page where users enter their email address and password to authenticate.

**FR-01-2** The system shall validate credentials against stored user accounts and reject invalid combinations with an error message.

**FR-01-3** The system shall store the authenticated user session in localStorage and restore it on page reload.

**FR-01-4** The system shall provide a logout function that clears the session and redirects the user to the login page.

**FR-01-5** The system shall redirect unauthenticated users who attempt to access protected routes to the login page.

**FR-01-6** The system shall redirect authenticated users who navigate to the login page directly to the dashboard.

---

## FR-02: Role-Based Access Control

**FR-02-1** The system shall assign each user account exactly one role from the following: PUBLIC_USER, INCIDENT_COMMANDER_NATIONAL, INCIDENT_COMMANDER_ZONAL, OPERATIONS_OFFICER_NATIONAL, OPERATIONS_OFFICER_ZONAL, RESOURCE_MANAGER_NATIONAL, RESOURCE_MANAGER_ZONAL, SYSTEM_ADMIN.

**FR-02-2** The system shall enforce a permission map where each role grants a fixed set of named permissions.

**FR-02-3** The system shall hide sidebar navigation items for which the authenticated user lacks the required permission.

**FR-02-4** The system shall block access to protected pages via an AuthGuard component that checks permissions before rendering.

**FR-02-5** Incident Commander roles (National and Zonal) shall have permissions: view:dashboard, view:incident-map, view:alerts, view:analytics, view:predictions, view:sensors, approve:incidents, reject:incidents, issue:alerts, force-reallocate:resources.

**FR-02-6** Operations Officer roles (National and Zonal) shall have permissions: view:dashboard, view:incoming-reports, view:incident-map, view:sensors, verify:reports, reject:reports, update:incident-status, request:resources.

**FR-02-7** Resource Manager roles (National and Zonal) shall have permissions: view:dashboard, view:incident-map, view:resources, view:predictions, dispatch:resources, update:resource-status, manage:shelters. System Admin shall have permissions: view:dashboard, manage:users, manage:settings, view:audit-logs.

---

## FR-03: Command Dashboard

**FR-03-1** The system shall display a summary panel showing the count of currently active incidents and its change from the previous period.

**FR-03-2** The system shall display the count of critical alerts currently active.

**FR-03-3** The system shall display the count of incoming reports pending review.

**FR-03-4** The system shall display the total number of people affected across all active incidents and its change from the previous period.

**FR-03-5** The system shall display a breakdown of active incidents by disaster type including Floods, Landslides, Droughts, and Other.

**FR-03-6** The system shall display resource availability panels for Rescue Teams, Active Shelters, and Heavy Machinery showing current available count versus total.

**FR-03-7** The system shall display a list of the most recent alerts on the dashboard.

---

## FR-04: Incoming Reports

**FR-04-1** The system shall display a paginated list of all incoming disaster reports received from connected sources.

**FR-04-2** The system shall display each report's source system, disaster type, district, description, contact, and submission timestamp.

**FR-04-3** The system shall allow filtering of reports by verification status, disaster type, source system, and district.

**FR-04-4** The system shall allow authorised officers to mark a report as Verified, Rejected, or Duplicate.

**FR-04-5** The system shall allow authorised officers to add internal notes to a report during review.

**FR-04-6** The system shall allow authorised officers to convert a verified report into a confirmed incident.

**FR-04-7** The system shall display the current verification status of each report with a visual status indicator.

**FR-04-8** The system shall support reports originating from the J1 SOS mobile app, the J3 public portal, the J1 sensor system, the weather API, and officer-created entries.

**FR-04-9** The system shall display attached media URLs for reports that include them.

---

## FR-05: Incident Map

**FR-05-1** The system shall display an interactive map rendered with MapLibre GL showing all confirmed incidents as map markers.

**FR-05-2** The system shall colour-code incident markers by severity: Critical (red), High (orange), Medium (yellow), Low (green).

**FR-05-3** The system shall display a popup with incident details when the user clicks a marker.

**FR-05-4** The system shall allow filtering of map markers by disaster type, severity, and status via a control panel.

**FR-05-5** The system shall display resource location markers on the map alongside incident markers.

**FR-05-6** The system shall display shelter location markers on the map.

**FR-05-7** The system shall provide layer toggle controls allowing the user to show or hide incidents, resources, and shelters independently.

**FR-05-8** The system shall display a legend explaining the colour and icon coding used on the map.

**FR-05-9** The system shall allow the user to search for a location or district and pan the map to it.

**FR-05-10** The system shall support drawing a selection area on the map to filter visible incidents to a geographic region.

**FR-05-11** The system shall display a side panel listing incidents corresponding to the current map view or active filters.

**FR-05-12** The system shall update map markers in real time when new incidents are received via WebSocket.

---

## FR-06: Resource Tracking

**FR-06-1** The system shall display a list of all registered resources including their type, name, district, and current status.

**FR-06-2** The system shall display each resource's assignment status showing which incident it is currently assigned to, if any.

**FR-06-3** The system shall allow filtering of resources by type, status, and district.

**FR-06-4** The system shall allow searching resources by name or resource ID.

**FR-06-5** The system shall allow authorised Resource Managers to dispatch a resource to a selected incident.

**FR-06-6** The system shall allow authorised Resource Managers to update a resource's status (Available, Assigned, Busy, Out of Service).

**FR-06-7** The system shall display shelter capacity information including current occupancy versus maximum capacity.

**FR-06-8** The system shall allow Resource Managers to manage shelter records.

---

## FR-07: Alerts

**FR-07-1** The system shall display a list of all system alerts including their type, severity, district, title, description, and active status.

**FR-07-2** The system shall visually distinguish active alerts from expired or inactive alerts.

**FR-07-3** The system shall allow filtering of alerts by type, severity, district, and active status.

**FR-07-4** The system shall allow authorised Incident Commanders to create new alerts.

**FR-07-5** The system shall support alert types: Risk Alert, Public Alert, Shelter Capacity, Resource Shortage, Incident Status.

**FR-07-6** The system shall support alert severity levels: Critical, High, Medium, Low.

**FR-07-7** The system shall allow alerts to be marked as public, making them visible on the public-facing portal.

**FR-07-8** The system shall allow authorised users to deactivate an active alert.

**FR-07-9** The system shall display alert expiry timestamps where applicable.

**FR-07-10** The system shall broadcast newly issued alerts to all connected dashboard clients via WebSocket.

---

## FR-08: Analytics

**FR-08-1** The system shall display charts showing incident trends over time broken down by disaster type.

**FR-08-2** The system shall display charts showing resource utilisation over time.

**FR-08-3** The system shall display a breakdown of incidents by district for the selected time period.

**FR-08-4** The system shall display response time metrics showing average time from incident creation to first resource dispatch.

**FR-08-5** The system shall allow the user to select a date range for all analytics charts.

---

## FR-09: Sensor Network

**FR-09-1** The system shall display a list of all registered sensors showing sensor ID, type, location, district, and current status.

**FR-09-2** The system shall display the latest reading value and timestamp for each sensor.

**FR-09-3** The system shall visually indicate sensors whose latest reading exceeds the configured alert threshold.

**FR-09-4** The system shall allow filtering of sensors by type, status, and district.

**FR-09-5** The system shall display sensor locations as markers on an embedded map.

**FR-09-6** The system shall display a real-time feed of sensor readings received via WebSocket.

**FR-09-7** The system shall display a historical chart of readings for a selected sensor over a configurable time window.

**FR-09-8** The system shall indicate whether each sensor is Online, Offline, or in Warning state.

**FR-09-9** The system shall allow authorised users to view sensor configuration details.

---

## FR-10: Predictions

**FR-10-1** The system shall display AI-generated risk predictions for districts based on sensor data and historical incident patterns.

**FR-10-2** The system shall display each prediction's risk level, affected district, predicted disaster type, and confidence score.

**FR-10-3** The system shall display the data sources and reasoning used to generate each prediction.

**FR-10-4** The system shall allow filtering of predictions by district and risk level.

**FR-10-5** The system shall display predictions on an embedded map with risk-level colour coding.

**FR-10-6** The system shall show the timestamp of the last prediction model run and indicate when a refresh is in progress.

---

## FR-11: Admin Panel

### User Management

**FR-11-1** The system shall display a list of all registered user accounts showing name, email, role, and account status.

**FR-11-2** The system shall allow System Admins to create new user accounts with a specified role.

**FR-11-3** The system shall allow System Admins to edit an existing user's name, email, or role.

**FR-11-4** The system shall allow System Admins to deactivate or reactivate a user account.

**FR-11-5** The system shall allow System Admins to reset a user's password.

### Disaster Type Management

**FR-11-6** The system shall display the list of configured disaster types including the four core types (Flood, Landslide, Drought, Other) and any admin-defined custom types.

**FR-11-7** The system shall allow System Admins to add new custom disaster types.

**FR-11-8** The system shall allow System Admins to edit or remove custom disaster types.

**FR-11-9** The system shall make custom disaster types available for selection in all incident and report forms throughout the system.

### System Configuration

**FR-11-10** The system shall allow System Admins to configure sensor alert thresholds by sensor type.

**FR-11-11** The system shall allow System Admins to configure WebSocket connection settings.

**FR-11-12** The system shall allow System Admins to configure external API integration settings.

### Audit Logs

**FR-11-13** The system shall record an audit log entry for every create, update, delete, and status-change action performed by any user.

**FR-11-14** The system shall allow System Admins to view, filter, and export audit log entries.

---

## FR-12: Public Incident Reporting

**FR-12-1** The system shall provide a public-facing report submission form accessible without authentication.

**FR-12-2** The form shall require the reporter to select a disaster type, select a district, and provide a description.

**FR-12-3** The form shall optionally accept the reporter's contact information.

**FR-12-4** The form shall optionally accept media file uploads as supporting evidence.

**FR-12-5** The system shall validate that all required fields are completed before allowing form submission.

**FR-12-6** The system shall display field-level validation error messages for incomplete or invalid inputs.

**FR-12-7** The system shall disable the submit button while a submission is in progress to prevent duplicate submissions.

**FR-12-8** The system shall display a success confirmation message after a report is submitted successfully.

---

## FR-13: Public Pages

**FR-13-1** The system shall provide a public alerts page displaying all alerts marked as public, accessible without authentication.

**FR-13-2** The system shall provide a public shelters page displaying shelter locations, capacity, and contact information.

**FR-13-3** The system shall provide a public emergency contacts page listing emergency service numbers by category.

---

## FR-14: WebSocket Real-Time Updates

**FR-14-1** The system shall establish a WebSocket connection to the backend server on dashboard load using Socket.IO client.

**FR-14-2** The system shall display the current connection status (Connected / Disconnected) to the user.

**FR-14-3** The system shall automatically attempt to reconnect when the WebSocket connection is lost.

**FR-14-4** The system shall update the incoming reports list in real time when a new report event is received.

**FR-14-5** The system shall update the confirmed incidents list and map markers in real time when an incident event is received.

**FR-14-6** The system shall update the alerts list in real time when a new alert event is received.

**FR-14-7** The system shall update sensor readings in real time when a sensor data event is received.
