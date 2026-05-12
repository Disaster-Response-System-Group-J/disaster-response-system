from datetime import date

from pydantic import BaseModel, ConfigDict


class IoTDeviceBase(BaseModel):
    device_id: str
    division_id: int | None = None
    installation_date: date | None = None
    status: str | None = None


class IoTDeviceCreate(IoTDeviceBase):
    pass


class IoTDeviceRead(IoTDeviceBase):
    model_config = ConfigDict(from_attributes=True)