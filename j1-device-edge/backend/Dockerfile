FROM python:3.11-slim

WORKDIR /app

# Install librdkafka for confluent-kafka. Upgrade base packages first to
# pull security patches (libcap2 CVE-2026-4878, libsystemd0/libudev1
# CVE-2026-29111) that ship in the base image with old versions.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends librdkafka-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV API_HOST=0.0.0.0 \
    API_PORT=8081 \
    PYTHONUNBUFFERED=1

EXPOSE 8081

CMD ["sh", "-c", "uvicorn app.main:app --host $API_HOST --port $API_PORT"]
