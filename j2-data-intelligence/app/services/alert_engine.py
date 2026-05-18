"""
Alert Engine — Threshold-based Alert Generation and Duplicate Suppression

Manages configurable per-zone, per-hazard-type alert thresholds via the AlertThreshold table.
After each prediction or score calculation, checks if the current score exceeds the threshold.
Suppresses duplicate alerts using a 15-minute cooldown based on last_alert_at timestamp.
Populates PublicAlert with all required fields when alert criteria are met.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models.public_alert import PublicAlert
from app.models.division import Division
from app.models.disaster_risk import DisasterRisk
from app.models.consideration_score import ConsiderationScore

logger = logging.getLogger(__name__)

# Alert cooldown period (seconds)
ALERT_COOLDOWN_SECONDS = 15 * 60  # 15 minutes

# Default thresholds if none configured (0.0-1.0 scale)
DEFAULT_THRESHOLDS = {
    "FLOOD": 0.6,
    "LANDSLIDE": 0.6,
    "DROUGHT": 0.5,
}

# Severity level mappings based on score ranges
SEVERITY_LEVELS = {
    "CRITICAL": (0.85, 1.0),      # score >= 0.85
    "HIGH": (0.70, 0.85),          # 0.70 <= score < 0.85
    "MODERATE": (0.50, 0.70),      # 0.50 <= score < 0.70
    "LOW": (0.0, 0.50),            # score < 0.50
}


class AlertThresholdManager:
    """Manages configurable alert thresholds per zone and hazard type."""

    @staticmethod
    def get_threshold(db: Session, division_id: int, hazard_type: str) -> float:
        """
        Retrieve the configured alert threshold for a specific division and hazard type.
        Falls back to DEFAULT_THRESHOLDS if no custom configuration exists.

        Args:
            db: SQLAlchemy session
            division_id: ID of the division/zone
            hazard_type: Type of hazard (FLOOD, LANDSLIDE, DROUGHT, etc.)

        Returns:
            Threshold score (0.0-1.0) for triggering an alert
        """
        try:
            # Query the AlertThreshold table for custom configuration
            threshold_row = db.execute(
                sa.text("""
                    SELECT threshold_value
                    FROM AlertThreshold
                    WHERE division_id = :div_id
                      AND hazard_type = :hazard_type
                    LIMIT 1
                """),
                {"div_id": division_id, "hazard_type": hazard_type}
            ).fetchone()

            if threshold_row:
                return float(threshold_row.threshold_value)

        except Exception as e:
            logger.warning(f"Error fetching threshold for division {division_id}, hazard {hazard_type}: {e}")

        # Return default threshold
        return DEFAULT_THRESHOLDS.get(hazard_type, 0.6)

    @staticmethod
    def set_threshold(db: Session, division_id: int, hazard_type: str, threshold_value: float) -> bool:
        """
        Set or update a custom alert threshold for a division and hazard type.

        Args:
            db: SQLAlchemy session
            division_id: ID of the division/zone
            hazard_type: Type of hazard
            threshold_value: New threshold (0.0-1.0)

        Returns:
            True if successful, False otherwise
        """
        if not (0.0 <= threshold_value <= 1.0):
            logger.error(f"Invalid threshold value {threshold_value}. Must be between 0.0 and 1.0")
            return False

        try:
            db.execute(
                sa.text("""
                    INSERT INTO AlertThreshold (division_id, hazard_type, threshold_value, updated_at)
                    VALUES (:div_id, :hazard_type, :threshold, NOW())
                    ON CONFLICT (division_id, hazard_type)
                    DO UPDATE SET threshold_value = :threshold, updated_at = NOW()
                """),
                {"div_id": division_id, "hazard_type": hazard_type, "threshold": threshold_value}
            )
            db.commit()
            logger.info(f"Set threshold {threshold_value} for division {division_id}, hazard {hazard_type}")
            return True

        except Exception as e:
            logger.error(f"Failed to set threshold: {e}")
            db.rollback()
            return False


class DuplicateAlertSuppressor:
    """Manages duplicate alert suppression using 15-minute cooldown."""

    @staticmethod
    def can_alert(db: Session, division_id: int, hazard_type: str) -> bool:
        """
        Check if enough time has passed since the last alert for this division/hazard.

        Args:
            db: SQLAlchemy session
            division_id: ID of the division/zone
            hazard_type: Type of hazard

        Returns:
            True if alert is allowed (cooldown expired), False if still in cooldown
        """
        try:
            # Query the most recent alert for this division/hazard
            last_alert_row = db.execute(
                sa.text("""
                    SELECT issued_at
                    FROM PublicAlert
                    WHERE incident_id IS NULL
                      OR incident_id IN (
                          SELECT incident_id FROM ActiveIncident
                          WHERE division_id = :div_id
                      )
                    ORDER BY issued_at DESC
                    LIMIT 1
                """),
                {"div_id": division_id}
            ).fetchone()

            if not last_alert_row:
                # No previous alert found, allow alert
                return True

            last_alert_time = last_alert_row.issued_at
            if last_alert_time.tzinfo is None:
                # Assume UTC if naive
                last_alert_time = last_alert_time.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            time_since_last = (now - last_alert_time).total_seconds()

            if time_since_last >= ALERT_COOLDOWN_SECONDS:
                logger.info(f"Cooldown expired for division {division_id}, hazard {hazard_type}")
                return True
            else:
                remaining = ALERT_COOLDOWN_SECONDS - time_since_last
                logger.debug(f"Alert still in cooldown for division {division_id}: {remaining:.0f}s remaining")
                return False

        except Exception as e:
            logger.error(f"Error checking cooldown status: {e}")
            # On error, allow alert to be safe
            return True

    @staticmethod
    def record_alert_timestamp(db: Session, division_id: int, hazard_type: str) -> None:
        """
        Record the timestamp of the last alert for a division/hazard combination.
        (This is automatically handled by PublicAlert.issued_at, but can be used for custom tracking.)

        Args:
            db: SQLAlchemy session
            division_id: ID of the division/zone
            hazard_type: Type of hazard
        """
        try:
            # Update a tracking table if custom timestamp tracking is needed
            db.execute(
                sa.text("""
                    INSERT INTO AlertLastSent (division_id, hazard_type, last_alert_at)
                    VALUES (:div_id, :hazard_type, NOW())
                    ON CONFLICT (division_id, hazard_type)
                    DO UPDATE SET last_alert_at = NOW()
                """),
                {"div_id": division_id, "hazard_type": hazard_type}
            )
            db.commit()

        except Exception as e:
            logger.debug(f"Could not record alert timestamp (optional feature): {e}")
            db.rollback()


class SeverityClassifier:
    """Determines alert severity level based on score."""

    @staticmethod
    def get_severity_level(score: float) -> str:
        """
        Classify severity based on score.

        Args:
            score: Numeric score (0.0-1.0)

        Returns:
            Severity level: CRITICAL, HIGH, MODERATE, or LOW
        """
        for level, (min_score, max_score) in SEVERITY_LEVELS.items():
            if min_score <= score < max_score:
                return level

        # Default to CRITICAL if score >= 0.85
        if score >= 0.85:
            return "CRITICAL"
        return "LOW"

    @staticmethod
    def get_severity_message(hazard_type: str, severity: str, division_name: str) -> tuple[str, str]:
        """
        Generate alert title and message based on hazard type and severity.

        Args:
            hazard_type: Type of hazard (FLOOD, LANDSLIDE, DROUGHT, etc.)
            severity: Severity level (CRITICAL, HIGH, MODERATE, LOW)
            division_name: Name of the affected division/zone

        Returns:
            Tuple of (title, message)
        """
        severity_prefix = {
            "CRITICAL": "🚨 CRITICAL ALERT",
            "HIGH": "⚠️ HIGH RISK ALERT",
            "MODERATE": "⚠ MODERATE RISK ALERT",
            "LOW": "ℹ️ LOW RISK NOTICE",
        }

        hazard_descriptions = {
            "FLOOD": "Flooding risk detected",
            "LANDSLIDE": "Landslide risk detected",
            "DROUGHT": "Drought risk detected",
        }

        action_items = {
            "CRITICAL": "Immediate evacuation recommended. Contact authorities.",
            "HIGH": "Exercise caution. Prepare for possible evacuation.",
            "MODERATE": "Monitor conditions closely. Stay alert.",
            "LOW": "Continue normal operations. Monitor for updates.",
        }

        title = f"{severity_prefix.get(severity, 'ALERT')} - {hazard_descriptions.get(hazard_type, hazard_type)}"
        message = f"{division_name}: {hazard_descriptions.get(hazard_type, hazard_type)} — {action_items.get(severity, 'Please stay alert.')}"

        return title, message


class AlertEngine:
    """Main Alert Engine: orchestrates threshold checking, duplicate suppression, and alert creation."""

    def __init__(self):
        self.threshold_manager = AlertThresholdManager()
        self.suppressor = DuplicateAlertSuppressor()
        self.classifier = SeverityClassifier()

    def evaluate_and_alert(
        self,
        db: Session,
        division_id: int,
        hazard_type: str,
        score: float,
        incident_id: Optional[int] = None,
    ) -> Optional[PublicAlert]:
        """
        Main entry point: evaluate if an alert should be generated based on score.

        Args:
            db: SQLAlchemy session
            division_id: ID of the division/zone
            hazard_type: Type of hazard (FLOOD, LANDSLIDE, DROUGHT, etc.)
            score: Current risk score (0.0-1.0)
            incident_id: Optional ID of linked incident

        Returns:
            PublicAlert object if alert was created, None otherwise
        """
        try:
            # Fetch division info for context
            division = db.query(Division).filter_by(division_id=division_id).first()
            if not division:
                logger.error(f"Division {division_id} not found")
                return None

            division_name = division.name or f"Division {division_id}"

            # Step 1: Check threshold
            threshold = self.threshold_manager.get_threshold(db, division_id, hazard_type)
            if score < threshold:
                logger.debug(
                    f"Score {score:.2f} below threshold {threshold:.2f} for "
                    f"division {division_name}, hazard {hazard_type}"
                )
                return None

            logger.info(f"Score {score:.2f} exceeds threshold {threshold:.2f} for {division_name}/{hazard_type}")

            # Step 2: Check cooldown (duplicate suppression)
            if not self.suppressor.can_alert(db, division_id, hazard_type):
                logger.info(f"Alert suppressed due to cooldown for {division_name}/{hazard_type}")
                return None

            # Step 3: Determine severity and generate messages
            severity = self.classifier.get_severity_level(score)
            title, message = self.classifier.get_severity_message(hazard_type, severity, division_name)

            # Step 4: Create PublicAlert record
            alert = PublicAlert(
                incident_id=incident_id,
                title=title,
                message=message,
                severity_level=severity,
                status="ACTIVE",
                issued_at=datetime.now(timezone.utc),
            )

            db.add(alert)
            db.commit()
            db.refresh(alert)

            logger.info(
                f"Created alert #{alert.alert_id}: {title} "
                f"(severity={severity}, score={score:.2f}) for {division_name}"
            )

            # Step 5: Record timestamp for cooldown tracking
            self.suppressor.record_alert_timestamp(db, division_id, hazard_type)

            return alert

        except Exception as e:
            logger.error(f"Error in evaluate_and_alert: {e}", exc_info=True)
            db.rollback()
            return None

    def batch_evaluate_and_alert(
        self,
        db: Session,
        evaluations: list[dict],
    ) -> list[PublicAlert]:
        """
        Process multiple division/hazard/score evaluations in batch.

        Args:
            db: SQLAlchemy session
            evaluations: List of dicts with keys: division_id, hazard_type, score, [incident_id]

        Returns:
            List of PublicAlert objects created
        """
        alerts = []
        for eval_item in evaluations:
            alert = self.evaluate_and_alert(
                db=db,
                division_id=eval_item["division_id"],
                hazard_type=eval_item["hazard_type"],
                score=eval_item["score"],
                incident_id=eval_item.get("incident_id"),
            )
            if alert:
                alerts.append(alert)

        return alerts

    def get_active_alerts(
        self,
        db: Session,
        division_id: Optional[int] = None,
        hazard_type: Optional[str] = None,
        limit: int = 100,
    ) -> list[PublicAlert]:
        """
        Retrieve active alerts, optionally filtered by division and/or hazard type.

        Args:
            db: SQLAlchemy session
            division_id: Optional division ID filter
            hazard_type: Optional hazard type filter (not directly in PublicAlert, for context only)
            limit: Maximum number of results

        Returns:
            List of PublicAlert objects
        """
        try:
            query = db.query(PublicAlert).filter_by(status="ACTIVE")

            if division_id:
                # Filter by division via join to ActiveIncident
                query = query.outerjoin(
                    sa.orm.aliased(db.query(sa.text("*")).from_statement(
                        sa.text("SELECT * FROM ActiveIncident WHERE division_id = :div_id")
                    ))
                )

            return query.order_by(PublicAlert.issued_at.desc()).limit(limit).all()

        except Exception as e:
            logger.error(f"Error retrieving active alerts: {e}")
            return []

    def acknowledge_alert(db: Session, alert_id: int) -> bool:
        """
        Mark an alert as acknowledged/resolved.

        Args:
            db: SQLAlchemy session
            alert_id: ID of the alert to acknowledge

        Returns:
            True if successful, False otherwise
        """
        try:
            db.execute(
                sa.text("UPDATE PublicAlert SET status = :status WHERE alert_id = :alert_id"),
                {"status": "ACKNOWLEDGED", "alert_id": alert_id}
            )
            db.commit()
            logger.info(f"Alert {alert_id} acknowledged")
            return True

        except Exception as e:
            logger.error(f"Error acknowledging alert {alert_id}: {e}")
            db.rollback()
            return False


# Singleton instance for convenience
_alert_engine = None


def get_alert_engine() -> AlertEngine:
    """Get or create singleton AlertEngine instance."""
    global _alert_engine
    if _alert_engine is None:
        _alert_engine = AlertEngine()
    return _alert_engine
