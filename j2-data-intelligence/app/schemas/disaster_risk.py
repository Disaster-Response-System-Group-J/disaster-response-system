from datetime import date

from pydantic import BaseModel, ConfigDict


class DisasterRiskBase(BaseModel):
    division_id: int | None = None
    date: date
    disaster_type: str | None = None
    risk_level: str | None = None
    score: float | None = None


class DisasterRiskCreate(DisasterRiskBase):
    pass


class DisasterRiskRead(DisasterRiskBase):
    risk_id: int

    model_config = ConfigDict(from_attributes=True)