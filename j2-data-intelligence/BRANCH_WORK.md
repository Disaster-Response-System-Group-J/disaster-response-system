# Branch Work Summary: januli_new

## Overview
This branch implements the **Disaster Response Resource Allocation Agent** — a Gemini-powered intelligent system that analyzes current hazard conditions and allocates emergency resources optimally across Sri Lankan administrative divisions.

## Branch Details
- **Branch Name**: `januli_new`
- **Current Commit**: `a02365c` (deleted dataset)
- **Parent Branch**: main (behind 145 commits)
- **Status**: All changes staged and ready for commit

## Key Features Implemented

### 1. Resource Allocation Agent Service
**File**: [app/services/resource_allocation_agent.py](app/services/resource_allocation_agent.py)

The core intelligence engine that:
- **Reads Division Resource Inventory** from CSV: hospital beds, shelters, ambulances, food/water stocks, power grid resilience
- **Analyzes Current Disaster Risk** from database: flood/landslide/drought predictions with severity classifications (Normal → Moderate → Severe → Extreme)
- **Processes Division Priorities** using consideration scores combining risk probability, class severity, and normalized population
- **Generates Allocation Plan** via Gemini 2.0 Flash AI model with sophisticated system prompts
- **Returns Structured Output**: allocation strategies, resource movement recommendations, and priority rankings

**Key Methods**:
- `run_allocation_agent(db, admin_decisions, target_date)` — Main entry point

**Dependencies**:
- `google.genai` — Gemini API integration
- SQLAlchemy — Database queries
- Pydantic — Schema validation

### 2. Agent API Routes
**File**: [app/api/agent_routes.py](app/api/agent_routes.py)

RESTful endpoint for the resource allocation service:

```
POST /api/v1/intelligence/agent/allocate
Content-Type: application/json

{
  "admin_decisions": "string",
  "target_date": "2026-05-08" (optional)
}

Response:
{
  "allocation_plan": "string",
  "generated_at": "2026-05-08T12:30:45Z",
  "divisions_analyzed": 25,
  "high_risk_divisions": ["Colombo", "Galle"]
}
```

**Status Codes**:
- `200` — Success
- `503` — Gemini API unavailable
- `502` — Gemini API error

### 3. Agent Data Schemas
**File**: [app/schemas/agent.py](app/schemas/agent.py)

Pydantic models for request/response validation:

- **AllocationRequest**
  - `admin_decisions: str` — Contextual instructions from DMC administrators
  - `target_date: Optional[date]` — Optional target date for planning

- **AllocationResponse**
  - `allocation_plan: str` — Generated Gemini output with resource allocation strategy
  - `generated_at: str` — ISO timestamp
  - `divisions_analyzed: int` — Count of divisions evaluated
  - `high_risk_divisions: list[str]` — Divisions classified as high-risk

### 4. Configuration Updates
**File**: [app/core/config.py](app/core/config.py)

Added Gemini API configuration:
- `GEMINI_API_KEY` — Retrieved from environment variables
- `GEMINI_MODEL` — Set to `"gemini-2.0-flash"` for optimal latency and cost

**Required Environment Variables**:
```
GEMINI_API_KEY=<your-api-key>
```

### 5. Main Application Update
**File**: [app/main.py](app/main.py)

Integrated agent routes into the FastAPI application:
```python
from app.api.agent_routes import router as agent_router
app.include_router(agent_router)
```

### 6. Resource Dataset
**File**: [Model Training and Validation/synthetic_resources_dataset(in).csv](Model%20Training%20and%20Validation/synthetic_resources_dataset(in).csv)

CSV dataset containing synthetic division resource profiles with columns:
- hospital_bed_capacity
- emergency_shelters
- ambulance_count
- food_stock_tons
- clean_water_capacity_liters
- power_grid_resilience

### 7. Dependencies Added
**File**: [requirements.txt](requirements.txt)

Added Python packages:
- `google-genai` — Google Generative AI client library for Gemini integration

## Database Models (Reference)
These existing models are leveraged by the agent:

- **Division** — Administrative divisions in Sri Lanka
- **DisasterRisk** — Current hazard predictions per division (flood/landslide/drought)
- **ConsiderationScore** — Priority scoring combining risk + population metrics
- **DivisionResources** — Static resource inventory per division

## Agent System Prompt
The agent operates under a comprehensive system prompt that instructs it to:
1. Analyze hazard conditions and resource availability
2. Prioritize high-risk, under-resourced divisions
3. Recommend resource movement and deployment strategies
4. Minimize casualties and suffering through optimal allocation
5. Provide actionable, division-by-division recommendations

## How to Test

### 1. Start Services
```bash
docker compose up -d
```

### 2. Apply Database Migrations
```bash
cd j2-data-intelligence
alembic upgrade head
```

### 3. Set Gemini API Key
```bash
export GEMINI_API_KEY=<your-key>
# or update .env file
```

### 4. Run the Service
```bash
cd j2-data-intelligence
python -m uvicorn app.main:app --reload --port 8002
```

### 5. Test the Endpoint
```bash
curl -X POST http://localhost:8002/api/v1/intelligence/agent/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "admin_decisions": "Prioritize flood relief in western divisions",
    "target_date": "2026-05-08"
  }'
```

## Deployment Checklist
- [ ] Gemini API key configured in production environment
- [ ] Database migrations applied
- [ ] CSV resource dataset properly loaded
- [ ] DisasterRisk and ConsiderationScore tables populated with latest predictions
- [ ] Kong API Gateway routes configured
- [ ] Keycloak auth tokens issued for authenticated requests

## Future Enhancements
- Real-time resource tracking and consumption metrics
- Multi-scenario planning (what-if analysis)
- Resource cost optimization
- Inter-division resource borrowing logic
- ML-based resource demand prediction
- Graphical allocation plan visualization

## Related Documentation
- [CLAUDE.md](../CLAUDE.md) — Platform architecture and setup
- [README.md](README.md) — J2 service overview
- [Architecture](../README.md) — Full system architecture

## Questions?
Refer to the CLAUDE.md file for local service URLs and credentials, or contact the J2 team.
