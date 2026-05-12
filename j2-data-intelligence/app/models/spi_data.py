from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SPIData(Base):
    __tablename__ = "SPI_Data"
    __table_args__ = (
        UniqueConstraint("division_id", "date", "timescale", name="uq_spi_division_date_timescale"),
    )

    spi_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    spi_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    timescale: Mapped[int] = mapped_column(Integer, nullable=False)