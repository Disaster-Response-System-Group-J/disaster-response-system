from pydantic import BaseModel, ConfigDict


class DeployableAssetBase(BaseModel):
    name: str
    type: str
    status: str | None = None
    base_location: str | None = None
    current_latitude: float | None = None
    current_longitude: float | None = None


class DeployableAssetCreate(DeployableAssetBase):
    pass


class DeployableAssetRead(DeployableAssetBase):
    asset_id: int

    model_config = ConfigDict(from_attributes=True)
