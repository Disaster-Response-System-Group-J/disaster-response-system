from __future__ import annotations

import unittest

from app.validation import ReportIngestionValidator, SensorIngestionValidator, ValidationError


class TestValidation(unittest.TestCase):
    def test_report_validation_accepts_valid_payload(self):
        payload = {
            "eventId": "event-1",
            "timestamp": "2026-05-17T10:30:00Z",
            "deviceId": "mobile-001",
            "disasterType": "FLOOD",
            "district": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "description": "Water level rising in the area",
            "contact": "0771234567",
            "mediaUrls": ["https://example.com/photo1.jpg"],
        }

        result = ReportIngestionValidator.validate(payload)

        self.assertEqual(result["deviceId"], "mobile-001")
        self.assertEqual(result["disasterType"], "FLOOD")
        self.assertEqual(result["district"], "Colombo")
        self.assertEqual(result["mediaUrls"], ["https://example.com/photo1.jpg"])

    def test_report_validation_rejects_short_description(self):
        payload = {
            "eventId": "event-2",
            "timestamp": "2026-05-17T10:30:00Z",
            "deviceId": "mobile-001",
            "disasterType": "FLOOD",
            "district": "Colombo",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "description": "Too short",
        }

        with self.assertRaises(ValidationError) as ctx:
            ReportIngestionValidator.validate(payload)

        self.assertEqual(ctx.exception.field, "description")
        self.assertIn("Minimum 10 characters", ctx.exception.reason)

    def test_sensor_validation_accepts_valid_payload(self):
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

        result = SensorIngestionValidator.validate(payload)

        self.assertEqual(result["eventId"], "sensor-1")
        self.assertEqual(result["hazardType"], "LANDSLIDE")
        self.assertEqual(result["depth"], 1.2)
        self.assertEqual(result["latitude"], 7.2906)

    def test_sensor_validation_rejects_payload_without_readings(self):
        payload = {
            "eventId": "sensor-2",
            "timestamp": "2026-05-17T10:31:00Z",
            "deviceId": "iot-bridge-01",
            "hazardType": "LANDSLIDE",
        }

        with self.assertRaises(ValidationError) as ctx:
            SensorIngestionValidator.validate(payload)

        self.assertEqual(ctx.exception.field, "sensor_reading")
        self.assertIn("At least one of", ctx.exception.reason)
