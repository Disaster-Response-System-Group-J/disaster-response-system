from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.database import Base

class Division(Base):
    __tablename__ = "Division"
    division_id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    population = Column(Integer)


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
