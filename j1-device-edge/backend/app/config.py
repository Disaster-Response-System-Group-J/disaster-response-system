"""
J1 Bridge API - Configuration.

Settings are loaded from environment variables with safe defaults for local
Docker Compose development.
"""

import os


class Settings:
    """Application settings loaded from environment variables."""

    # J2 Service Integration (HTTP)
    J2_BASE_URL: str = os.getenv("J2_BASE_URL", "http://j2:8082")
    J2_SECRET_TOKEN: str = os.getenv("J2_SECRET_TOKEN", "dev-secret-token")
    J2_REQUEST_TIMEOUT: float = float(os.getenv("J2_REQUEST_TIMEOUT", "5.0"))

    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    IDEMPOTENCY_MAX_KEYS: int = int(os.getenv("IDEMPOTENCY_MAX_KEYS", "50000"))

    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


settings = Settings()
