from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DispatchRecord(Base):
    __tablename__ = "DispatchRecord"

    dispatch_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("ActiveIncident.incident_id"), nullable=True)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("DeployableAsset.asset_id"), nullable=True)

    deployment_status: Mapped[str] = mapped_column(String, server_default=text("'EN_ROUTE'"), nullable=False)

    dispatched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("timezone('utc', now())"), nullable=False
    )
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
