"""
IoT-aware Risk Prediction Engine

Uses the new ensemble models (flood_ensemble_model.pkl / landslide_ensemble_model.pkl)
trained on individual IoT sensor readings.  Extracts the most recent sensor row for
each hazard type rather than aggregating over a window.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import sqlalchemy as sa

from app.services.iot_predictor import (
    predict_flood,
    predict_landslide,
    label_to_probabilities,
    label_to_severity_index,
)

logger = logging.getLogger(__name__)


class RiskPredictionEngine:
    """Generates disaster risk predictions for divisions using IoT sensor data."""

    def predict_for_division_flood(self, db: Session, division_id: int) -> dict:
        """
        Fetch the two most-recent FLOOD telemetry rows for depth_prev / depth,
        then run the flood ensemble model.
        Returns a dict with predicted_status and probs.
        """
        rows = db.execute(sa.text("""
            SELECT temp, hum, depth
            FROM raw_telemetry
            WHERE hazard_type = 'FLOOD'
              AND division_id = :div_id
              AND depth IS NOT NULL
            ORDER BY recorded_at DESC
            LIMIT 2
        """), {"div_id": division_id}).fetchall()

        if not rows:
            logger.warning(f"No FLOOD telemetry for division {division_id}")
            return None

        current = rows[0]
        depth_prev = float(rows[1].depth) if len(rows) > 1 else 0.0

        label = predict_flood(
            temp=float(current.temp or 0.0),
            hum=float(current.hum or 0.0),
            depth_prev=depth_prev,
            depth=float(current.depth or 0.0),
        )
        return {
            "predicted_status": label,
            "severity_index": label_to_severity_index(label),
            "probabilities": label_to_probabilities(label),
        }

    def predict_for_division_landslide(self, db: Session, division_id: int) -> dict:
        """
        Fetch the most-recent LANDSLIDE telemetry row and run the landslide ensemble model.
        """
        row = db.execute(sa.text("""
            SELECT temp, hum, moist, ax, ay, az, gx, gy, gz
            FROM raw_telemetry
            WHERE hazard_type = 'LANDSLIDE'
              AND division_id = :div_id
            ORDER BY recorded_at DESC
            LIMIT 1
        """), {"div_id": division_id}).fetchone()

        if not row:
            logger.warning(f"No LANDSLIDE telemetry for division {division_id}")
            return None

        label = predict_landslide(
            temp=float(row.temp  or 0.0),
            hum=float(row.hum    or 0.0),
            moist=float(row.moist or 0.0),
            ax=float(row.ax or 0.0),
            ay=float(row.ay or 0.0),
            az=float(row.az or 0.0),
            gx=float(row.gx or 0.0),
            gy=float(row.gy or 0.0),
            gz=float(row.gz or 0.0),
        )
        return {
            "predicted_status": label,
            "severity_index": label_to_severity_index(label),
            "probabilities": label_to_probabilities(label),
        }
