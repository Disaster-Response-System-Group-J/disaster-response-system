from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PublicAlertBase(BaseModel):
    incident_id: int | None = None
    title: str
    message: str
    severity_level: str | None = None
    status: str | None = None
    issued_at: datetime | None = None


class PublicAlertCreate(PublicAlertBase):
    pass


class PublicAlertRead(PublicAlertBase):
    alert_id: int

    model_config = ConfigDict(from_attributes=True)
