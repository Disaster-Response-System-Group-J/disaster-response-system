# J2 Architecture - Visual Reference Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DISASTER RESPONSE SYSTEM                     │
│                                                                      │
│  ┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐ │
│  │   J1: Device   │    │   J2: DATA &    │    │   J3: SYSTEM &   │ │
│  │   & Edge       │───→│   INTELLIGENCE  │───→│   INTERACTION    │ │
│  └────────────────┘    └─────────────────┘    └──────────────────┘ │
│                               ↓                                      │
│                               │                                      │
│                      ┌────────┴────────┐                             │
│                      │   PostgreSQL    │                             │
│                      │    Database     │                             │
│                      └─────────────────┘                             │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                       KAFKA MESSAGE BROKER                    │ │
│  │ ┌──────────────────┐  ┌──────────────────────────────────┐   │ │
│  │ │ j1.sensor-data   │  │ j2.engine.risk-alerts (OUTPUT)   │   │ │
│  │ │ (INPUT from J1)  │  │ (Risk predictions, probabilities)│   │ │
│  │ └──────────────────┘  └──────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────┐                    ┌───────────────────────┐   │
│  │   J4: Platform │                    │   MONITORING & UI     │   │
│  │   & Security   │                    │   (Kafka UI)          │   │
│  └────────────────┘                    └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## J2 Internal Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   J2 MICROSERVICE (FastAPI)                      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    API LAYER (FastAPI)                    │  │
│  │    Routes @ /api/v1/                                      │  │
│  │    • health                                               │  │
│  │    • intelligence                                         │  │
│  │    • engine/predict                                       │  │
│  │    • predictions/latest                                   │  │
│  │    • predictions/division/{id}                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↑                                    │
│                              │                                    │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │            SERVICE LAYER (Business Logic)               │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │  kafka_consumer.py                              │   │  │
│  │  │  ├─ Consume J1 sensor data from Kafka          │   │  │
│  │  │  ├─ Validate JSON structure                     │   │  │
│  │  │  ├─ Map device ID to division                   │   │  │
│  │  │  └─ Store in sensor_readings table              │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │  prediction_engine.py                           │   │  │
│  │  │  ├─ Load ML models (XGBoost + LightGBM)        │   │  │
│  │  │  ├─ Extract features from sensor data           │   │  │
│  │  │  ├─ Generate probability (0.0-1.0)             │   │  │
│  │  │  ├─ Map to category (NORMAL/MODERATE/SEVERE)  │   │  │
│  │  │  └─ Create DisasterPrediction records           │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │  kafka_producer.py                              │   │  │
│  │  │  ├─ Format predictions as JSON                  │   │  │
│  │  │  ├─ Publish to j2.engine.risk-alerts topic     │   │  │
│  │  │  ├─ Create RiskAlert audit records              │   │  │
│  │  │  └─ Handle delivery confirmations               │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────┴──────────────────────────────────┐ │
│  │             DATA LAYER (SQLAlchemy ORM)                   │ │
│  │                                                           │ │
│  │   Models:                                                │ │
│  │   • Division (21 rows - Sri Lankan divisions)            │ │
│  │   • IoTDevice (5 sample devices)                         │ │
│  │   • SensorReading (time-series data from J1)             │ │
│  │   • DisasterPrediction (ML outputs)                      │ │
│  │   • RiskAlert (published alerts audit trail)             │ │
│  │                                                           │ │
│  └────────────────────────┬──────────────────────────────────┘ │
│                           │                                     │
│  ┌────────────────────────┴──────────────────────────────────┐ │
│  │     PERSISTENCE LAYER (PostgreSQL Database)              │ │
│  │                                                           │ │
│  │   Five tables with foreign key relationships:            │ │
│  │   divisions → iot_devices → sensor_readings             │ │
│  │   disaster_predictions ← divisions                       │ │
│  │   risk_alerts ← disaster_predictions                     │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model Relationships

```
divisions (21 rows)
├── id (PK)
├── name
├── district
├── latitude
├── longitude
├── population
│
├──→ iot_devices (5 samples)
│    ├── id (PK) "J1_TX_01"
│    ├── device_type FLOOD|LANDSLIDE
│    ├── division_id (FK)
│    │
│    └──→ sensor_readings (time-series)
│         ├── id
│         ├── device_id (FK)
│         ├── division_id (FK)
│         ├── reading_timestamp
│         ├── sensor_type
│         ├── temperature_c
│         ├── humidity_pct
│         ├── water_depth_cm (FLOOD)
│         ├── soil_moisture (LANDSLIDE)
│         ├── accel_x/y/z (LANDSLIDE)
│         ├── gyro_x/y/z (LANDSLIDE)
│         └── raw_payload (JSON)
│
├──→ disaster_predictions (output)
│    ├── id
│    ├── division_id (FK)
│    ├── hazard_type FLOOD|LANDSLIDE|DROUGHT
│    ├── prediction_category NORMAL|MODERATE|SEVERE|EXTREME
│    ├── prediction_probability (0.0-1.0)
│    ├── flood_probability
│    ├── landslide_probability
│    ├── drought_probability
│    ├── consideration_score
│    └── prediction_timestamp
│
└──→ risk_alerts (audit trail)
     ├── id
     ├── prediction_id (FK)
     ├── division_id (FK)
     ├── hazard_type
     ├── prediction_category
     ├── prediction_probability
     ├── published (0|1)
     └── published_at
```

## Message Flow Sequence

```
┌──────────────┐                                      ┌──────────────┐
│ J1 IoT Device│                                      │ J3 Dashboard │
└────────┬─────┘                                      └────────▲─────┘
         │                                                     │
         │ JSON Message (FLOOD/LANDSLIDE data)                │
         │ {"id": "J1_TX_01", "type": "FLOOD", ...}          │
         ↓                                                     │
    ┌────────────────────────────────────────┐                │
    │  Kafka: j1.sensor-data Topic           │                │
    │  (upstream producer - not by J2)       │                │
    └────────┬─────────────────────────────────┘               │
             │                                                  │
             │ Subscribe & Consume                             │
             ↓                                                  │
    ┌────────────────────────────────────────┐                │
    │ J2 Kafka Consumer Service              │                │
    │ • Parse JSON                           │                │
    │ • Validate structure                   │                │
    │ • Map J1_TX_01 → Division 1 (Colombo)  │                │
    │ • Extract fields (temp, depth, etc.)   │                │
    └────────┬─────────────────────────────────┘               │
             │                                                  │
             │ Persist                                          │
             ↓                                                  │
    ┌────────────────────────────────────────┐                │
    │ PostgreSQL: sensor_readings Table      │                │
    │ Timestamp: 2026-05-10T14:30:00Z        │                │
    │ device_id: J1_TX_01                    │                │
    │ division_id: 1                         │                │
    │ temperature_c: 28.5                    │                │
    │ water_depth_cm: 1.24                   │                │
    └────────┬─────────────────────────────────┘               │
             │                                                  │
             │ (On Trigger: /engine/predict)                  │
             ↓                                                  │
    ┌────────────────────────────────────────┐                │
    │ J2 Prediction Engine                   │                │
    │ (Background Task)                      │                │
    │ • Query sensor_readings (last 24h)     │                │
    │ • Extract features:                    │                │
    │   - depth_mean, depth_max              │                │
    │   - temp_mean, humidity_mean           │                │
    │ • Load ML models                       │                │
    │ • Generate probability: 0.87           │                │
    │ • Map to category: SEVERE              │                │
    └────────┬─────────────────────────────────┘               │
             │                                                  │
             │ Create & Persist                                │
             ↓                                                  │
    ┌────────────────────────────────────────┐                │
    │ PostgreSQL: disaster_predictions Table │                │
    │ division_id: 1                         │                │
    │ hazard_type: FLOOD                     │                │
    │ prediction_category: SEVERE            │                │
    │ prediction_probability: 0.87           │                │
    │ consideration_score: 0.87              │                │
    │ flood_probability: 0.87                │                │
    └────────┬─────────────────────────────────┘               │
             │                                                  │
             │ Format & Publish                                │
             ↓                                                  │
    ┌────────────────────────────────────────┐                │
    │ Kafka: j2.engine.risk-alerts Topic     │                │
    │ Message:                               │                │
    │ {                                      │                │
    │   "event_type": "RISK_ALERT",         │                │
    │   "source": "j2-data-intelligence",   │                │
    │   "payload": {                         │                │
    │     "division_id": 1,                 │                │
    │     "division_name": "Colombo",       │                │
    │     "latitude": 6.9271,               │                │
    │     "longitude": 80.7744,             │                │
    │     "hazard_type": "FLOOD",           │                │
    │     "prediction_category": "SEVERE",  │                │
    │     "prediction_probability": 0.87,   │                │
    │     "timestamp": "2026-05-10T14:30Z"  │                │
    │   }                                    │                │
    │ }                                      │                │
    └────────┬─────────────────────────────────┘               │
             │                                                  │
             │ Subscribe & Consume                             │
             │ (Rendered on dashboard map)                     │
             ├─────────────────────────────────────────────────┤
             │                                                  │
             └──────────────────────────────────────────────────┘
```

## API Endpoint Response Flowchart

```
Request → /api/v1/health
   ↓
Check service running
   ↓
Return: {"status": "ok"}

Request → /api/v1/intelligence
   ↓
Check database connection
   ↓
Return: {"service": "j2-data-intelligence", "status": "ready"}

Request → POST /api/v1/engine/predict
   ↓
Add background task: run_prediction_pipeline
   ↓
Return: {"status": "triggered"}
   ↓
Background:
   Query divisions
   ↓
   For each division:
      Extract sensor features
      ↓
      Load ML models
      ↓
      Generate predictions
      ↓
      Store in database
   ↓
   Publish to Kafka
   ↓
   Complete

Request → GET /api/v1/predictions/latest
   ↓
Query latest prediction per division
   ↓
Format response JSON
   ↓
Return: {"predictions": [...], "count": N}

Request → GET /api/v1/predictions/division/{id}
   ↓
Query predictions for division
   ↓
Order by timestamp DESC
   ↓
Limit to 10 recent
   ↓
Format response JSON
   ↓
Return: {"division_id": id, "predictions": [...]}
```

## Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT LAYER                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Docker & Orchestration                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
│  │  │Dockerfile│  │docker-   │  │ docker-compose.  │ │   │
│  │  │(multi-   │  │compose.  │  │ yml              │ │   │
│  │  │stage)    │  │yml       │  │ (Orch.)          │ │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                   RUNTIME LAYER                             │
│                                                              │
│  Python 3.11
│  + FastAPI 0.111
│  + Uvicorn
│  + SQLAlchemy 2.0
│                                                              │
└──────────┬───────────────────────────────────┬──────────────┘
           │                                   │
    ┌──────┴────────┐               ┌──────────┴─────────┐
    │  DATA LAYER   │               │  MESSAGING LAYER  │
    │               │               │                   │
    │ PostgreSQL 15 │               │ Kafka + Zookeeper │
    │ (psycopg2)    │               │(confluent-kafka)  │
    │               │               │                   │
    └───────────────┘               └───────────────────┘
           │                                   │
    ┌──────┴──────────────────────────────────┴────────┐
    │                                                  │
    │         SQLAlchemy ORM Layer                    │
    │  (5 Models, relationships managed)              │
    │                                                  │
    └──────┬──────────────────────────────────────────┘
           │
    ┌──────┴─────────────────────────────────────────┐
    │                                                 │
    │      ML Module (Scikit-learn Stack)            │
    │  ┌───────────┐  ┌──────────┐  ┌────────────┐  │
    │  │ XGBoost   │  │LightGBM  │  │Soft Voting │  │
    │  │Ensemble   │  │Ensemble  │  │Integrator  │  │
    │  └───────────┘  └──────────┘  └────────────┘  │
    │                                                 │
    │  (Probability outputs: 0.0 - 1.0)             │
    │  (Categories: NORMAL|MODERATE|SEVERE|EXTREME) │
    │                                                 │
    └─────────────────────────────────────────────────┘
```

## File Organization

```
j2-data-intelligence/
│
├── app/                          ← Application code
│   ├── __init__.py
│   ├── main.py                  ← FastAPI entry point (Uvicorn)
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py          ← SQLAlchemy setup
│   │   └── models.py            ← ORM models (5 tables)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py            ← API endpoints (6 routes)
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── kafka_consumer.py    ← J1 data ingestion
│   │   ├── prediction_engine.py ← ML predictions
│   │   └── kafka_producer.py    ← Risk alert publishing
│   │
│   └── models/                  ← Pre-trained ML models
│       ├── Flood_ensemble.pkl
│       ├── Landslide_ensemble.pkl
│       └── Drought_ensemble.pkl
│
├── Dockerfile                    ← Multi-stage Docker build
├── docker-compose.yml           ← Full stack orchestration
├── requirements.txt             ← Python dependencies
├── .env.example                 ← Config template
├── seed_data.py                 ← Initialize DB (21 divisions + 5 devices)
│
├── IMPLEMENTATION_GUIDE.md      ← 200+ line technical docs
├── QUICK_START.md               ← 5-minute setup guide
├── REBUILD_SUMMARY.md           ← Change documentation
├── VALIDATION_CHECKLIST.md      ← Verification steps
└── (this file)                  ← Architecture reference
```

---

This reference guide provides visual context for understanding J2's architecture, data flow, and integration points with the broader Disaster Response System.

