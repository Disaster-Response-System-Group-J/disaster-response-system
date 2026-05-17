from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

APP_NAME = os.getenv("APP_NAME", "j2-data-intelligence")
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("APP_PORT", "8082"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
KAFKA_TOPIC_ALLOCATION    = os.getenv("KAFKA_TOPIC_ALLOCATION",    "j2.engine.allocation-plan")
KAFKA_TOPIC_SENSOR        = os.getenv("KAFKA_TOPIC_SENSOR",        "j1.sensor.telemetry")
KAFKA_TOPIC_SOS_REPORTS   = os.getenv("KAFKA_TOPIC_SOS_REPORTS",   "j1.sos.raw-reports")
KAFKA_CONSUMER_GROUP      = os.getenv("KAFKA_CONSUMER_GROUP",      "j2-sensor-consumer")