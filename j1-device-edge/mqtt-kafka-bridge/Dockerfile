FROM python:3.11-alpine AS builder

RUN apk upgrade --no-cache

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.11-alpine

RUN apk upgrade --no-cache

WORKDIR /app

RUN adduser -D -u 1000 appuser

COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser bridge.py .

USER appuser

CMD ["python", "bridge.py"]
