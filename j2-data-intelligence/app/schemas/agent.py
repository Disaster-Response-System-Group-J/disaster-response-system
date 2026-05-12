from datetime import date
from typing import Any, Optional

from pydantic import BaseModel


class AllocationRequest(BaseModel):
    admin_decisions: str
    target_date: Optional[date] = None


class AllocationResponse(BaseModel):
    allocation_plan: dict[str, Any]
    generated_at: str
    divisions_analyzed: int
    high_risk_divisions: list[str]
    kafka_published: bool
