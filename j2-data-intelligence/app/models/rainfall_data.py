from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RainfallData(Base):
    __tablename__ = "RainfallData"
    __table_args__ = (UniqueConstraint("division_id", "date", name="uq_rainfall_division_date"),)

    rainfall_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    rain_sum: Mapped[float | None] = mapped_column(Float, nullable=True)