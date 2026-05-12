from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ConsiderationScore(Base):
    __tablename__ = "ConsiderationScore"
    __table_args__ = (
        UniqueConstraint("division_id", "hazard_type", name="uq_consideration_score_division_hazard"),
        CheckConstraint("consideration_score >= 0 AND consideration_score <= 1", name="ck_consideration_score_bounds"),
    )

    consideration_score_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    division_id: Mapped[int] = mapped_column(ForeignKey("Division.division_id"), nullable=False)
    hazard_type: Mapped[str] = mapped_column(String(50), nullable=False)
    consideration_score: Mapped[float] = mapped_column(Float, nullable=False)