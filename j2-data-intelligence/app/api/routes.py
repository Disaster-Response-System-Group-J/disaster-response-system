from fastapi import APIRouter

from app.schemas.common import ServiceInfo

router = APIRouter(prefix="/api/v1/intelligence", tags=["intelligence"])


@router.get("", response_model=ServiceInfo)
def get_service_info() -> ServiceInfo:
    return ServiceInfo(service="j2-data-intelligence", status="ready")
