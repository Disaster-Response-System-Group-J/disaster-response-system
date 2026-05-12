from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SoilMoisture(Base):
    __tablename__ = "SoilMoisture"
    __table_args__ = (UniqueConstraint("division_id", "date", name="uq_soil_moisture_division_date"),)

    soil_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    moisture_7_28cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    moisture_28_100cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    moisture_100_255cm: Mapped[float | None] = mapped_column(Float, nullable=True)