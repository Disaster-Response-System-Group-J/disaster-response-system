from fastapi import FastAPI

from app.api.agent_routes import router as agent_router
from app.api.routes import router as intelligence_router
from app.schemas.common import HealthResponse

app = FastAPI(title="J2 Data Intelligence API", version="0.1.0")

app.include_router(intelligence_router)
app.include_router(agent_router)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")