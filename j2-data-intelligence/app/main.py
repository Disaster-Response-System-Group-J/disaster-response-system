import os
import threading

from fastapi import FastAPI, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.db.database import Base, engine, get_db, SessionLocal
from app.services.weather_fetcher import fetch_weather_all_divisions
from app.services.feature_engineering import engineer_features
from app.services.model_predictor import generate_predictions
from app.services.event_manager import event_manager
from app.services.kafka_consumer import SensorDataConsumer, SOSRequestConsumer, create_kafka_consumer_config
from app.api.routes import router as j2_router
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
SENSOR_TOPICS = [
    os.getenv("KAFKA_TOPIC_FLOOD", "j1.sensor.telemetry.flood"),
    os.getenv("KAFKA_TOPIC_LANDSLIDE", "j1.sensor.telemetry.landslide"),
]


def _run_sensor_consumer():
    """Background thread: polls Kafka for sensor telemetry and runs the risk pipeline."""
    config = create_kafka_consumer_config(KAFKA_BROKER)
    consumer = SensorDataConsumer(config)
    try:
        consumer.connect()
        consumer.subscribe_to_topics(SENSOR_TOPICS)
        logger.info("Sensor consumer subscribed to %s", SENSOR_TOPICS)
        db = SessionLocal()
        try:
            while True:
                try:
                    consumer.consume_once(db, timeout=1.0)
                except Exception as exc:
                    logger.error("Sensor consumer error: %s", exc)
                    db.rollback()
        finally:
            db.close()
    except Exception as exc:
        logger.error("Sensor consumer failed to start: %s", exc)
    finally:
        consumer.close()

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="J2 Data & Intelligence Microservice")
app.include_router(j2_router)

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

def _run_sos_consumer():
    """Background thread: polls Kafka for SOS help requests and writes to IncomingReport table."""
    config = create_kafka_consumer_config(KAFKA_BROKER, group_id="j2-sos-consumer")
    consumer = SOSRequestConsumer(config)
    try:
        consumer.connect()
        consumer.subscribe_to_topics(["j1.sos.raw-reports"])
        logger.info("SOS consumer subscribed to j1.sos.raw-reports")
        db = SessionLocal()
        try:
            while True:
                try:
                    consumer.consume_once(db, timeout=1.0)
                except Exception as exc:
                    logger.error("SOS consumer error: %s", exc)
                    db.rollback()
        finally:
            db.close()
    except Exception as exc:
        logger.error("SOS consumer failed to start: %s", exc)
    finally:
        consumer.close()


@app.on_event("startup")
def startup_event():
    scheduler.start()
    logger.info("Scheduler started.")
    event_manager.subscribe("DATA_FETCHED", handle_data_fetched)
    logger.info("Event Listener for DATA_FETCHED registered.")
    thread = threading.Thread(target=_run_sensor_consumer, daemon=True, name="sensor-consumer")
    thread.start()
    logger.info("Sensor Kafka consumer thread started.")
    sos_thread = threading.Thread(target=_run_sos_consumer, daemon=True, name="sos-consumer")
    sos_thread.start()
    logger.info("SOS Kafka consumer thread started.")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8082, reload=True)
