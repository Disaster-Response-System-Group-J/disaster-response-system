import uuid as _uuid

from sqlalchemy import Column, DateTime, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.database import Base


class ResourcePlan(Base):
    __tablename__ = "ResourcePlan"

    plan_id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), nullable=True)
    requested_by = Column(UUID(as_uuid=True), nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    status = Column(String, nullable=False, default="DRAFT")
    plan_json = Column(JSONB, nullable=False)
    divisions_analyzed = Column(Integer, nullable=True)
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
