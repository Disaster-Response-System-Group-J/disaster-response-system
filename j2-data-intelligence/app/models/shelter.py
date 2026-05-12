from datetime import datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Shelter(Base):
    __tablename__ = "Shelter"

    shelter_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str | None] = mapped_column(String, nullable=True)

    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)

    max_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    current_occupancy: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)

    status: Mapped[str] = mapped_column(String, server_default=text("'CLOSED'"), nullable=False)

    contact_person: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("timezone('utc', now())"), nullable=False
    )
