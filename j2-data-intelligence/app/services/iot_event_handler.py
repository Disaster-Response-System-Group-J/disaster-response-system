"""
IoT Event Handler — polls iot_flood and iot_landslide for unprocessed rows
and writes ML predictions to the iot_predictions table every 30 seconds.

"Unprocessed" means there is no row in iot_predictions with the same
(source_id, disaster_type) pair, so each IoT reading is predicted exactly once.

Flood model features (in order): temp, hum, depth_prev, depth
  depth_prev is derived by looking up the immediately preceding iot_flood row.

Landslide model features (in order): temp, hum, moist, ax, ay, az, gx, gy, gz
"""

import uuid
import logging
from datetime import datetime, timezone

import sqlalchemy as sa

from app.db.database import SessionLocal
from app.services.iot_predictor import predict_flood, predict_landslide

logger = logging.getLogger(__name__)

# Raw SQL queries — avoids ORM overhead for the polling loop and lets us use
# a NOT EXISTS subquery cleanly without loading whole tables.

_UNPROCESSED_FLOOD_SQL = sa.text("""
    SELECT f.id, f.temp, f.hum, f.depth, f.created_at
    FROM iot_flood f
    WHERE NOT EXISTS (
        SELECT 1 FROM iot_predictions p
        WHERE p.source_id = f.id AND p.disaster_type = 'flood'
    )
    ORDER BY f.created_at ASC
""")

_PREV_FLOOD_DEPTH_SQL = sa.text("""
    SELECT depth FROM iot_flood
    WHERE created_at < :ts
    ORDER BY created_at DESC
    LIMIT 1
""")

_UNPROCESSED_LANDSLIDE_SQL = sa.text("""
    SELECT l.id, l.temp, l.hum, l.moist,
           l.ax, l.ay, l.az, l.gx, l.gy, l.gz
    FROM iot_landslide l
    WHERE NOT EXISTS (
        SELECT 1 FROM iot_predictions p
        WHERE p.source_id = l.id AND p.disaster_type = 'landslide'
    )
    ORDER BY l.created_at ASC
""")

_INSERT_PREDICTION_SQL = sa.text("""
    INSERT INTO iot_predictions (
        id, source_id, disaster_type, predicted_status,
        temp, hum, depth_prev, depth,
        moist, ax, ay, az, gx, gy, gz,
        predicted_at
    ) VALUES (
        :id, :source_id, :disaster_type, :predicted_status,
        :temp, :hum, :depth_prev, :depth,
        :moist, :ax, :ay, :az, :gx, :gy, :gz,
        :predicted_at
    )
    ON CONFLICT (source_id, disaster_type) DO NOTHING
""")


def _process_flood_rows(db):
    rows = db.execute(_UNPROCESSED_FLOOD_SQL).fetchall()
    if not rows:
        return

    logger.info(f"[IoT] Processing {len(rows)} unprocessed flood row(s)...")
    for row in rows:
        try:
            prev = db.execute(_PREV_FLOOD_DEPTH_SQL, {"ts": row.created_at}).fetchone()
            depth_prev = float(prev.depth) if (prev and prev.depth is not None) else 0.0

            temp  = float(row.temp  or 0.0)
            hum   = float(row.hum   or 0.0)
            depth = float(row.depth or 0.0)

            status = predict_flood(temp, hum, depth_prev, depth)

            db.execute(_INSERT_PREDICTION_SQL, {
                "id":               str(uuid.uuid4()),
                "source_id":        row.id,
                "disaster_type":    "flood",
                "predicted_status": status,
                "temp":             row.temp,
                "hum":              row.hum,
                "depth_prev":       depth_prev,
                "depth":            row.depth,
                "moist":            None,
                "ax": None, "ay": None, "az": None,
                "gx": None, "gy": None, "gz": None,
                "predicted_at":     datetime.now(timezone.utc),
            })
            db.commit()
            logger.info(f"[IoT] Flood {row.id} → {status}")

        except Exception as exc:
            db.rollback()
            logger.error(f"[IoT] Failed to predict flood row {row.id}: {exc}")


def _process_landslide_rows(db):
    rows = db.execute(_UNPROCESSED_LANDSLIDE_SQL).fetchall()
    if not rows:
        return

    logger.info(f"[IoT] Processing {len(rows)} unprocessed landslide row(s)...")
    for row in rows:
        try:
            temp  = float(row.temp  or 0.0)
            hum   = float(row.hum   or 0.0)
            moist = float(row.moist or 0.0)
            ax    = float(row.ax    or 0.0)
            ay    = float(row.ay    or 0.0)
            az    = float(row.az    or 0.0)
            gx    = float(row.gx    or 0.0)
            gy    = float(row.gy    or 0.0)
            gz    = float(row.gz    or 0.0)

            status = predict_landslide(temp, hum, moist, ax, ay, az, gx, gy, gz)

            db.execute(_INSERT_PREDICTION_SQL, {
                "id":               str(uuid.uuid4()),
                "source_id":        row.id,
                "disaster_type":    "landslide",
                "predicted_status": status,
                "temp":             row.temp,
                "hum":              row.hum,
                "depth_prev":       None,
                "depth":            None,
                "moist":            row.moist,
                "ax": row.ax, "ay": row.ay, "az": row.az,
                "gx": row.gx, "gy": row.gy, "gz": row.gz,
                "predicted_at":     datetime.now(timezone.utc),
            })
            db.commit()
            logger.info(f"[IoT] Landslide {row.id} → {status}")

        except Exception as exc:
            db.rollback()
            logger.error(f"[IoT] Failed to predict landslide row {row.id}: {exc}")


def run_iot_prediction_cycle():
    """
    Entry point called by APScheduler every 30 seconds.
    Opens its own session so it never blocks the request-handling sessions.
    """
    db = SessionLocal()
    try:
        _process_flood_rows(db)
        _process_landslide_rows(db)
    except Exception as exc:
        logger.error(f"[IoT] Prediction cycle error: {exc}")
    finally:
        db.close()
