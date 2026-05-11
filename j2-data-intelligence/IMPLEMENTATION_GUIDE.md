# J2 Data & Intelligence - Fresh Implementation Guide

**Status**: ✅ Complete Rebuild from Scratch  
**Version**: 2.0.0  
**Date**: May 2026

---

## 📋 Overview

The J2 Data & Intelligence microservice is the **central data processing and prediction engine** for the Disaster Response System. It:

1. **Consumes** sensor data from J1 IoT devices via Kafka
2. **Stores** sensor readings in PostgreSQL
3. **Processes** data through ML models to predict disaster risk
4. **Publishes** risk alerts (NORMAL/MODERATE/SEVERE/EXTREME + probabilities) to Kafka for J3 dashboard

### Data Flow
```
J1 IoT Devices 
    ↓ (JSON sensor data via Kafka)
J2 Kafka Consumer
    ↓ (Store in PostgreSQL)
J2 Prediction Engine (ML models)
    ↓ (Generate risk probabilities 0-1)
J2 Kafka Producer
    ↓ (JSON risk alerts via Kafka)
J3 Dashboard / J4 Monitoring
```

---

## 🏗️ Architecture

### Database Schema

**Tables Created:**

| Table | Purpose |
|-------|---------|
| `divisions` | Sri Lankan administrative divisions with lat/lon |
| `iot_devices` | Registered sensor nodes (FLOOD, LANDSLIDE, DROUGHT) |
| `sensor_readings` | Time-series data from J1 devices |
| `disaster_predictions` | ML-generated risk predictions per division |
| `risk_alerts` | Published alerts ready for Kafka |

### Data Models (SQLAlchemy)

**Location**: `app/db/models.py`

Core entities:
- `Division` — Administrative divisions
- `IoTDevice` — Sensor node registration
- `SensorReading` — Raw time-series sensor data
- `DisasterPrediction` — ML prediction outputs
- `RiskAlert` — Publishable alert records

### Input Format (from J1)

**Flood Data:**
```json
{
  "id": "J1_TX_01",
  "type": "FLOOD",
  "temp": 28.5,
  "hum": 65.0,
  "depth": 1.24
}
```

**Landslide Data:**
```json
{
  "id": "J1_TX_02",
  "type": "LANDSLIDE",
  "temp": 22.3,
  "hum": 55.0,
  "moist": 512,
  "ax": 0.15, "ay": -0.08, "az": 9.81,
  "gx": 0.02, "gy": 0.01, "gz": -0.03
}
```

### Output Format (to Kafka)

**Risk Alert Event** on topic `j2.engine.risk-alerts`:
```json
{
  "event_type": "RISK_ALERT",
  "source": "j2-data-intelligence",
  "payload": {
    "division_id": 1,
    "division_name": "Colombo",
    "district": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "hazard_type": "FLOOD",
    "prediction_category": "SEVERE",
    "prediction_probability": 0.87,
    "consideration_score": 0.82,
    "flood_probability": 0.87,
    "landslide_probability": 0.15,
    "drought_probability": 0.22,
    "timestamp": "2026-05-10T14:30:00Z"
  },
  "published_at": "2026-05-10T14:30:05Z"
}
```

---

## 🚀 Installation & Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Kafka broker running (for testing)
- Docker & Docker Compose

### Local Development Setup

#### 1. **Create Virtual Environment**

```bash
cd j2-data-intelligence
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### 2. **Install Dependencies**

```bash
pip install -r requirements.txt
```

#### 3. **Environment Configuration**

Create `.env` in the project root:

```bash
# Local development (PostgreSQL on localhost)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/j2_data_intelligence

# Kafka (can use localhost:9092 for local Kafka)
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC_SENSOR_DATA=j1.sensor-data
KAFKA_TOPIC_RISK_ALERTS=j2.engine.risk-alerts

# Service
HOST=0.0.0.0
PORT=8082
LOG_LEVEL=INFO
```

#### 4. **Initialize Database**

```bash
# Create PostgreSQL database
createdb j2_data_intelligence

# Seed divisions and IoT devices
python seed_data.py
```

#### 5. **Run the Service**

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

Service should be available at: `http://localhost:8082`

### Docker Compose Setup

#### 1. **Update Root docker-compose.yml**

Add/update J2 service in `/docker-compose.yml`:

```yaml
j2-data-intelligence:
  build:
    context: ./j2-data-intelligence
    dockerfile: Dockerfile
  container_name: j2-data-intelligence
  ports:
    - "8082:8082"
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/j2_data_intelligence
    KAFKA_BROKER: kafka:29092
    KAFKA_TOPIC_SENSOR_DATA: j1.sensor-data
    KAFKA_TOPIC_RISK_ALERTS: j2.engine.risk-alerts
  depends_on:
    - postgres
    - kafka
  networks:
    - disaster-response-net
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8082/api/v1/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
```

#### 2. **Start Services**

```bash
# From root directory
docker-compose up -d

# Or build fresh
docker-compose up -d --build j2-data-intelligence
```

#### 3. **Initialize Database in Container**

```bash
docker exec j2-data-intelligence python seed_data.py
```

---

## 📊 API Endpoints

### Health & Info

**GET** `/api/v1/health`
```
Returns: { "status": "ok" }
```

**GET** `/api/v1/intelligence`
```
Returns: { "service": "j2-data-intelligence", "status": "ready" }
```

### Prediction Triggers

**POST** `/api/v1/engine/predict`

Trigger prediction pipeline for all divisions (background task).

```bash
curl -X POST http://localhost:8082/api/v1/engine/predict
```

**POST** `/api/v1/engine/predict-division/{division_id}`

Trigger prediction for specific division.

```bash
curl -X POST http://localhost:8082/api/v1/engine/predict-division/1
```

### Query Predictions

**GET** `/api/v1/predictions/latest`

Get latest predictions for all divisions.

**GET** `/api/v1/predictions/division/{division_id}`

Get predictions for specific division.

---

## 🔧 Service Components

### 1. **Kafka Consumer** (`app/services/kafka_consumer.py`)

- Subscribes to J1 sensor data topics
- Validates and parses incoming JSON messages
- Stores readings in `sensor_readings` table
- Maps sensor IDs to divisions

**Usage:**
```python
from app.services.kafka_consumer import SensorDataConsumer, create_kafka_consumer_config

config = create_kafka_consumer_config("kafka:29092", "j2-sensor-consumer")
consumer = SensorDataConsumer(config)
consumer.connect()
consumer.subscribe_to_topics(["j1.sensor-data"])

for success, message in consumer.consume_data(db):
    if success:
        print(f"Processed: {message}")
```

### 2. **Prediction Engine** (`app/services/prediction_engine.py`)

- Loads pre-trained ML models (XGBoost + LightGBM)
- Extracts features from sensor readings
- Generates probability scores (0.0-1.0)
- Converts to categories: NORMAL, MODERATE, SEVERE, EXTREME

**Usage:**
```python
from app.services.prediction_engine import RiskPredictionEngine

engine = RiskPredictionEngine()

# Predict for single division
predictions = engine.predict_for_division(db, division)

# Predict for all divisions
all_predictions = engine.predict_all_divisions(db)
```

### 3. **Kafka Producer** (`app/services/kafka_producer.py`)

- Formats predictions into risk alert events
- Publishes to Kafka topic `j2.engine.risk-alerts`
- Creates `risk_alerts` database records for audit trail

**Usage:**
```python
from app.services.kafka_producer import RiskAlertProducer, create_kafka_producer_config

config = create_kafka_producer_config("kafka:29092")
producer = RiskAlertProducer(config)
producer.connect()

# Publish single alert
producer.publish_alert(db, prediction)

# Publish batch
producer.publish_batch(db, predictions, sync=False)
```

### 4. **FastAPI Routes** (`app/api/routes.py`)

RESTful endpoints with background task support for long-running operations.

---

## 🧪 Testing the Pipeline

### 1. **Seed Data**

```bash
python seed_data.py
```

Populates:
- 21 Sri Lankan divisions with population data
- 5 sample IoT devices across different divisions

### 2. **Manually Trigger Prediction**

```bash
curl -X POST http://localhost:8082/api/v1/engine/predict
```

### 3. **Verify Database**

```bash
psql j2_data_intelligence -c "SELECT * FROM divisions LIMIT 5;"
psql j2_data_intelligence -c "SELECT * FROM sensor_readings LIMIT 5;"
psql j2_data_intelligence -c "SELECT * FROM disaster_predictions LIMIT 5;"
```

### 4. **Monitor Kafka**

**Consumer** (subscribe to alerts):
```bash
kafka-console-consumer --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning
```

**Producer** (simulate J1 sensor data):
```bash
echo '{
  "id": "J1_TX_01",
  "type": "FLOOD",
  "temp": 28.5,
  "hum": 65.0,
  "depth": 1.5
}' | kafka-console-producer --broker-list kafka:29092 \
  --topic j1.sensor-data
```

---

## 🔄 End-to-End Workflow

### Scenario: Flood Alert Generation

1. **J1 publishes sensor data**
   ```
   Topic: j1.sensor-data
   Message: {"id": "J1_TX_01", "type": "FLOOD", "depth": 1.5, ...}
   ```

2. **J2 consumer ingests**
   - Validates JSON structure
   - Stores in `sensor_readings` table
   - Links to division via device registration

3. **J2 prediction engine runs (on trigger)**
   - Extracts 24-hour flood sensor history
   - Computes features (depth_mean, depth_max, etc.)
   - Feeds to XGBoost/LightGBM ensemble
   - Outputs probability: 0.87

4. **Category assignment**
   - 0.87 probability → threshold → SEVERE

5. **Alert publication**
   - Creates `DisasterPrediction` record
   - Creates `RiskAlert` record
   - Publishes to Kafka topic

6. **J3 Dashboard consumes**
   - Subscribes to `j2.engine.risk-alerts`
   - Renders on map
   - Updates severity indicator

---

## 📁 Project Structure

```
j2-data-intelligence/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI application
│   ├── db/
│   │   ├── database.py                  # SQLAlchemy setup
│   │   └── models.py                    # ORM models (fresh schema)
│   ├── api/
│   │   └── routes.py                    # API endpoints
│   ├── services/
│   │   ├── kafka_consumer.py            # J1 data consumer
│   │   ├── prediction_engine.py         # ML predictions
│   │   └── kafka_producer.py            # Risk alert producer
│   └── models/
│       ├── Flood_ensemble.pkl
│       ├── Landslide_ensemble.pkl
│       └── Drought_ensemble.pkl
├── Dockerfile                           # Multi-stage build
├── requirements.txt                     # Python dependencies
├── .env.example                         # Environment template
├── seed_data.py                         # Division/device data loader
└── README.md                            # This file
```

---

## 🔐 Security Considerations

1. **Database Credentials**: Always use environment variables, never hardcode
2. **Kafka Authentication**: Configure SASL/SSL in production
3. **API Authentication**: J4 Keycloak integration (future phase)
4. **Data Validation**: Pydantic schemas validate all inputs
5. **Non-root Container**: Runs as unprivileged user

---

## 🐛 Troubleshooting

### PostgreSQL Connection Failed

```
ERROR: could not translate host name "postgres" to address
```

**Solution**: Ensure `postgres` service is running in Docker Compose, or use `localhost:5432` for local development.

### Kafka Publisher Connection Failed

```
ERROR: Failed to connect to Kafka: Name or service not known
```

**Solution**: Verify Kafka broker URL in `.env`. Use `kafka:29092` inside Docker, `localhost:9092` locally.

### No Predictions Generated

```
WARNING: No readings for division X
```

**Solution**: Ensure sensor data has been sent to Kafka before triggering predictions. Run seed script.

### Database Migration Issues

If models don't match schema:
```bash
# Drop and recreate
dropdb j2_data_intelligence
createdb j2_data_intelligence
python seed_data.py
```

---

## 📝 Future Enhancements

- [ ] Alembic migration management
- [ ] Authentication via J4 Keycloak
- [ ] Real-time Kafka consumer loop in background
- [ ] Advanced feature engineering for landslide detection
- [ ] API versioning (v2.0, etc.)
- [ ] Comprehensive test suite
- [ ] Performance monitoring/profiling

---

## 📚 References

- **FastAPI Docs**: http://localhost:8082/docs (interactive)
- **Kafka Topics**: `j1.sensor-data`, `j2.engine.risk-alerts`
- **Database**: PostgreSQL 15+
- **ML Models**: XGBoost + LightGBM (soft voting ensemble)

---

## 👥 Team

**J2 Subgroup** — Data & Intelligence  
Part of Group J — Disaster Response System  
May 2026

