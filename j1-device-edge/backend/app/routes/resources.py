"""
J1 Bridge API - Resources route.

GET /api/v1/resources returns mock emergency resources for the Flutter app to
cache locally. The shape matches ResourceModel in the mobile app.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query

from ..models import ApiResponse, ResourceResponse

router = APIRouter(prefix="/api/v1/resources", tags=["Resources"])

_NOW = datetime.now(timezone.utc).isoformat()

_MOCK_RESOURCES: list[ResourceResponse] = [
    ResourceResponse(id="res-shelter-colombo-central", type="SHELTER", name="Colombo Central Shelter", district="Colombo", status="AVAILABLE", latitude=6.9271, longitude=79.8612, capacity=300, currentLoad=120, lastUpdated=_NOW),
    ResourceResponse(id="res-shelter-kandy-relief", type="SHELTER", name="Kandy District Relief Center", district="Kandy", status="AVAILABLE", latitude=7.2906, longitude=80.6337, capacity=200, currentLoad=85, lastUpdated=_NOW),
    ResourceResponse(id="res-team-colombo-alpha", type="RESCUE_TEAM", name="Colombo Rescue Team Alpha", district="Colombo", status="AVAILABLE", latitude=6.9271, longitude=79.8612, capacity=15, currentLoad=12, lastUpdated=_NOW),
    ResourceResponse(id="res-boat-galle-south", type="BOAT", name="Rescue Boat Team - South", district="Galle", status="AVAILABLE", latitude=6.0535, longitude=80.2210, capacity=20, currentLoad=8, lastUpdated=_NOW),
    ResourceResponse(id="res-ambulance-jaffna-north", type="AMBULANCE", name="Emergency Ambulance - North", district="Jaffna", status="AVAILABLE", latitude=9.6615, longitude=80.0255, capacity=4, currentLoad=3, lastUpdated=_NOW),
    ResourceResponse(id="res-ambulance-colombo", type="AMBULANCE", name="Emergency Ambulance Service", district="Colombo", status="AVAILABLE", latitude=6.9271, longitude=79.8612, capacity=5, currentLoad=2, lastUpdated=_NOW),
    ResourceResponse(id="res-medical-colombo-mobile", type="MEDICAL_TEAM", name="Mobile Medical Unit", district="Colombo", status="AVAILABLE", latitude=6.9271, longitude=79.8612, capacity=30, currentLoad=25, lastUpdated=_NOW),
    ResourceResponse(id="res-foodwater-colombo", type="FOOD_WATER", name="Food and Water Distribution Point", district="Colombo", status="AVAILABLE", latitude=6.9271, longitude=79.8612, capacity=500, currentLoad=350, lastUpdated=_NOW),
    ResourceResponse(id="res-water-kandy", type="FOOD_WATER", name="Water Supply Station", district="Kandy", status="AVAILABLE", latitude=7.2906, longitude=80.6337, capacity=1000, currentLoad=750, lastUpdated=_NOW),
    ResourceResponse(id="res-shelter-galle", type="SHELTER", name="Galle Emergency Shelter", district="Galle", status="AVAILABLE", latitude=6.0535, longitude=80.2210, capacity=150, currentLoad=45, lastUpdated=_NOW),
    ResourceResponse(id="res-team-kandy-sar", type="RESCUE_TEAM", name="Kandy Search and Rescue", district="Kandy", status="BUSY", latitude=7.2906, longitude=80.6337, capacity=10, currentLoad=10, lastUpdated=_NOW),
    ResourceResponse(id="res-medical-batticaloa-east", type="MEDICAL_TEAM", name="Field Hospital Unit - East", district="Batticaloa", status="AVAILABLE", latitude=7.7310, longitude=81.6747, capacity=50, currentLoad=20, lastUpdated=_NOW),
]


@router.get("", response_model=ApiResponse)
async def get_resources(
    resource_type: str | None = Query(None, alias="type", description="Filter by resource type"),
    district: str | None = Query(None, description="Filter by district"),
    status: str | None = Query(None, description="Filter by status"),
):
    """Return emergency resources for the mobile app to cache locally."""
    resources = _MOCK_RESOURCES

    if resource_type:
        resources = [item for item in resources if item.type == resource_type.upper()]
    if district:
        resources = [item for item in resources if item.district.lower() == district.lower()]
    if status:
        resources = [item for item in resources if item.status == status.upper()]

    return ApiResponse(success=True, data=[item.model_dump() for item in resources])
