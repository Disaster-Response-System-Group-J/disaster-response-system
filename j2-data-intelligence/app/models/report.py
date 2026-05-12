from datetime import datetime
from decimal import Decimal

from sqlalchemy import DECIMAL, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Report(Base):
    __tablename__ = "Report"

    report_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_channel: Mapped[str] = mapped_column(String, nullable=False)
    reporter_name: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_info: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)

    status: Mapped[str] = mapped_column(String, server_default=text("'PENDING_REVIEW'"), nullable=False)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("ActiveIncident.incident_id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("timezone('utc', now())"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("timezone('utc', now())"), nullable=False
    )
