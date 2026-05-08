from datetime import date
from typing import Optional

from pydantic import BaseModel


class AllocationRequest(BaseModel):
    admin_decisions: str
    target_date: Optional[date] = None


class AllocationResponse(BaseModel):
    allocation_plan: str
    generated_at: str
    divisions_analyzed: int
    high_risk_divisions: list[str]
