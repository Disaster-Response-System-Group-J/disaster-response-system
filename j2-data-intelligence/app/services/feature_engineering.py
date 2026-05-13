import math
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd
import scipy.stats
from sklearn.preprocessing import LabelEncoder
from sqlalchemy.orm import Session

from app.db.models import Division, RainfallData, SoilMoisture, TemperatureData


@dataclass
class ComputedFeatures:
    rain_lag_1: float = 0.0
    rain_rolling_3d: float = 0.0
    rain_rolling_7d: float = 0.0
    month_sin: float = 0.0
    month_cos: float = 0.0
    spi: float = 0.0
    division_encoded: int = 0
    level_difference: float = 0.0


def build_computed_features(db: Session, telemetry, division) -> ComputedFeatures:
    """
    Compute weather-based features for a single ingest-and-predict call.
    Queries the last 30 days of RainfallData for the division and derives
    rolling/lag features needed by the weather ensemble models.
    Returns ComputedFeatures with safe defaults when historical data is sparse.
    """
    today = date.today()
    history_start = today - timedelta(days=30)

    try:
        rain_rows = (
            db.query(RainfallData.date, RainfallData.rain_sum)
            .filter(
                RainfallData.division_id == division.division_id,
                RainfallData.date >= history_start,
                RainfallData.date <= today,
            )
            .order_by(RainfallData.date)
            .all()
        )
    except Exception:
        rain_rows = []

    if rain_rows:
        dates   = [r.date for r in rain_rows]
        rains   = [float(r.rain_sum or 0.0) for r in rain_rows]
        series  = pd.Series(rains, index=pd.to_datetime(dates))
        rain_lag_1     = float(series.shift(1).fillna(0).iloc[-1])
        rain_rolling_3d = float(series.rolling(3, min_periods=1).sum().iloc[-1])
        rain_rolling_7d = float(series.rolling(7, min_periods=1).sum().iloc[-1])
        spi_val = float(compute_spi(series).iloc[-1]) if len(series) > 1 else 0.0
    else:
        rain_lag_1 = rain_rolling_3d = rain_rolling_7d = spi_val = 0.0

    recorded_at = getattr(telemetry, "recorded_at", None) or today
    month = recorded_at.month if hasattr(recorded_at, "month") else today.month
    month_sin = math.sin(2 * math.pi * month / 12)
    month_cos = math.cos(2 * math.pi * month / 12)

    # Encode division: use division_id modulo 100 as a lightweight stable encoding
    division_encoded = int(division.division_id or 0) % 100

    # Level difference: current depth minus previous depth from telemetry
    depth       = float(getattr(telemetry, "depth", None) or 0.0)
    depth_prev  = float(getattr(telemetry, "depth_prev", None) or 0.0)
    level_difference = depth - depth_prev

    return ComputedFeatures(
        rain_lag_1=rain_lag_1,
        rain_rolling_3d=rain_rolling_3d,
        rain_rolling_7d=rain_rolling_7d,
        month_sin=month_sin,
        month_cos=month_cos,
        spi=spi_val,
        division_encoded=division_encoded,
        level_difference=level_difference,
    )

def compute_spi(rain_series, window=30):
    from scipy.stats import gamma
    rolling_rain = rain_series.rolling(window=window, min_periods=1).sum()
    
    try:
        # Fit gamma distribution
        data = rolling_rain.dropna()
        if len(data) == 0 or data.sum() == 0:
            return pd.Series(0, index=rain_series.index)
        
        # Replace 0s with small value for gamma fit
        data = data.replace(0, 0.01)
        shape, loc, scale = gamma.fit(data)
        
        # CDF value for daily rainfall
        cdf = gamma.cdf(rain_series.replace(0, 0.01).fillna(0), a=shape, loc=loc, scale=scale)
        
        # Convert to Z-score (SPI)
        spi = scipy.stats.norm.ppf(cdf)
        # Handle infs
        spi = np.nan_to_num(spi, posinf=3.0, neginf=-3.0)
        return pd.Series(spi, index=rain_series.index)
    except Exception:
        return pd.Series(0, index=rain_series.index)

def engineer_features(db: Session, start_date: date, end_date: date):
    # Fetch past 30 days data before start_date for historical features
    history_start = start_date - timedelta(days=30)
    
    # Query Data
    import sqlalchemy as sa
    query = sa.text("""
        SELECT r.division_id, d.name as division_name, d.district as district, r.date, r.rain_sum, 
               t.temperature as temperature_2m_mean,
               s.moisture_7_28cm as soil_moisture_7_to_28cm,
               s.moisture_28_100cm as soil_moisture_28_to_100cm,
               s.moisture_100_255cm as soil_moisture_100_to_255cm
        FROM "RainfallData" r
        JOIN "TemperatureData" t ON r.division_id = t.division_id AND r.date = t.date
        JOIN "SoilMoisture" s ON r.division_id = s.division_id AND r.date = s.date
        JOIN "Division" d ON r.division_id = d.division_id
        WHERE r.date >= :history_start AND r.date <= :end_date
    """)
    
    df = pd.read_sql(query, db.bind, params={"history_start": history_start, "end_date": end_date})
    if df.empty:
        return pd.DataFrame()

    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(['division_id', 'date']).reset_index(drop=True)

    # Lags and Rolling
    df['rain_lag_1'] = df.groupby('division_id')['rain_sum'].shift(1).fillna(0)
    df['rain_rolling_3d'] = df.groupby('division_id')['rain_sum'].transform(lambda x: x.rolling(3, min_periods=1).sum())
    df['rain_rolling_7d'] = df.groupby('division_id')['rain_sum'].transform(lambda x: x.rolling(7, min_periods=1).sum())
    
    # SPI
    df['spi'] = df.groupby('division_id')['rain_sum'].transform(lambda x: compute_spi(x))
    
    # Seasonality
    df['month_sin'] = np.sin(2 * np.pi * df['date'].dt.month / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['date'].dt.month / 12)
    
    # Label Encode Division
    le = LabelEncoder()
    df['division_encoded'] = le.fit_transform(df['division_name'])
    
    # Filter for the target forecast range
    target_df = df[(df['date'].dt.date >= start_date) & (df['date'].dt.date <= end_date)].copy()
    
    FEATURES = [
        'rain_sum', 'temperature_2m_mean',
        'soil_moisture_7_to_28cm', 'soil_moisture_28_to_100cm', 'soil_moisture_100_to_255cm',
        'rain_lag_1', 'rain_rolling_3d', 'rain_rolling_7d',
        'month_sin', 'month_cos', 'spi', 'division_encoded'
    ]
    
    # Return features along with meta info
    meta_cols = ['division_id', 'division_name', 'district', 'date']
    
    return target_df[meta_cols + FEATURES]
