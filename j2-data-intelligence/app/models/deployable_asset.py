from decimal import Decimal

from sqlalchemy import DECIMAL, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeployableAsset(Base):
    __tablename__ = "DeployableAsset"

    asset_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)

    status: Mapped[str] = mapped_column(String, server_default=text("'AVAILABLE'"), nullable=False)

    base_location: Mapped[str | None] = mapped_column(String, nullable=True)
    current_latitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)
    current_longitude: Mapped[Decimal | None] = mapped_column(DECIMAL, nullable=True)
