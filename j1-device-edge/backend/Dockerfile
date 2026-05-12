FROM python:3.12.10-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        librdkafka-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.12.10-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        librdkafka1 \
    ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r --no-create-home -u 1000 appuser

WORKDIR /app

COPY --from=builder /install /usr/local

# Remove test dirs and Cython sources from installed packages
RUN find /usr/local/lib/python3.12 \
        \( -type d -name "tests" -o -type d -name "test" \) \
        -exec rm -rf {} + 2>/dev/null; true \
    && find /usr/local/lib/python3.12 -name "*.pyx" -delete 2>/dev/null; true

COPY app/ ./app/

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
