from datetime import date

from pydantic import BaseModel, ConfigDict


class SoilMoistureBase(BaseModel):
    division_id: int | None = None
    date: date
    moisture_7_28cm: float | None = None
    moisture_28_100cm: float | None = None
    moisture_100_255cm: float | None = None


class SoilMoistureCreate(SoilMoistureBase):
    pass


class SoilMoistureRead(SoilMoistureBase):
    soil_id: int

    model_config = ConfigDict(from_attributes=True)