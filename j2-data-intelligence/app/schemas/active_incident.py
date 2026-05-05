from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActiveIncidentBase(BaseModel):
    title: str
    severity: str
    affected_population: int | None = None
    status: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    division_id: int | None = None
    closed_at: datetime | None = None


class ActiveIncidentCreate(ActiveIncidentBase):
    pass


class ActiveIncidentRead(ActiveIncidentBase):
    incident_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
