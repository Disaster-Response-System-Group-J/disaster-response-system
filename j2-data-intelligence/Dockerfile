FROM python:3.11.12-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        build-essential \
        librdkafka-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.11.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        librdkafka1 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r --no-create-home -u 1000 appuser

WORKDIR /app

COPY --from=builder /install /usr/local

RUN find /usr/local/lib/python3.11 \
        \( -type d -name "tests" -o -type d -name "test" \) \
        -exec rm -rf {} + 2>/dev/null; true \
    && find /usr/local/lib/python3.11 -name "*.pyx" -delete 2>/dev/null; true \
    && find /usr/local/lib/python3.11 -type d -name "__pycache__" \
        -exec rm -rf {} + 2>/dev/null; true

COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini ./

USER appuser

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:8082/api/v1/health || exit 1

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT:-8082}"]
