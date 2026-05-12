from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ShelterBase(BaseModel):
    name: str
    type: str | None = None
    division_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    max_capacity: int
    current_occupancy: int | None = None
    status: str | None = None
    contact_person: str | None = None
    contact_phone: str | None = None
    updated_at: datetime | None = None


class ShelterCreate(ShelterBase):
    pass


class ShelterRead(ShelterBase):
    shelter_id: int

    model_config = ConfigDict(from_attributes=True)
