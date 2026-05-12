from pydantic import BaseModel, ConfigDict, Field


class DivisionResourceBase(BaseModel):
    division_id: int
    hospital_bed_capacity: int | None = None
    emergency_shelters: int | None = None
    ambulance_count: int | None = None
    food_stock_tons: float | None = None
    clean_water_capacity_liters: float | None = None
    power_grid_resilience: float | None = Field(default=None, ge=0, le=1)


class DivisionResourceCreate(DivisionResourceBase):
    pass


class DivisionResourceRead(DivisionResourceBase):
    model_config = ConfigDict(from_attributes=True)