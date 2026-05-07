"""
Disaster Prediction Runner
==========================
Reads forecast_features + forecast_weather_data from the database,
runs the Flood / Landslide / Drought ensemble models, and writes
probabilistic predictions (Day+1, Day+2, Day+3) to disaster_predictions.

Usage:
    python scripts/run-predictions.py

Requires DATABASE_URL in .env (or the environment).
"""

import os, sys, pathlib
import numpy as np
import pandas as pd
import joblib
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from datetime import timedelta

# ── load .env (same directory convention as the TS scripts) ─────────────────
load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL not set in environment / .env")

# SQLAlchemy wants postgresql:// not postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

MODELS_DIR = pathlib.Path(__file__).parent.parent.parent.parent / \
    "j2-data-intelligence" / "Model Training and Validation" / "Models"

SEVERITY_MAP = {0: "Normal", 1: "Moderate", 2: "Severe", 3: "Extreme"}
N_CLASSES = 4

# Features in the exact order the models were trained on
FEATURES = [
    "rain_sum",
    "temperature_2m_mean",
    "soil_moisture_7_to_28cm",
    "soil_moisture_28_to_100cm",
    "soil_moisture_100_to_255cm",
    "rain_lag_1",
    "rain_rolling_3d",
    "rain_rolling_7d",
    "month_sin",
    "month_cos",
    "spi",
    "division_encoded",
]

HAZARDS = ["Flood", "Landslide", "Drought"]


# ── SoftVotingEnsemble must be defined here so pickle can deserialise it ──────
class SoftVotingEnsemble:
    """Mirrors the class used during training — required for joblib.load()."""

    def __init__(self, xgb_model, lgbm_model, n_classes=4):
        self.xgb_model = xgb_model
        self.lgbm_model = lgbm_model
        self.n_classes = n_classes

    def predict_proba(self, X):
        xgb_proba = self.xgb_model.predict_proba(X)
        lgbm_proba = self.lgbm_model.predict_proba(X)
        avg = []
        for xp, lp in zip(xgb_proba, lgbm_proba):
            n = max(xp.shape[1], lp.shape[1], self.n_classes)
            if xp.shape[1] < n:
                xp = np.hstack([xp, np.zeros((xp.shape[0], n - xp.shape[1]))])
            if lp.shape[1] < n:
                lp = np.hstack([lp, np.zeros((lp.shape[0], n - lp.shape[1]))])
            avg.append((xp + lp) / 2.0)
        return avg

    def predict(self, X):
        return np.stack([np.argmax(a, axis=1) for a in self.predict_proba(X)], axis=1)


# ── Data loading ─────────────────────────────────────────────────────────────

def load_feature_data(engine) -> pd.DataFrame:
    """
    Join forecast_features (engineered features) with forecast_weather_data
    (raw forecast values) to assemble all 12 model inputs per division/date.
    """
    sql = text("""
        SELECT
            ff.division_id,
            ff.date                         AS feature_date,
            fwd.rain_sum                    AS rain_sum,
            fwd.temperature                 AS temperature_2m_mean,
            fwd.moisture_7_28cm             AS soil_moisture_7_to_28cm,
            fwd.moisture_28_100cm           AS soil_moisture_28_to_100cm,
            fwd.moisture_100_255cm          AS soil_moisture_100_to_255cm,
            ff.rain_lag_1,
            ff.rain_rolling_3d,
            ff.rain_rolling_7d,
            ff.month_sin,
            ff.month_cos,
            ff.spi,
            ff.division_encoded
        FROM forecast_features ff
        JOIN forecast_weather_data fwd
            ON fwd.division_id = ff.division_id
           AND fwd.date        = ff.date
        WHERE ff.division_encoded IS NOT NULL
        ORDER BY ff.division_id, ff.date
    """)
    with engine.connect() as conn:
        df = pd.read_sql(sql, conn)

    print(f"[predict] Loaded {len(df):,} rows from forecast_features × forecast_weather_data")
    return df


# ── Prediction ────────────────────────────────────────────────────────────────

def run_hazard(model, df: pd.DataFrame, hazard: str) -> list[dict]:
    """Run predict_proba for one hazard and return a list of row dicts."""
    X = df[FEATURES].copy()
    X = X.fillna(0.0)  # models trained with no NaNs — fill conservatively

    proba_list = model.predict_proba(X)  # list of 3 arrays, each (N, 4)

    rows = []
    for horizon_idx, proba in enumerate(proba_list):
        horizon = horizon_idx + 1  # 1, 2, 3
        # Pad to N_CLASSES columns if a model only saw fewer classes in training
        if proba.shape[1] < N_CLASSES:
            pad = np.zeros((proba.shape[0], N_CLASSES - proba.shape[1]))
            proba = np.hstack([proba, pad])

        predicted = np.argmax(proba, axis=1)

        for i, (_, row) in enumerate(df.iterrows()):
            feature_date = pd.Timestamp(row["feature_date"]).date()
            predicted_for_date = feature_date + timedelta(days=horizon)
            rows.append({
                "division_id":             int(row["division_id"]),
                "feature_date":            feature_date,
                "predicted_for_date":      predicted_for_date,
                "horizon":                 horizon,
                "hazard_type":             hazard.upper(),
                "prob_normal":             float(proba[i, 0]),
                "prob_moderate":           float(proba[i, 1]),
                "prob_severe":             float(proba[i, 2]),
                "prob_extreme":            float(proba[i, 3]),
                "predicted_severity":      int(predicted[i]),
                "predicted_severity_label": SEVERITY_MAP[int(predicted[i])],
            })

    return rows


# ── Upsert ────────────────────────────────────────────────────────────────────

UPSERT_SQL = text("""
    INSERT INTO disaster_predictions (
        division_id, feature_date, predicted_for_date, horizon, hazard_type,
        prob_normal, prob_moderate, prob_severe, prob_extreme,
        predicted_severity, predicted_severity_label, run_at
    ) VALUES (
        :division_id, :feature_date, :predicted_for_date, :horizon, :hazard_type,
        :prob_normal, :prob_moderate, :prob_severe, :prob_extreme,
        :predicted_severity, :predicted_severity_label, NOW()
    )
    ON CONFLICT (division_id, feature_date, hazard_type, horizon)
    DO UPDATE SET
        predicted_for_date      = EXCLUDED.predicted_for_date,
        prob_normal             = EXCLUDED.prob_normal,
        prob_moderate           = EXCLUDED.prob_moderate,
        prob_severe             = EXCLUDED.prob_severe,
        prob_extreme            = EXCLUDED.prob_extreme,
        predicted_severity      = EXCLUDED.predicted_severity,
        predicted_severity_label = EXCLUDED.predicted_severity_label,
        run_at                  = NOW()
""")

BATCH_SIZE = 500


def upsert_rows(engine, rows: list[dict]) -> int:
    written = 0
    with engine.begin() as conn:
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i : i + BATCH_SIZE]
            conn.execute(UPSERT_SQL, batch)
            written += len(batch)
    return written


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    engine = create_engine(DATABASE_URL)

    df = load_feature_data(engine)
    if df.empty:
        print("[predict] No forecast features found — nothing to predict.")
        sys.exit(0)

    total_written = 0
    for hazard in HAZARDS:
        model_path = MODELS_DIR / f"{hazard}_ensemble.pkl"
        if not model_path.exists():
            print(f"[predict] WARNING: model not found at {model_path} — skipping {hazard}")
            continue

        print(f"[predict] Loading {hazard} ensemble model...")
        model = joblib.load(model_path)

        print(f"[predict] Running {hazard} predictions for {len(df):,} rows × 3 horizons...")
        rows = run_hazard(model, df, hazard)

        print(f"[predict] Writing {len(rows):,} {hazard} prediction rows to DB...")
        written = upsert_rows(engine, rows)
        total_written += written
        print(f"[predict] ✓ {hazard}: {written:,} rows upserted")

    print(f"\n[predict] Done — {total_written:,} total rows written to disaster_predictions")


if __name__ == "__main__":
    main()
