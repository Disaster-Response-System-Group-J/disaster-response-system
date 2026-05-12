from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class ServiceInfo(BaseModel):
    service: str
    status: str