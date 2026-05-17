from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.idempotency import idempotency_store
from app.j2_client import j2_client
from app.main import app


class TestRoutes(unittest.TestCase):
    def setUp(self):
        idempotency_store.clear()
        self.connect_patch = patch.object(j2_client, "connect", AsyncMock(return_value=None))
        self.disconnect_patch = patch.object(j2_client, "disconnect", AsyncMock(return_value=None))
        self.report_patch = patch.object(
            j2_client,
            "ingest_report",
            AsyncMock(return_value={"status_code": 201, "body": {"data": {"id": "j2-report-1"}}}),
        )
        self.sensor_patch = patch.object(
            j2_client,
            "ingest_sensor",
            AsyncMock(return_value={"status_code": 201, "body": {"data": {"alert_triggered": True}}}),
        )

        self.connect_patch.start()
        self.disconnect_patch.start()
        self.report_patch.start()
        self.sensor_patch.start()

        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.connect_patch.stop()
        self.disconnect_patch.stop()
        self.report_patch.stop()
        self.sensor_patch.stop()
        idempotency_store.clear()

    def test_health_endpoint_returns_ok(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["service"], "j1-bridge-api")

    def test_report_ingestion_accepts_valid_payload(self):
        payload = {
            "eventId": "report-1",
            "timestamp": "2026-05-17T10:30:00Z",
            "deviceId": "mobile-001",
            "disasterType": "FLOOD",
            "district": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "description": "Water level rising in the area",
            "contact": "0771234567",
        }

        response = self.client.post("/api/v1/ingest/report", json=payload, headers={"Idempotency-Key": "report-1"})

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["eventId"], "report-1")
        self.assertEqual(body["data"]["status"], "ACCEPTED")

    def test_report_ingestion_rejects_duplicate_event_id(self):
        payload = {
            "eventId": "report-dup",
            "timestamp": "2026-05-17T10:30:00Z",
            "deviceId": "mobile-001",
            "disasterType": "FLOOD",
            "district": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "description": "Water level rising in the area",
        }

        first_response = self.client.post("/api/v1/ingest/report", json=payload, headers={"Idempotency-Key": "report-dup"})
        second_response = self.client.post("/api/v1/ingest/report", json=payload, headers={"Idempotency-Key": "report-dup"})

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 409)

    def test_report_ingestion_rejects_invalid_payload(self):
        payload = {
            "eventId": "report-invalid",
            "timestamp": "2026-05-17T10:30:00Z",
            "deviceId": "mobile-001",
            "disasterType": "FLOOD",
            "district": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "description": "short",
        }

        response = self.client.post("/api/v1/ingest/report", json=payload, headers={"Idempotency-Key": "report-invalid"})

        self.assertEqual(response.status_code, 422)

    def test_sensor_ingestion_accepts_valid_payload(self):
        payload = {
            "eventId": "sensor-1",
            "timestamp": "2026-05-17T10:31:00Z",
            "deviceId": "iot-bridge-01",
            "hazardType": "LANDSLIDE",
            "depth": 1.2,
            "temperature": 28.4,
            "humidity": 86,
            "moisture": 74,
            "latitude": 7.2906,
            "longitude": 80.6337,
        }

        response = self.client.post("/api/v1/ingest/sensor", json=payload, headers={"Idempotency-Key": "sensor-1"})

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["eventId"], "sensor-1")
        self.assertTrue(body["data"]["alert_triggered"])

    def test_resources_endpoint_supports_filtering(self):
        response = self.client.get("/api/v1/resources?district=Colombo")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertTrue(body["data"])
        self.assertTrue(all(item["district"] == "Colombo" for item in body["data"]))
