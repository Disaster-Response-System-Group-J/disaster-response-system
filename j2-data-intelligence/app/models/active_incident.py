from datetime import datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ActiveIncident(Base):
    __tablename__ = "ActiveIncident"

    incident_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)
    affected_population: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String, server_default=text("'ACTIVE'"), nullable=False)

    latitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)
    division_id: Mapped[int | None] = mapped_column(ForeignKey("Division.division_id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("timezone('utc', now())"), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
