"""
J1 Bridge API - Configuration.

All settings are loaded from environment variables with safe defaults for
local Docker Compose development.
"""

import os


class Settings:
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    KAFKA_TOPIC_SOS_REPORTS: str = os.getenv("KAFKA_TOPIC_SOS_REPORTS", "j1.sos.raw-reports")
    KAFKA_TOPIC_SENSOR_TELEMETRY: str = os.getenv("KAFKA_TOPIC_SENSOR_TELEMETRY", "j1.sensor.telemetry")

    # API
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8081"))
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

    # Idempotency
    IDEMPOTENCY_MAX_KEYS: int = int(os.getenv("IDEMPOTENCY_MAX_KEYS", "50000"))


settings = Settings()
