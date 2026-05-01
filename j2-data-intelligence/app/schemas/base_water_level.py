from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BaseWaterLevelBase(BaseModel):
    device_id: str
    base_level: float
    set_date: datetime | None = None


class BaseWaterLevelCreate(BaseWaterLevelBase):
    pass


class BaseWaterLevelRead(BaseWaterLevelBase):
    model_config = ConfigDict(from_attributes=True)