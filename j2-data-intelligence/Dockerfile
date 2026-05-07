FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for build (e.g., confluent-kafka requires build-essential)
RUN apt-get update && apt-get install -y \
    build-essential \
    librdkafka-dev \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run the FastAPI application using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]
