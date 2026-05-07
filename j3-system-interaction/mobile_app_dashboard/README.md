# J3 Field Officer Mobile App

This Flutter app is the mobile extension of the J3 command dashboard and
is intended for zonal officers and response teams. It is focused on field
operations: viewing and managing incidents assigned to a zone, verifying
reports, updating incident status, adding field observations, requesting
resources, and sending near real-time updates back to the J3 dashboard.

Key features implemented in this codebase:
- Role-based login (service ID) with zone assignment
- Zone-based incident list and map view
- Incident details and quick actions (verify, status updates, observations, resource requests)
- In-memory IncidentService with a broadcast stream to simulate real-time sync

Note: This repository snapshot uses in-memory services and placeholders.
Replace the services with secure API calls and websocket integration when
connecting to the actual backend (J3 dashboard).
