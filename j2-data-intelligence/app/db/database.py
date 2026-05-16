import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

_DB_URL_RAW = os.getenv("DATABASE_URL", "")
if not _DB_URL_RAW:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Add it to j2-data-intelligence/.env"
    )

# SQLAlchemy requires postgresql+psycopg2:// but the .env stores postgresql://
DATABASE_URL = _DB_URL_RAW.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
