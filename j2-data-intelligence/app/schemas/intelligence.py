from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str


class ServiceInfo(BaseModel):
    service: str
    status: str


class IntelligenceRecordBase(BaseModel):
    source: str
    payload: dict


class IntelligenceRecordCreate(IntelligenceRecordBase):
    pass


class IntelligenceRecordRead(IntelligenceRecordBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)