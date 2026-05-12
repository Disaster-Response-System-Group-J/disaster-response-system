from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DispatchRecordBase(BaseModel):
    incident_id: int | None = None
    asset_id: int | None = None
    deployment_status: str | None = None
    dispatched_at: datetime | None = None
    released_at: datetime | None = None


class DispatchRecordCreate(DispatchRecordBase):
    pass


class DispatchRecordRead(DispatchRecordBase):
    dispatch_id: int

    model_config = ConfigDict(from_attributes=True)
