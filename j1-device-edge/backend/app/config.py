"""
J1 Bridge API - Configuration.

Settings are loaded from environment variables with safe defaults for local
Docker Compose development.
"""

import os


class Settings:
    """Application settings loaded from environment variables."""

    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    KAFKA_TOPIC_EVENTS: str = os.getenv("KAFKA_TOPIC_EVENTS", "j1.events")
    KAFKA_PRODUCER_TIMEOUT: int = int(os.getenv("KAFKA_PRODUCER_TIMEOUT", "10"))

    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    IDEMPOTENCY_MAX_KEYS: int = int(os.getenv("IDEMPOTENCY_MAX_KEYS", "50000"))

    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


settings = Settings()
