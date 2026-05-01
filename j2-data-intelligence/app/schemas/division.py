from pydantic import BaseModel, ConfigDict


class DivisionBase(BaseModel):
    name: str
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class DivisionCreate(DivisionBase):
    pass


class DivisionRead(DivisionBase):
    division_id: int

    model_config = ConfigDict(from_attributes=True)