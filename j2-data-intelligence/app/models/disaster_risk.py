from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DisasterRisk(Base):
    __tablename__ = "DisasterRisk"
    __table_args__ = (UniqueConstraint("division_id", "date", "disaster_type", name="uq_disaster_risk_division_date_type"),)

    risk_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    disaster_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)