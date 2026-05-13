from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IoTDevice(Base):
    __tablename__ = "IoT_Device"

    device_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)
    installation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)