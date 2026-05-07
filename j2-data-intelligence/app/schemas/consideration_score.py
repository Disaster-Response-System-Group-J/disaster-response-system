from pydantic import BaseModel, ConfigDict, Field


class ConsiderationScoreBase(BaseModel):
    division_id: int
    hazard_type: str
    consideration_score: float = Field(ge=0, le=1)


class ConsiderationScoreCreate(ConsiderationScoreBase):
    pass


class ConsiderationScoreRead(ConsiderationScoreBase):
    consideration_score_id: int

    model_config = ConfigDict(from_attributes=True)