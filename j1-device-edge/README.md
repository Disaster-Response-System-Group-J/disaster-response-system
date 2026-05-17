# J1 Device-Edge Report

This document describes the J1 part of the Disaster Response System project. J1 is the device-edge layer that connects the Flutter mobile app and edge devices to the backend service layer.

## 1. Project Scope

J1 is responsible for:

- receiving disaster reports from the mobile app
- receiving sensor data from edge devices
- validating incoming payloads
- preventing duplicate submissions using idempotency
- forwarding normalized data to the J2 service
- returning emergency resource data to the app
- exposing a health check endpoint for monitoring

This report focuses only on J1, not the full system.

## 2. What J1 Contains

| Component | Folder | Role |
|---|---|---|
| Flutter mobile app | `mobile_app/` | User interface for reporting and local sync |
| FastAPI bridge | `backend/` | Main API for ingestion, validation, and forwarding |
| Central node | `Central_Node/` | Edge node logic |
| Flood node | `Flood_Node/` | Flood monitoring logic |
| Landslide node | `Landside_Node/` | Landslide monitoring logic |

## 3. J1 Backend Overview

The backend is a FastAPI application. It provides these main endpoints:

- `GET /health` for health checking
- `POST /api/v1/ingest/report` for disaster reports
- `POST /api/v1/ingest/sensor` for sensor readings
- `GET /api/v1/resources` for emergency resource data
- `GET /docs` for Swagger UI testing

The backend also contains:

- payload validation rules
- an in-memory idempotency store
- an HTTP client for forwarding data to J2
- retry logic for temporary upstream failures

## 4. Verification and Validation

The lecture defined:

- verification as "Are we building the product right?"
- validation as "Are we building the right product?"

For J1:

- verification checks that the code follows the API specification and validation rules
- validation checks that the system behaves the way the disaster response app needs it to behave

Examples:

- verifying that `eventId` and `Idempotency-Key` match
- validating that the mobile app can send a report and get accepted
- verifying that invalid input returns the correct HTTP error
- validating that the app can read emergency resources through the API

## 5. Testing Strategy For J1

J1 should be tested using the lecture’s main testing stages:

- development testing
- release testing
- user testing

Because J1 is a software component with API interactions, the most relevant tests are:

- unit testing
- component testing
- system testing
- release-style validation testing
- user/acceptance testing

## 6. Development Testing

Development testing is done during development to find defects early.

### 6.1 Unit Testing

Unit testing checks small parts in isolation.

For J1, unit tests should cover:

- report validation
- sensor validation
- idempotency store behavior
- J2 HTTP client retry behavior

Important unit test cases:

- valid report payload passes validation
- missing `district` fails validation
- invalid `hazardType` fails validation
- a duplicate idempotency key is detected
- sensor payload without readings is rejected
- J2 timeout or connection failure is handled correctly

### 6.2 Component Testing

Component testing checks how several units work together.

For J1, this means testing:

- request validation plus forwarding to J2
- idempotency checking plus duplicate rejection
- resource filtering by query parameters
- response mapping from J2 back to the client

Component testing is important because J1 is built from multiple interacting modules, not one isolated function.

### 6.3 System Testing

System testing checks the integrated J1 backend as a whole.

For J1, the system should be tested by running the API and sending real requests through Swagger or HTTP tools.

System test examples:

- `GET /health` returns `200 OK`
- valid report request returns `201 Created`
- valid sensor request returns `201 Created`
- duplicate request returns `409 Conflict`
- invalid input returns `422 Unprocessable Entity`
- J2 failure returns `503 Service Unavailable`
- resources endpoint returns filtered results

## 7. Validation Testing

Validation testing proves that the system meets user requirements.

For J1, the expected user behavior is:

- the app sends a report successfully
- the app receives a clear response if the data is wrong
- the app avoids duplicate submissions
- the app can fetch emergency resources locally

Validation tests should use realistic data that reflects normal use.

Examples:

- a real-looking flood report from Colombo
- a sensor reading with depth and humidity values
- a valid list of media URLs
- a query for shelters in a specific district

## 8. Defect Testing

Defect testing is used to expose faults and incorrect behavior.

For J1, defect-oriented tests include:

- empty payloads
- wrong `Idempotency-Key`
- invalid latitude and longitude
- invalid ISO 8601 timestamp
- unsupported disaster type
- sensor payloads with no readings
- repeated submissions of the same event
- J2 being offline during forwarding

These tests are useful because, as the lecture says, testing can reveal the presence of errors but not prove their absence.

## 9. Release Testing

Release testing checks a complete version of the system before external use.

For J1, release testing means:

- testing the backend as a deployable service
- making sure the API works from the mobile app
- checking that the response codes are stable and meaningful
- confirming that the system is good enough for external use

Release-style checks for J1:

- the backend starts successfully in Docker
- the Swagger page opens correctly
- the main endpoints work without manual code changes
- the system behaves correctly under normal use

## 10. User Testing

User testing involves users or potential users checking the system in a realistic environment.

For J1, this can be explained as:

- the mobile app user submits a disaster report
- the user sees whether the report was accepted or rejected
- the user browses emergency resources
- the system behaves properly on the actual device or emulator

This is important because the lecture notes say user environment affects reliability, performance, usability, and robustness.

## 11. Why Testing Matters For J1

Testing J1 is important because it protects the rest of the system.

If J1 is not tested properly:

- bad data can reach J2
- duplicate records can be created
- the mobile app may show incorrect status
- sensor readings may be lost or misread
- system failures may not be handled safely

## 12. What Was Tested

The main J1 test areas are:

- health check
- report ingestion
- sensor ingestion
- resources endpoint
- duplicate detection
- validation failures
- upstream failure handling

## 13. Expected Results

The expected results for J1 are:

- valid requests are accepted
- invalid requests return clear errors
- duplicate requests are blocked
- J2 forwarding works correctly
- resources are returned in the correct filtered form
- the backend fails safely when J2 is unavailable

## 14. Viva Talking Points

If asked in viva, you can explain J1 like this:

- J1 is the edge layer of the disaster response system.
- It performs validation before forwarding data.
- It uses idempotency to prevent duplicate submissions.
- It supports both report data and sensor data.
- It provides emergency resource information for the mobile app.
- It is tested using unit, component, system, release, and user testing ideas.
- It follows the lecture concept that testing finds defects but cannot prove that defects do not exist.

## 15. Reference For Practical Testing

For the detailed manual test cases and sample JSON payloads, see [`TESTING.md`](./TESTING.md).
