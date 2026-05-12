from datetime import date

from pydantic import BaseModel, ConfigDict


class TemperatureDataBase(BaseModel):
    division_id: int | None = None
    date: date
    temperature: float | None = None


class TemperatureDataCreate(TemperatureDataBase):
    pass


class TemperatureDataRead(TemperatureDataBase):
    temp_id: int

    model_config = ConfigDict(from_attributes=True)