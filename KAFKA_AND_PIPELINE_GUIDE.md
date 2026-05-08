# Kafka Data Viewing & Pipeline Execution Guide

## Table of Contents
1. [Viewing Kafka Data](#viewing-kafka-data)
2. [Manually Running the Pipeline](#manually-running-the-pipeline)
3. [Monitoring Predictions in Kafka](#monitoring-predictions-in-kafka)

---

## Viewing Kafka Data

### 1. List All Kafka Topics
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server kafka:29092
```

### 2. View Messages from a Topic (from the beginning)
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic j2.engine.risk-alerts --from-beginning
```

### 3. View Messages from a Topic (real-time, new messages only)
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic j2.engine.risk-alerts
```

### 4. Get Topic Details (partitions, replication factor, etc.)
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-topics.sh --describe --topic j2.engine.risk-alerts --bootstrap-server kafka:29092
```

### 5. View Formatted JSON Output
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic j2.engine.risk-alerts --from-beginning | jq '.' 2>/dev/null || cat
```

---

## Topic Names Reference

| Topic | Description |
|-------|-------------|
| `j2.engine.risk-alerts` | ML predictions with consideration scores |
| `j1.sos.raw-reports` | SOS reports from J1 devices |
| `j1.sensor.telemetry` | Sensor telemetry data |
| `j2.engine.incidents` | Incident events |
| `j3.dashboard.report-updates` | Dashboard report updates |
| `j3.dashboard.resource-updates` | Dashboard resource updates |

---

## Manually Running the Pipeline

### Prerequisites
1. Ensure Docker containers are running:
```bash
docker-compose up -d
```

2. Verify J2 backend is running:
```bash
docker logs -f disaster-j2-backend
```

### Method 1: Trigger via HTTP API

**Endpoint:** `POST http://localhost:8000/api/v1/engine/trigger`

**Using curl:**
```bash
curl -X POST http://localhost:8000/api/v1/engine/trigger
```

**Using Python:**
```python
import requests
response = requests.post("http://localhost:8000/api/v1/engine/trigger")
print(response.json())
```

**Expected Response:**
```json
{
  "status": "Forecast pipeline triggered in background",
  "start_date": "2026-05-08",
  "end_date": "2026-05-11"
}
```

### Method 2: Trigger via Python Script

Create a script `run_pipeline_manual.py` in `j2-data-intelligence/`:

```python
import asyncio
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.services.weather_fetcher import fetch_weather_all_divisions
from app.services.event_manager import event_manager
from app.services.feature_engineering import engineer_features
from app.services.model_predictor import generate_predictions
from app.db.database import Base
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

async def run_pipeline():
    """Manually run the entire pipeline"""
    db = Session()
    try:
        print("🚀 Starting Pipeline...")
        
        # Step 1: Fetch weather data
        print("📡 Fetching weather data from OpenMeteo...")
        start_date = datetime.now()
        end_date = start_date + timedelta(days=3)
        await fetch_weather_all_divisions(db, start_date, end_date)
        
        # Step 2: Engineer features
        print("🔧 Engineering features...")
        features_df = engineer_features(db, start_date, end_date)
        print(f"   Generated features for {len(features_df)} records")
        
        # Step 3: Generate predictions
        print("🤖 Generating predictions...")
        await generate_predictions(db, start_date, end_date)
        
        print("✅ Pipeline completed successfully!")
        
    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_pipeline())
```

**Run it:**
```bash
cd j2-data-intelligence
python run_pipeline_manual.py
```

### Method 3: Trigger via Python Interactive Shell

```bash
cd j2-data-intelligence
python -c "
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.services.weather_fetcher import fetch_weather_all_divisions
from app.services.feature_engineering import engineer_features
from app.services.model_predictor import generate_predictions
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

start_date = datetime.now()
end_date = start_date + timedelta(days=3)

async def run():
    await fetch_weather_all_divisions(db, start_date, end_date)
    engineer_features(db, start_date, end_date)
    await generate_predictions(db, start_date, end_date)
    
asyncio.run(run())
print('✅ Done!')
"
```

---

## Monitoring Predictions in Kafka

### Step 1: Open a Kafka Consumer Terminal

In a separate terminal, start watching for new predictions:

```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning
```

Or with pretty-printed JSON (requires `jq`):

```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning | jq '.'
```

### Step 2: Trigger the Pipeline

In another terminal, run one of the methods above:

```bash
# Using API
curl -X POST http://localhost:8000/api/v1/engine/trigger

# Or using the Python script
cd j2-data-intelligence && python run_pipeline_manual.py
```

### Step 3: Observe Kafka Output

The Kafka consumer will display JSON messages like:

```json
{
  "eventId": "evt_uuid_here",
  "eventType": "RISK_ALERT",
  "timestamp": "2026-05-08T10:30:00Z",
  "payload": {
    "alertId": "ALT-001",
    "type": "RISK_ALERT",
    "severity": "CRITICAL",
    "title": "Flood Warning - Central Province",
    "description": "High risk of flooding in the Central Province",
    "district": "Colombo",
    "divisionId": 1,
    "divisionName": "Colombo City",
    "forecastDate": "2026-05-09",
    "predictionKind": "PROBABILISTIC",
    "predictionCategory": "FLOOD",
    "predictionProbability": 0.92,
    "topProbabilityKey": "SEVERE",
    "probabilities": {
      "NO_EVENT": 0.08,
      "MILD": 0.02,
      "MODERATE": 0.05,
      "SEVERE": 0.72,
      "EXTREME": 0.13
    },
    "considerationScore": 0.78,
    "hazardType": "FLOOD",
    "predictedSeverityLabel": "SEVERE",
    "featureDate": "2026-05-08"
  }
}
```

**Key fields to check:**
- `predictionCategory`: Type of hazard (FLOOD, LANDSLIDE, DROUGHT)
- `predictionProbability`: Probability of the predicted category (0.0 - 1.0)
- `considerationScore`: Composite risk score incorporating population impact (0.0 - 1.0)
- `probabilities`: Full distribution across all severity levels
- `severity`: Alert severity level (CRITICAL, HIGH, MEDIUM, LOW)

---

## Send a Synthetic Alert to the UI

If you just want to verify the UI toast path without waiting for a real model run, send one synthetic risk alert into the Kafka topic.

### 1. Start the UI listener

Make sure the J3 app and event bridge are running so `j2.engine.risk-alerts` is forwarded to the dashboard.

### 2. Send the synthetic alert

From `j3-system-interaction/dms` run:

```bash
npm run synthetic:risk-alert
```

If Kafka is not on the default host, set the broker first:

```bash
KAFKA_BROKER=localhost:29092 npm run synthetic:risk-alert
```

The script will also try `localhost:9092` automatically if `29092` is not the active host port.

If direct broker access still fails, it automatically falls back to `docker exec` against the `disaster-kafka` container and writes the message from inside the broker network.

## Exact Terminal Order

Use these terminals in this order if you want to verify the UI toast end to end:

### Terminal 1: Start Kafka infrastructure
From the repository root:
```bash
docker compose up -d kafka
```

### Terminal 2: Start the J3 UI
```bash
cd /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms
npm run dev
```

### Terminal 3: Start the Kafka to UI bridge
```bash
cd /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms
node event-bridge.js
```

### Terminal 4: Send the synthetic alert
```bash
cd /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms
npm run synthetic:risk-alert
```

### Optional Terminal 5: Watch the Kafka topic
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic j2.engine.risk-alerts --from-beginning
```

If your Kafka container exposes a different host port, the updated bridge and synthetic sender will try both `localhost:29092` and `localhost:9092` automatically.

### 3. Watch the UI

Open the dashboard and keep the browser console or toast area visible. You should see a high-priority alert for the synthetic Colombo flood watch.

### 4. Optional Kafka check

To confirm the message was written, consume the topic from the beginning in another terminal:

```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic j2.engine.risk-alerts --from-beginning
```

---

## Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   MANUAL TRIGGER                            │
│  curl -X POST http://localhost:8000/api/v1/engine/trigger   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  trigger_pipeline() [main.py]                               │
│  └─ BackgroundTasks.add_task(fetch_weather_all_divisions)   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  fetch_weather_all_divisions() [weather_fetcher.py]         │
│  └─ Fetch data from OpenMeteo for 121 divisions             │
│  └─ Upsert to DB (RainfallData, TemperatureData, etc)       │
│  └─ emit("DATA_FETCHED")                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  handle_data_fetched() [main.py] - Event Listener           │
│  └─ Called when DATA_FETCHED event is emitted               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  engineer_features() [feature_engineering.py]               │
│  └─ Join weather tables                                      │
│  └─ Compute lags, rolling stats, SPI, seasonality           │
│  └─ Return feature matrix                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  generate_predictions() [model_predictor.py]                │
│  └─ Load 3 ensemble models (Flood, Landslide, Drought)      │
│  └─ predict_proba() on feature matrix                       │
│  └─ Calculate consideration_score                           │
│  └─ Upsert to Predictions table                             │
│  └─ db.commit()                                             │
│  └─ publish_predictions() [kafka_producer.py]               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Kafka Publisher [kafka_producer.py]                        │
│  └─ Produce to j2.engine.risk-alerts topic                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Event Bridge [j3-system-interaction/dms/event-bridge.js]   │
│  └─ Consume from j2.engine.risk-alerts                      │
│  └─ emit('dashboard:risk-alert') via Socket.IO              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Dashboard (React)                                 │
│  └─ Receive via Socket.IO                                  │
│  └─ Display prediction metadata                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### No data appearing in Kafka?

1. Check J2 backend logs:
```bash
docker logs disaster-j2-backend | tail -50
```

2. Check if models are trained:
```bash
ls j2-data-intelligence/app/models/
```

3. Verify database connection:
```bash
docker exec -it disaster-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM predictions;"
```

### Kafka broker not responding?

```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server kafka:29092
```

### Messages not formatted as JSON?

The messages are already JSON. To verify:
```bash
docker exec -it disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --max-messages 1 | head -1 | jq '.'
```
