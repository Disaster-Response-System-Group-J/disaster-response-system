# J2 Data Intelligence

FastAPI + SQLAlchemy service for the J2 data and intelligence layer. It uses Alembic migrations and PostgreSQL for persistence.

## Prerequisites

- Python 3.12+
- PostgreSQL 15+
- `pip`

If you are using the shared repo `docker-compose.yml`, you also need Docker Desktop.

## Project Structure

- `app/` - FastAPI application, models, schemas, and database setup
- `migrations/` - Alembic migration environment and versioned migrations
- `alembic.ini` - Alembic configuration
- `.env` - Local environment values
- `requirements.txt` - Python dependencies

## Environment Setup

The app reads configuration from `j2-data-intelligence/.env`.

Example values:

```env
APP_NAME=j2-data-intelligence
APP_VERSION=0.1.0
APP_HOST=0.0.0.0
APP_PORT=8082
DATABASE_URL=postgresql+psycopg2://disaster:disaster123@localhost:5432/disasterdb
```

If you run inside Docker, `DATABASE_URL` should point to the `postgres` container instead of `localhost`.

## Local Setup

From the `j2-data-intelligence` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start PostgreSQL locally, then run the migrations:

```powershell
python -m alembic upgrade head
```

Run the API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8082
```

## Docker Setup

From the repository root:

```powershell
docker compose up -d postgres
docker compose up -d j2-data-intelligence
```

The J2 container runs migrations automatically before starting Uvicorn.

## Migration Commands

Run migrations manually:

```powershell
python -m alembic upgrade head
```

Check the current revision:

```powershell
python -m alembic current
```

Create a new migration:

```powershell
python -m alembic revision --autogenerate -m "describe change"
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1/intelligence` - Service info

## Notes

- The database schema is split across separate Alembic revisions for Division, IoT Device, Base Water Level, Rainfall Data, Soil Moisture, Temperature Data, SPI Data, Flood Severity, and Disaster Risk.
- Keep new models and schemas aligned with the existing table names and foreign key relationships.
