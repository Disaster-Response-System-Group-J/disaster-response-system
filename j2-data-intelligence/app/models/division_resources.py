from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DivisionResources(Base):
    __tablename__ = "DivisionResources"

    division_id: Mapped[int] = mapped_column(ForeignKey("Division.division_id"), primary_key=True, nullable=False)
    hospital_bed_capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    emergency_shelters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ambulance_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    food_stock_tons: Mapped[float | None] = mapped_column(Float, nullable=True)
    clean_water_capacity_liters: Mapped[float | None] = mapped_column(Float, nullable=True)
    power_grid_resilience: Mapped[float | None] = mapped_column(Float, nullable=True)
