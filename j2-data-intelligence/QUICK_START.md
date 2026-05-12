# J2 Quick Start Guide

## 🚀 Start J2 in 5 Minutes

### Option 1: Docker Compose (Recommended)

```bash
cd j2-data-intelligence

# Start all services
docker-compose up -d

# Initialize database
docker exec j2-data-intelligence python seed_data.py

# Check status
curl http://localhost:8082/api/v1/health
```

**Services Available:**
- **J2 Service**: http://localhost:8082
- **API Docs**: http://localhost:8082/docs
- **Kafka UI**: http://localhost:8080
- **PostgreSQL**: localhost:5432 (user: postgres, pass: postgres)

### Option 2: Local Development

```bash
cd j2-data-intelligence

# Setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/j2_data_intelligence
KAFKA_BROKER=localhost:9092
HOST=0.0.0.0
PORT=8082
EOF

# Initialize DB
python seed_data.py

# Run
python -m uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

---

## 📊 Test the Pipeline

### 1. View API Documentation
```
Open browser: http://localhost:8082/docs
```

### 2. Check Health
```bash
curl http://localhost:8082/api/v1/health
# Response: {"status": "ok"}
```

### 3. Get Service Info
```bash
curl http://localhost:8082/api/v1/intelligence
# Response: {"service": "j2-data-intelligence", "status": "ready"}
```

### 4. Trigger Prediction Pipeline
```bash
curl -X POST http://localhost:8082/api/v1/engine/predict
# Response: {"status": "triggered", "message": "..."}
```

### 5. Check Latest Predictions
```bash
curl http://localhost:8082/api/v1/predictions/latest
```

### 6. Get Predictions for Division 1 (Colombo)
```bash
curl http://localhost:8082/api/v1/predictions/division/1
```

---

## 📬 Monitor Kafka

### View Risk Alerts Being Published

```bash
# Inside kafka container
docker exec j2-kafka kafka-console-consumer \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning
```

### Simulate Sensor Data from J1

```bash
docker exec j2-kafka kafka-console-producer \
  --broker-list kafka:29092 \
  --topic j1.sensor-data

# Then type or paste:
{"id": "J1_TX_01", "type": "FLOOD", "temp": 28.5, "hum": 65.0, "depth": 1.5}
```

---

## 🗄️ Database

### Connect to PostgreSQL

```bash
# Using psql
psql -h localhost -U postgres -d j2_data_intelligence

# Or via docker
docker exec -it j2-postgres psql -U postgres -d j2_data_intelligence
```

### Useful Queries

```sql
-- View all divisions
SELECT id, name, district, latitude, longitude, population 
FROM divisions;

-- View recent sensor readings
SELECT * FROM sensor_readings 
ORDER BY created_at DESC LIMIT 10;

-- View latest predictions
SELECT * FROM disaster_predictions 
ORDER BY created_at DESC LIMIT 20;

-- Count predictions by category
SELECT prediction_category, COUNT(*) 
FROM disaster_predictions 
GROUP BY prediction_category;
```

---

## 📁 Project Structure

```
app/
├── main.py                      ← FastAPI entry point
├── db/
│   ├── database.py             ← DB config
│   └── models.py               ← SQLAlchemy models (fresh schema)
├── api/
│   └── routes.py               ← REST endpoints
└── services/
    ├── kafka_consumer.py       ← J1 sensor ingestion
    ├── prediction_engine.py    ← ML predictions
    └── kafka_producer.py       ← Risk alert publishing
```

---

## 🧪 Example Workflow

### Scenario: Generate & Publish Flood Alert

1. **Insert sample sensor data** (normally from J1):
   ```bash
   docker exec j2-postgres psql -U postgres -d j2_data_intelligence << EOF
   INSERT INTO sensor_readings (device_id, division_id, reading_timestamp, sensor_type, temperature_c, humidity_pct, water_depth_cm, raw_payload)
   VALUES ('J1_TX_01', 1, NOW(), 'FLOOD', 28.5, 65.0, 1.24, '{}');
   EOF
   ```

2. **Trigger prediction for Colombo (division_id=1)**:
   ```bash
   curl -X POST http://localhost:8082/api/v1/engine/predict-division/1
   ```

3. **Check generated prediction**:
   ```bash
   curl http://localhost:8082/api/v1/predictions/division/1
   ```

4. **Monitor Kafka for published alert**:
   ```bash
   docker exec j2-kafka kafka-console-consumer \
     --bootstrap-server kafka:29092 \
     --topic j2.engine.risk-alerts
   ```

---

## 🛑 Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes (reset everything)
docker-compose down -v
```

---

## 🔗 Integration with J3 (Dashboard)

J3 consumes from Kafka topic: `j2.engine.risk-alerts`

**Expected message format:**
```json
{
  "event_type": "RISK_ALERT",
  "source": "j2-data-intelligence",
  "payload": {
    "division_id": 1,
    "division_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "hazard_type": "FLOOD",
    "prediction_category": "SEVERE",
    "prediction_probability": 0.87,
    "timestamp": "2026-05-10T14:30:00Z"
  }
}
```

---

## 📚 Documentation

- **Full Implementation Guide**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- **API Interactive Docs**: http://localhost:8082/docs (when running)

---

## ✅ Checklist

- [ ] Docker Compose running
- [ ] PostgreSQL healthy
- [ ] Kafka broker online
- [ ] J2 service responding to health check
- [ ] Database seeded with divisions
- [ ] Can trigger predictions
- [ ] Kafka alerts being published
- [ ] J3 consuming alerts

---

**For issues, see IMPLEMENTATION_GUIDE.md section "Troubleshooting"**
