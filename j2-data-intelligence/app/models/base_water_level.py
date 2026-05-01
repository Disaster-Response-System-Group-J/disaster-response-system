from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BaseWaterLevel(Base):
    __tablename__ = "BaseWaterLevel"

    device_id: Mapped[str] = mapped_column(ForeignKey("IoT_Device.device_id"), primary_key=True)
    base_level: Mapped[float] = mapped_column(Float, nullable=False)
    set_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)