from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FloodSeverityBase(BaseModel):
    device_id: str | None = None
    timestamp: datetime | None = None
    current_level: float | None = None
    base_level: float | None = None
    difference: float | None = None
    severity: str | None = None


class FloodSeverityCreate(FloodSeverityBase):
    pass


class FloodSeverityRead(FloodSeverityBase):
    severity_id: int

    model_config = ConfigDict(from_attributes=True)