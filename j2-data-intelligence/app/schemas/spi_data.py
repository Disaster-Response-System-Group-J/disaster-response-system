from datetime import date

from pydantic import BaseModel, ConfigDict


class SPIDataBase(BaseModel):
    division_id: int | None = None
    date: date
    spi_value: float | None = None
    timescale: int


class SPIDataCreate(SPIDataBase):
    pass


class SPIDataRead(SPIDataBase):
    spi_id: int

    model_config = ConfigDict(from_attributes=True)