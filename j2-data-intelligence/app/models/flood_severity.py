from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FloodSeverity(Base):
    __tablename__ = "FloodSeverity"

    severity_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str | None] = mapped_column(ForeignKey("IoT_Device.device_id"), nullable=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    base_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    difference: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)