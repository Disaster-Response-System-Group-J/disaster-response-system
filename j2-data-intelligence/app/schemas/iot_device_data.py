from datetime import datetime

from pydantic import BaseModel, ConfigDict


class IoTDeviceDataBase(BaseModel):
    timestamp: datetime
    device_id: str
    payload: dict


class IoTDeviceDataCreate(IoTDeviceDataBase):
    pass


class IoTDeviceDataRead(IoTDeviceDataBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
