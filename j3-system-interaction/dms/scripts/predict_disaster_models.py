#!/usr/bin/env python3

"""Load the J2 ensemble pickles and predict disaster probabilities.

The script reads a JSON array from stdin. Each item must include the 12 model
features plus metadata fields used for writing the rows back to PostgreSQL.

Output: JSON array with one record per hazard × horizon × input row.
"""

from __future__ import annotations

import __main__
import json
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


FEATURES = [
    'rain_sum',
    'temperature_2m_mean',
    'soil_moisture_7_to_28cm',
    'soil_moisture_28_to_100cm',
    'soil_moisture_100_to_255cm',
    'rain_lag_1',
    'rain_rolling_3d',
    'rain_rolling_7d',
    'month_sin',
    'month_cos',
    'spi',
    'division_encoded',
]

SEVERITY_MAP = {0: 'Normal', 1: 'Moderate', 2: 'Severe', 3: 'Extreme'}
HAZARDS = ['Flood', 'Landslide', 'Drought']


class SoftVotingEnsemble:
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


setattr(__main__, 'SoftVotingEnsemble', SoftVotingEnsemble)


def resolve_models_dir() -> Path:
    env_dir = os.getenv('MODELS_DIR')
    if env_dir:
        return Path(env_dir)

    return Path(__file__).resolve().parents[3] / 'j2-data-intelligence' / 'app' / 'models'


def load_input_rows() -> list[dict]:
    raw = sys.stdin.read()
    if not raw.strip():
        return []

    parsed = json.loads(raw)
    if isinstance(parsed, dict):
        if 'rows' in parsed:
            return list(parsed['rows'])
        return [parsed]

    return list(parsed)


def fallback_predictions(df: pd.DataFrame, hazard: str) -> list[dict]:
    rows: list[dict] = []
    for _, record in df.iterrows():
        base = 0.25
        rain_sum = float(record.get('rain_sum') or 0.0)
        humidity = float(record.get('humidity') or 0.0)
        depth = float(record.get('depth') or 0.0)
        level_difference = float(record.get('level_difference') or 0.0)
        spi = float(record.get('spi') or 0.0)

        if hazard == 'Flood':
            crisis = min(1.0, base + rain_sum / 150.0 + abs(level_difference) / 2.0 + abs(spi) / 6.0)
        elif hazard == 'Landslide':
            crisis = min(1.0, base + humidity / 250.0 + depth / 2.5 + abs(spi) / 6.0)
        else:
            crisis = min(1.0, base + max(0.0, 1.0 - humidity / 100.0) + max(0.0, 1.0 - rain_sum / 120.0))

        normal = max(0.05, 1.0 - crisis)
        moderate = min(0.45, crisis * 0.35)
        severe = min(0.35, crisis * 0.35)
        extreme = max(0.0, 1.0 - (normal + moderate + severe))
        total = normal + moderate + severe + extreme
        normal /= total
        moderate /= total
        severe /= total
        extreme /= total
        probs = [normal, moderate, severe, extreme]
        predicted = int(np.argmax(probs))

        for horizon in (1, 2, 3):
            feature_date = pd.Timestamp(record['feature_date']).date()
            predicted_for_date = feature_date + pd.Timedelta(days=horizon)
            rows.append({
                'division_id': int(record['division_id']),
                'division_name': record['division_name'],
                'district': record['district'],
                'feature_date': feature_date.isoformat(),
                'predicted_for_date': predicted_for_date.isoformat(),
                'horizon': horizon,
                'hazard_type': hazard.upper(),
                'prob_normal': float(normal),
                'prob_moderate': float(moderate),
                'prob_severe': float(severe),
                'prob_extreme': float(extreme),
                'predicted_severity': predicted,
                'predicted_severity_label': SEVERITY_MAP[predicted],
            })
    return rows


def run_model(model, df: pd.DataFrame, hazard: str) -> list[dict]:
    X = df[FEATURES].copy().fillna(0.0)
    proba_list = model.predict_proba(X)

    rows: list[dict] = []
    for horizon_index, proba in enumerate(proba_list):
        horizon = horizon_index + 1
        if proba.shape[1] < 4:
            pad = np.zeros((proba.shape[0], 4 - proba.shape[1]))
            proba = np.hstack([proba, pad])

        predicted = np.argmax(proba, axis=1)
        for i, (_, record) in enumerate(df.iterrows()):
            feature_date = pd.Timestamp(record['feature_date']).date()
            predicted_for_date = feature_date + pd.Timedelta(days=horizon)
            rows.append({
                'division_id': int(record['division_id']),
                'division_name': record['division_name'],
                'district': record['district'],
                'feature_date': feature_date.isoformat(),
                'predicted_for_date': predicted_for_date.isoformat(),
                'horizon': horizon,
                'hazard_type': hazard.upper(),
                'prob_normal': float(proba[i, 0]),
                'prob_moderate': float(proba[i, 1]),
                'prob_severe': float(proba[i, 2]),
                'prob_extreme': float(proba[i, 3]),
                'predicted_severity': int(predicted[i]),
                'predicted_severity_label': SEVERITY_MAP[int(predicted[i])],
            })

    return rows


def main() -> int:
    rows = load_input_rows()
    if not rows:
        print('[]')
        return 0

    df = pd.DataFrame(rows)
    missing = [name for name in FEATURES if name not in df.columns]
    if missing:
        raise SystemExit(f"Missing feature columns: {', '.join(missing)}")

    models_dir = resolve_models_dir()
    output: list[dict] = []

    for hazard in HAZARDS:
        model_path = models_dir / f'{hazard}_ensemble.pkl'
        if not model_path.exists():
            print(f'[predict] Warning: model missing at {model_path} - using fallback', file=sys.stderr)
            output.extend(fallback_predictions(df, hazard))
            continue

        try:
            model = joblib.load(model_path)
        except Exception as exc:  # pragma: no cover - defensive fallback for pickle compatibility issues
            print(f'[predict] Warning: failed to load {hazard} model ({exc}) - using fallback', file=sys.stderr)
            output.extend(fallback_predictions(df, hazard))
            continue

        output.extend(run_model(model, df, hazard))

    print(json.dumps(output, default=str))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())