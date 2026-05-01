from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.models.intelligence_record import IntelligenceRecord
from app.schemas.intelligence import (
    IntelligenceRecordCreate,
    IntelligenceRecordRead,
    ServiceInfo,
)

router = APIRouter(prefix="/api/v1/intelligence", tags=["intelligence"])


@router.get("", response_model=ServiceInfo)
def get_service_info() -> ServiceInfo:
    return ServiceInfo(service="j2-data-intelligence", status="ready")


@router.get("/records", response_model=list[IntelligenceRecordRead])
def list_records(db: Session = Depends(get_db)) -> list[IntelligenceRecordRead]:
    records = db.scalars(select(IntelligenceRecord).order_by(IntelligenceRecord.created_at.desc())).all()
    return records


@router.post("/records", response_model=IntelligenceRecordRead, status_code=status.HTTP_201_CREATED)
def create_record(
    payload: IntelligenceRecordCreate,
    db: Session = Depends(get_db),
) -> IntelligenceRecordRead:
    record = IntelligenceRecord(source=payload.source, payload=payload.payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record