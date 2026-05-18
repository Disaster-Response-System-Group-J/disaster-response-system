"""
IoT Event Handler — polls iot_flood and iot_landslide for unprocessed rows
and writes 4 ML predictions per row to iot_predictions:

  horizon=0  current status  (sensor values as-is)
  horizon=1  Day+1 forecast  (features extrapolated forward)
  horizon=2  Day+2 forecast
  horizon=3  Day+3 forecast

Extrapolation design (natural forecasting)
──────────────────────────────────────────
  • Trend source  : only the last TREND_HOURS hours of readings for the same
                    sensor type.  Older data is irrelevant and pollutes the slope.
  • Dampened rate : each successive day applies a smaller increment — the trend
                    contribution follows a geometric series with ratio DAMPING.
                    This means the forecast converges rather than diverging.
  • Rate caps     : physical maximums prevent impossible daily changes.
  • Vibration     : ax/ay/az/gx/gy/gz are instantaneous ground-motion snapshots
                    and are held constant across all horizons.
  • depth_prev    : chained — depth_prev at horizon H is the projected depth at H-1.

Clamping
────────
  hum   → [0, 100]
  moist → [0, 4095]
  depth → [0, ∞)
  temp  → unclamped
"""

import uuid
import logging
from datetime import datetime, timezone

import numpy as np
import sqlalchemy as sa

from app.db.database import SessionLocal
from app.services.iot_predictor import predict_flood, predict_landslide
from app.services.moratuwa_resource_planner import trigger_moratuwa_resource_plan

logger = logging.getLogger(__name__)

HORIZONS     = [0, 1, 2, 3]
TREND_WINDOW = 20      # max readings to use for slope estimation
TREND_HOURS  = 6       # only use readings within the last 6 hours

# Damping ratio: each day's increment = previous day's increment × DAMPING
# 0.5 → series converges to 2× the single-day rate (sum of 1+0.5+0.25+…= 2)
DAMPING = 0.5

# Maximum physically plausible daily change for each variable
_MAX_RATE = {
    "depth": 5.0,    # cm/day  — heavy-rain flooding
    "hum":   10.0,   # %/day
    "temp":   3.0,   # °C/day
    "moist": 300.0,  # raw moisture units/day
}


# ── SQL ───────────────────────────────────────────────────────────────────────

_UNPROCESSED_FLOOD_SQL = sa.text("""
    SELECT f.id, f.temp, f.hum, f.depth, f.recorded_at AS created_at
    FROM iot_flood f
    WHERE f.temp IS NOT NULL
      AND f.hum IS NOT NULL
      AND f.depth IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM iot_predictions p
        WHERE p.source_id = f.id
          AND p.disaster_type = 'flood'
          AND p.horizon = 0
    )
    ORDER BY f.recorded_at ASC
    LIMIT 50
""")

_FLOOD_HISTORY_SQL = sa.text("""
    SELECT temp, hum, depth, recorded_at AS created_at
    FROM iot_flood
    WHERE recorded_at <= :ts
      AND recorded_at >= :ts - INTERVAL '6 hours'
      AND temp IS NOT NULL
      AND depth IS NOT NULL
    ORDER BY recorded_at DESC
    LIMIT :n
""")

_PREV_FLOOD_DEPTH_SQL = sa.text("""
    SELECT depth FROM iot_flood
    WHERE recorded_at < :ts AND depth IS NOT NULL
    ORDER BY recorded_at DESC
    LIMIT 1
""")

_UNPROCESSED_LANDSLIDE_SQL = sa.text("""
    SELECT l.id, l.temp, l.hum, l.moist,
           l.ax, l.ay, l.az, l.gx, l.gy, l.gz, l.recorded_at AS created_at
    FROM iot_landslide l
    WHERE l.temp IS NOT NULL
      AND l.hum IS NOT NULL
      AND l.moist IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM iot_predictions p
        WHERE p.source_id = l.id
          AND p.disaster_type = 'landslide'
          AND p.horizon = 0
    )
    ORDER BY l.recorded_at ASC
    LIMIT 50
""")

_LANDSLIDE_HISTORY_SQL = sa.text("""
    SELECT temp, hum, moist, recorded_at AS created_at
    FROM iot_landslide
    WHERE recorded_at <= :ts
      AND recorded_at >= :ts - INTERVAL '6 hours'
      AND temp IS NOT NULL
      AND moist IS NOT NULL
    ORDER BY recorded_at DESC
    LIMIT :n
""")

_INSERT_SQL = sa.text("""
    INSERT INTO iot_predictions (
        id, source_id, disaster_type, predicted_status,
        temp, hum, depth_prev, depth,
        moist, ax, ay, az, gx, gy, gz,
        predicted_at, horizon
    ) VALUES (
        :id, :source_id, :disaster_type, :predicted_status,
        :temp, :hum, :depth_prev, :depth,
        :moist, :ax, :ay, :az, :gx, :gy, :gz,
        :predicted_at, :horizon
    )
    ON CONFLICT (source_id, disaster_type, horizon) DO NOTHING
""")


# ── Trend & projection helpers ────────────────────────────────────────────────

def _daily_rate(values: list, timestamps: list, max_rate: float) -> float:
    """
    Estimate linear slope (units/day) via polyfit, then clamp to ±max_rate.
    Returns 0.0 if fewer than 2 data points or the time span is under 6 minutes.
    """
    if len(values) < 2:
        return 0.0
    t0    = timestamps[0].timestamp()
    hours = [(t.timestamp() - t0) / 3600.0 for t in timestamps]
    if max(hours) - min(hours) < 0.1:
        return 0.0
    raw = float(np.polyfit(hours, values, 1)[0]) * 24.0   # per-day rate
    return float(np.clip(raw, -max_rate, max_rate))


def _project_damped(base: float, rate: float, h: int,
                    lo: float = None, hi: float = None) -> float:
    """
    Dampened projection using a geometric series.

    Each successive day contributes rate × DAMPING^(day-1), so the total
    extrapolation converges instead of growing without bound:
      H=1: base + rate
      H=2: base + rate + rate×0.5     = base + 1.5×rate
      H=3: base + rate + rate×0.5 + rate×0.25 = base + 1.75×rate
      H=∞: base + rate/(1-DAMPING)    = base + 2×rate  (for DAMPING=0.5)
    """
    if h == 0:
        return base
    total = rate * (1.0 - DAMPING ** h) / (1.0 - DAMPING)
    v = base + total
    if lo is not None: v = max(lo, v)
    if hi is not None: v = min(hi, v)
    return v


# ── Flood ─────────────────────────────────────────────────────────────────────

def _process_flood_rows(db) -> None:
    rows = db.execute(_UNPROCESSED_FLOOD_SQL).fetchall()
    if not rows:
        return

    logger.info(f"[IoT-Flood] {len(rows)} new row(s), generating horizons {HORIZONS}")

    for row in rows:
        try:
            history = list(reversed(
                db.execute(_FLOOD_HISTORY_SQL,
                           {"ts": row.created_at, "n": TREND_WINDOW}).fetchall()
            ))

            if len(history) >= 2:
                hts        = [h.created_at for h in history]
                rate_temp  = _daily_rate([float(h.temp)  for h in history], hts, _MAX_RATE["temp"])
                rate_hum   = _daily_rate([float(h.hum)   for h in history], hts, _MAX_RATE["hum"])
                rate_depth = _daily_rate([float(h.depth) for h in history], hts, _MAX_RATE["depth"])
            else:
                rate_temp = rate_hum = rate_depth = 0.0

            base_temp  = float(row.temp  or 0.0)
            base_hum   = float(row.hum   or 0.0)
            base_depth = float(row.depth or 0.0)

            prev         = db.execute(_PREV_FLOOD_DEPTH_SQL, {"ts": row.created_at}).fetchone()
            depth_prev_0 = float(prev.depth) if (prev and prev.depth is not None) else 0.0

            now = datetime.now(timezone.utc)
            h0_status = "Normal"

            for h in HORIZONS:
                p_temp  = _project_damped(base_temp,  rate_temp,  h)
                p_hum   = _project_damped(base_hum,   rate_hum,   h, lo=0.0, hi=100.0)
                p_depth = _project_damped(base_depth, rate_depth, h, lo=0.0)
                p_dprev = depth_prev_0 if h == 0 else _project_damped(base_depth, rate_depth, h - 1, lo=0.0)

                status = predict_flood(p_temp, p_hum, p_dprev, p_depth)
                if h == 0:
                    h0_status = status

                db.execute(_INSERT_SQL, {
                    "id":               str(uuid.uuid4()),
                    "source_id":        row.id,
                    "disaster_type":    "flood",
                    "predicted_status": status,
                    "temp":             round(p_temp, 2),
                    "hum":              round(p_hum),
                    "depth_prev":       round(p_dprev, 2),
                    "depth":            round(p_depth, 2),
                    "moist":            None,
                    "ax": None, "ay": None, "az": None,
                    "gx": None, "gy": None, "gz": None,
                    "predicted_at":     now,
                    "horizon":          h,
                })

            db.commit()
            logger.info(f"[IoT-Flood] {row.id} capped rates: "
                        f"temp={rate_temp:+.2f} hum={rate_hum:+.2f} depth={rate_depth:+.2f} /day")

            trigger_moratuwa_resource_plan(db, "flood", h0_status)

        except Exception as exc:
            db.rollback()
            logger.error(f"[IoT-Flood] Failed for {row.id}: {exc}")


# ── Landslide ─────────────────────────────────────────────────────────────────

def _process_landslide_rows(db) -> None:
    rows = db.execute(_UNPROCESSED_LANDSLIDE_SQL).fetchall()
    if not rows:
        return

    logger.info(f"[IoT-Landslide] {len(rows)} new row(s), generating horizons {HORIZONS}")

    for row in rows:
        try:
            history = list(reversed(
                db.execute(_LANDSLIDE_HISTORY_SQL,
                           {"ts": row.created_at, "n": TREND_WINDOW}).fetchall()
            ))

            if len(history) >= 2:
                hts        = [h.created_at for h in history]
                rate_temp  = _daily_rate([float(h.temp)  for h in history], hts, _MAX_RATE["temp"])
                rate_hum   = _daily_rate([float(h.hum)   for h in history], hts, _MAX_RATE["hum"])
                rate_moist = _daily_rate([float(h.moist) for h in history], hts, _MAX_RATE["moist"])
            else:
                rate_temp = rate_hum = rate_moist = 0.0

            base_temp  = float(row.temp  or 0.0)
            base_hum   = float(row.hum   or 0.0)
            base_moist = float(row.moist or 0.0)

            ax = float(row.ax or 0.0); ay = float(row.ay or 0.0); az = float(row.az or 0.0)
            gx = float(row.gx or 0.0); gy = float(row.gy or 0.0); gz = float(row.gz or 0.0)

            now = datetime.now(timezone.utc)
            h0_status = "Normal"

            for h in HORIZONS:
                p_temp  = _project_damped(base_temp,  rate_temp,  h)
                p_hum   = _project_damped(base_hum,   rate_hum,   h, lo=0.0,   hi=100.0)
                p_moist = _project_damped(base_moist, rate_moist, h, lo=0.0, hi=4095.0)

                status = predict_landslide(p_temp, p_hum, p_moist, ax, ay, az, gx, gy, gz)
                if h == 0:
                    h0_status = status

                db.execute(_INSERT_SQL, {
                    "id":               str(uuid.uuid4()),
                    "source_id":        row.id,
                    "disaster_type":    "landslide",
                    "predicted_status": status,
                    "temp":             round(p_temp, 2),
                    "hum":              round(p_hum),
                    "depth_prev":       None,
                    "depth":            None,
                    "moist":            round(p_moist),
                    "ax": row.ax, "ay": row.ay, "az": row.az,
                    "gx": row.gx, "gy": row.gy, "gz": row.gz,
                    "predicted_at":     now,
                    "horizon":          h,
                })

            db.commit()
            logger.info(f"[IoT-Landslide] {row.id} capped rates: "
                        f"temp={rate_temp:+.2f} hum={rate_hum:+.2f} moist={rate_moist:+.2f} /day")

            trigger_moratuwa_resource_plan(db, "landslide", h0_status)

        except Exception as exc:
            db.rollback()
            logger.error(f"[IoT-Landslide] Failed for {row.id}: {exc}")


# ── Entry point ───────────────────────────────────────────────────────────────

def run_iot_prediction_cycle() -> None:
    """Called by APScheduler every 30 seconds."""
    db = SessionLocal()
    try:
        _process_flood_rows(db)
        _process_landslide_rows(db)
    except Exception as exc:
        logger.error(f"[IoT] Prediction cycle error: {exc}")
    finally:
        db.close()
