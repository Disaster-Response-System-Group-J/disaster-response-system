from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

APP_NAME = os.getenv("APP_NAME", "j2-data-intelligence")
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("APP_PORT", "8082"))
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://disaster:disaster123@postgres:5432/disasterdb",
)