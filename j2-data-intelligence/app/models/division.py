from sqlalchemy import DECIMAL, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Division(Base):
    __tablename__ = "Division"

    division_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(DECIMAL, nullable=True)
    longitude: Mapped[float | None] = mapped_column(DECIMAL, nullable=True)