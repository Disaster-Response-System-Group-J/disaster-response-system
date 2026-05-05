from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IoTDeviceData(Base):
    __tablename__ = "IoT_Device_Data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    device_id: Mapped[str] = mapped_column(String(50), ForeignKey("IoT_Device.device_id"), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
