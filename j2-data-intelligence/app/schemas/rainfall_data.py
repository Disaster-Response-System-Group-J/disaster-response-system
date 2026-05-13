from datetime import date

from pydantic import BaseModel, ConfigDict


class RainfallDataBase(BaseModel):
    division_id: int | None = None
    date: date
    rain_sum: float | None = None


class RainfallDataCreate(RainfallDataBase):
    pass


class RainfallDataRead(RainfallDataBase):
    rainfall_id: int

    model_config = ConfigDict(from_attributes=True)