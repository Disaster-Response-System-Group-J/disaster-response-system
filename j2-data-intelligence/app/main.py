from fastapi import FastAPI, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.db.database import Base, engine, get_db, SessionLocal
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

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="J2 Data & Intelligence Microservice")

# Include ingest router
app.include_router(ingest_router)
async def handle_data_fetched(start_date: date, end_date: date):
    logger.info(f"DATA_FETCHED event received for date range {start_date} to {end_date}. Running computations...")
    db = SessionLocal()
    try:
        # 2. Feature Engineering
        logger.info("Engineering features for 3-day forecast...")
        df_features = engineer_features(db, start_date, end_date)
        
        # 3. Model Prediction
        logger.info("Running model predictions...")
        predictions = generate_predictions(df_features, db)
        
        logger.info("Automated forecast pipeline completed.")
    except Exception as e:
        logger.error(f"Error in automated pipeline: {e}")
    finally:
        db.close()

@app.post("/api/v1/engine/trigger")
async def trigger_pipeline(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Manually trigger the 3-day forecast pipeline"""
    target_date = date.today()
    background_tasks.add_task(fetch_weather_all_divisions, db, target_date)
    return {"status": "Forecast pipeline triggered in background", "start_date": str(target_date), "end_date": str(target_date + timedelta(days=3))}

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy"}

# Scheduler Setup
scheduler = BackgroundScheduler()

def scheduled_job():
    logger.info("Running daily scheduled forecast pipeline...")
    # Get a new DB session
    import asyncio
    db = SessionLocal()
    try:
        target_date = date.today()
        asyncio.run(fetch_weather_all_divisions(db, target_date))
    finally:
        db.close()

# Run daily at 02:00 UTC
scheduler.add_job(scheduled_job, 'cron', hour=2, minute=0, timezone='UTC')

@app.on_event("startup")
def startup_event():
    scheduler.start()
    logger.info("Scheduler started.")
    # Register Event Listener
    event_manager.subscribe("DATA_FETCHED", handle_data_fetched)
    logger.info("Event Listener for DATA_FETCHED registered.")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8082, reload=True)
