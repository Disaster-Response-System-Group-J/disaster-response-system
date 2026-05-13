from fastapi import FastAPI, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.db.database import Base, engine, get_db, SessionLocal
from app.models.resource_plan import ResourcePlan  # noqa: F401 — registers table with Base
from app.services.weather_fetcher import fetch_weather_all_divisions
from app.services.feature_engineering import engineer_features
from app.services.model_predictor import generate_predictions
from app.services.event_manager import event_manager
from app.api.ingest import router as ingest_router
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="J2 Data & Intelligence Microservice")

# Include ingest router
app.include_router(ingest_router)

async def handle_data_fetched(start_date: date, end_date: date):
    logger.info(f"DATA_FETCHED event received for {start_date} to {end_date}. Running computations...")
    db = SessionLocal()
    try:
        df_features = engineer_features(db, start_date, end_date)
        generate_predictions(df_features, db)
        logger.info("Automated forecast pipeline completed.")
    except Exception as e:
        logger.error(f"Error in automated pipeline: {e}")
    finally:
        db.close()


@app.post("/api/v1/engine/trigger")
async def trigger_pipeline(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    target_date = date.today()
    background_tasks.add_task(fetch_weather_all_divisions, db, target_date)
    return {
        "status": "Forecast pipeline triggered in background",
        "start_date": str(target_date),
        "end_date": str(target_date + timedelta(days=3)),
    }


@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy"}


scheduler = BackgroundScheduler()


def scheduled_weather_job():
    logger.info("Running daily scheduled forecast pipeline...")
    import asyncio
    db = SessionLocal()
    try:
        target_date = date.today()
        asyncio.run(fetch_weather_all_divisions(db, target_date))
    finally:
        db.close()


scheduler.add_job(scheduled_weather_job, "cron", hour=2, minute=0, timezone="UTC")


@app.on_event("startup")
def startup_event():
    scheduler.start()
    logger.info("Scheduler started (weather: daily 02:00 UTC | IoT poll: every 30 s).")
    event_manager.subscribe("DATA_FETCHED", handle_data_fetched)
    logger.info("Event listener for DATA_FETCHED registered.")


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8082, reload=True)
