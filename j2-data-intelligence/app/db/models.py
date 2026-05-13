from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey, UniqueConstraint, Text, Numeric, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class Division(Base):
    __tablename__ = "Division"
    division_id = Column(Integer, primary_key=True, index=True)
    division_name = Column(String)
    district = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    province = Column(String)
    division_population = Column(Integer)


class Resource(Base):
    __tablename__ = "Resource"
    id = Column(String, primary_key=True, index=True)
    type = Column(String)
    name = Column(String)
    district = Column(String, index=True)
    status = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    capacity = Column(Integer)
    currentLoad = Column(Integer)
    lastUpdated = Column(DateTime)


class IoTDevice(Base):
    __tablename__ = "IoT_Device"
    device_id = Column(String, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=True)
    installation_date = Column(Date)
    status = Column(String)


class RawTelemetry(Base):
    __tablename__ = "raw_telemetry"
    telemetry_id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, nullable=False)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=True)
    hazard_type = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    temp = Column(Float)
    hum = Column(Float)
    depth = Column(Float)
    moist = Column(Float)
    ax = Column(Float)
    ay = Column(Float)
    az = Column(Float)
    gx = Column(Float)
    gy = Column(Float)
    gz = Column(Float)
    raw_payload = Column(Text)
    recorded_at = Column(DateTime)


class DisasterPrediction(Base):
    __tablename__ = "disaster_predictions"
    prediction_id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    feature_date = Column(Date)
    predicted_for_date = Column(Date)
    horizon = Column(Integer)
    hazard_type = Column(String, nullable=False)
    prob_normal = Column(Float)
    prob_moderate = Column(Float)
    prob_severe = Column(Float)
    prob_extreme = Column(Float)
    predicted_severity = Column(Integer)
    predicted_severity_label = Column(String)
    run_at = Column(DateTime)


class RainfallData(Base):
    __tablename__ = "RainfallData"
    rainfall_id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    date = Column(Date, nullable=False)
    rain_sum = Column(Float)
    __table_args__ = (UniqueConstraint('division_id', 'date', name='idx_rainfall_div_date'),)


class SoilMoisture(Base):
    __tablename__ = "SoilMoisture"
    soil_id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    date = Column(Date, nullable=False)
    moisture_7_28cm = Column(Float)
    moisture_28_100cm = Column(Float)
    moisture_100_255cm = Column(Float)
    __table_args__ = (UniqueConstraint('division_id', 'date', name='idx_soil_div_date'),)


class TemperatureData(Base):
    __tablename__ = "TemperatureData"
    temp_id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    date = Column(Date, nullable=False)
    temperature = Column(Float)
    __table_args__ = (UniqueConstraint('division_id', 'date', name='idx_temp_div_date'),)


class Predictions(Base):
    __tablename__ = "Predictions"
    prediction_id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    date = Column(Date, nullable=False)
    flood_probability = Column(Float)
    landslide_probability = Column(Float)
    drought_probability = Column(Float)
    consideration_score = Column(Float)
    __table_args__ = (UniqueConstraint('division_id', 'date', name='idx_pred_div_date'),)


class IoTFlood(Base):
    __tablename__ = "iot_flood"
    id = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)
    temp = Column(Numeric)
    hum = Column(Integer)
    depth = Column(Numeric)
    created_at = Column(DateTime)


class IoTLandslide(Base):
    __tablename__ = "iot_landslide"
    id = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)
    temp = Column(Numeric)
    hum = Column(Integer)
    moist = Column(Integer)
    ax = Column(Integer)
    ay = Column(Integer)
    az = Column(Integer)
    gx = Column(Integer)
    gy = Column(Integer)
    gz = Column(Integer)
    created_at = Column(DateTime)


class IoTPrediction(Base):
    __tablename__ = "iot_predictions"
    id = Column(String, primary_key=True, index=True)
    source_id = Column(String, nullable=False, index=True)
    disaster_type = Column(String, nullable=False)
    predicted_status = Column(String, nullable=False)
    horizon = Column(Integer, nullable=False, default=0)   # 0=now 1=Day+1 2=Day+2 3=Day+3
    temp = Column(Numeric)
    hum = Column(Integer)
    depth_prev = Column(Numeric)
    depth = Column(Numeric)
    moist = Column(Integer)
    ax = Column(Integer)
    ay = Column(Integer)
    az = Column(Integer)
    gx = Column(Integer)
    gy = Column(Integer)
    gz = Column(Integer)
    predicted_at = Column(DateTime)
    __table_args__ = (UniqueConstraint('source_id', 'disaster_type', 'horizon',
                                       name='iot_predictions_source_type_horizon_unique'),)


class DivisionResource(Base):
    __tablename__ = "DivisionResources"
    __table_args__ = {'extend_existing': True}
    division_id = Column(Integer, ForeignKey("Division.division_id"), primary_key=True)
    hospital_bed_capacity = Column(Integer)
    emergency_shelters = Column(Integer)
    ambulance_count = Column(Integer)
    food_stock_tons = Column(Float)
    clean_water_capacity_liters = Column(Float)
    power_grid_resilience = Column(Float)


class ResourceRecommendation(Base):
    __tablename__ = "ResourceRecommendation"
    recommendation_id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    hazard_type = Column(String, nullable=False)
    risk_category = Column(String, nullable=False)
    consideration_score = Column(Float)
    recommendation_text = Column(Text)
    resource_allocation_json = Column(Text)
    model_name = Column(String)
    created_at = Column(DateTime)
