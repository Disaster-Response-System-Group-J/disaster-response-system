# Stage 1: build — includes compilers and dev headers for confluent-kafka / psycopg2
FROM python:3.11-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential librdkafka-dev libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: runtime — only shared libraries, no compilers
FROM python:3.11-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka1 libpq5 libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 appuser
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
USER appuser
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8082/api/v1/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]
