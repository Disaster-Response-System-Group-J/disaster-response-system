from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReportBase(BaseModel):
    source_channel: str
    reporter_name: str | None = None
    contact_info: str | None = None
    description: str | None = None
    media_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = None
    incident_id: int | None = None


class ReportCreate(ReportBase):
    pass


class ReportRead(ReportBase):
    report_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
