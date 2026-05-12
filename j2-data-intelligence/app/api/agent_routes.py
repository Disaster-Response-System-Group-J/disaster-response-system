from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.schemas.agent import AllocationRequest, AllocationResponse
from app.services.resource_allocation_agent import run_allocation_agent

router = APIRouter(prefix="/api/v1/intelligence/agent", tags=["agent"])


@router.post("/allocate", response_model=AllocationResponse)
def allocate_resources(
    request: AllocationRequest,
    db: Session = Depends(get_db),
) -> AllocationResponse:
    try:
        result = run_allocation_agent(db, request.admin_decisions, request.target_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API error: {exc}",
        )
    return AllocationResponse(**result)
