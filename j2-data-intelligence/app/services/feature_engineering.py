import pandas as pd
import numpy as np
import scipy.stats
from dataclasses import dataclass
from sklearn.preprocessing import LabelEncoder
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, timezone
from typing import TYPE_CHECKING
from app.db.models import RainfallData, SoilMoisture, TemperatureData, Division

if TYPE_CHECKING:
    from app.db.models import RawTelemetry


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


def build_computed_features(db: Session, telemetry: "RawTelemetry", division: Division) -> ComputedFeatures:
    today = telemetry.recorded_at.date() if telemetry.recorded_at else datetime.now(timezone.utc).date()
    history_start = today - timedelta(days=30)

    rows = (
        db.query(RainfallData)
        .filter(
            RainfallData.division_id == division.division_id,
            RainfallData.date >= history_start,
            RainfallData.date <= today,
        )
        .order_by(RainfallData.date.asc())
        .all()
    )

    rain_values = [float(r.rain_sum or 0.0) for r in rows]
    rain_lag_1 = rain_values[-2] if len(rain_values) >= 2 else 0.0
    rain_rolling_3d = sum(rain_values[-3:]) if rain_values else 0.0
    rain_rolling_7d = sum(rain_values[-7:]) if rain_values else 0.0

    month = today.month
    month_sin = float(np.sin(2 * np.pi * month / 12))
    month_cos = float(np.cos(2 * np.pi * month / 12))

    spi = 0.0
    if len(rain_values) >= 5:
        try:
            series = np.where(np.array(rain_values) == 0, 0.01, rain_values)
            shape, loc, scale = scipy.stats.gamma.fit(series)
            cdf = scipy.stats.gamma.cdf(max(rain_values[-1], 0.01), a=shape, loc=loc, scale=scale)
            spi = float(scipy.stats.norm.ppf(cdf))
            spi = max(-3.0, min(3.0, spi))
        except Exception:
            spi = 0.0

    level_difference = float(telemetry.depth or 0.0)
    division_encoded = division.division_id % 100

    return ComputedFeatures(
        rain_lag_1=rain_lag_1,
        rain_rolling_3d=rain_rolling_3d,
        rain_rolling_7d=rain_rolling_7d,
        month_sin=month_sin,
        month_cos=month_cos,
        spi=spi,
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
