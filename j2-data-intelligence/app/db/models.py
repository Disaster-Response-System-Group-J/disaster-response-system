from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class IncomingReport(Base):
    __tablename__ = "IncomingReport"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, unique=True, nullable=True)
    source_channel = Column(String, nullable=False, default="J1_SOS_APP")
    status = Column(String, nullable=False, default="PENDING_REVIEW")
    sos_type = Column(String, nullable=True)
    district = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    media_url = Column(String, nullable=True)
    contact_info = Column(String, nullable=True)
    raw_payload = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False)

class Division(Base):
    __tablename__ = "Division"
    division_id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    district = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    population = Column(Integer)

    @property
    def division_name(self):
        return self.name

    @property
    def division_population(self):
        return self.population


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


class IoTDevice(Base):
    __tablename__ = "IoTDevice"
    device_id = Column(String, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=True)
    hazard_type = Column(String, nullable=True)
    description = Column(String, nullable=True)


class RawTelemetry(Base):
    __tablename__ = "RawTelemetry"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, nullable=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=True)
    hazard_type = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    temp = Column(Float, nullable=True)
    hum = Column(Float, nullable=True)
    depth = Column(Float, nullable=True)
    moist = Column(Float, nullable=True)
    ax = Column(Float, nullable=True)
    ay = Column(Float, nullable=True)
    az = Column(Float, nullable=True)
    gx = Column(Float, nullable=True)
    gy = Column(Float, nullable=True)
    gz = Column(Float, nullable=True)
    raw_payload = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False)


class DisasterPrediction(Base):
    __tablename__ = "DisasterPrediction"
    prediction_id = Column(Integer, primary_key=True, autoincrement=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    feature_date = Column(Date, nullable=False)
    predicted_for_date = Column(Date, nullable=False)
    horizon = Column(Integer, nullable=False, default=1)
    hazard_type = Column(String, nullable=False)
    prob_normal = Column(Float, nullable=False)
    prob_moderate = Column(Float, nullable=False)
    prob_severe = Column(Float, nullable=False)
    prob_extreme = Column(Float, nullable=False)
    predicted_severity = Column(Integer, nullable=False)
    predicted_severity_label = Column(String, nullable=False)
    run_at = Column(DateTime(timezone=True), nullable=False)


class DivisionResource(Base):
    __tablename__ = "DivisionResource"
    id = Column(Integer, primary_key=True, autoincrement=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False, unique=True)
    hospital_bed_capacity = Column(Integer, nullable=True)
    emergency_shelters = Column(Integer, nullable=True)
    ambulance_count = Column(Integer, nullable=True)
    food_stock_tons = Column(Float, nullable=True)
    clean_water_capacity_liters = Column(Float, nullable=True)
    power_grid_resilience = Column(Float, nullable=True)


class ResourceRecommendation(Base):
    __tablename__ = "ResourceRecommendation"
    recommendation_id = Column(Integer, primary_key=True, autoincrement=True)
    division_id = Column(Integer, ForeignKey("Division.division_id"), nullable=False)
    hazard_type = Column(String, nullable=False)
    risk_category = Column(String, nullable=False)
    consideration_score = Column(Float, nullable=True)
    recommendation_text = Column(Text, nullable=True)
    resource_allocation_json = Column(Text, nullable=True)
    model_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
