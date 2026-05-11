# Full Pipeline E2E Test Guide

## Overview

This guide walks through testing the complete data flow from **synthetic raw weather data → ML model → predictions → consideration score → Kafka alert → frontend display**.

## System Architecture

```
Synthetic Data
    ↓
Forecast Features (ML input)
    ↓
Model Predictions (flood/landslide/drought probabilities)
    ↓
Consideration Score (probability × population × hazard_weight)
    ↓
Risk Alert Event (enriched with all metadata)
    ↓
Kafka j2.engine.risk-alerts topic
    ↓
Event Bridge (consumes & routes to WebSocket)
    ↓
Frontend (displays in alert list real-time)
    ↓
PostgreSQL risk_alert_events table (persisted for history)
```

## Quick Start: Run Full Pipeline Test

### 1. Prerequisites

Ensure these services are running:
```bash
# Check Kafka
docker ps | grep kafka

# Check PostgreSQL (Supabase)
psql $DATABASE_URL -c "SELECT 1"

# Check Event Bridge
ps aux | grep event-bridge.js
```

### 2. Run the E2E Test

From `j3-system-interaction/dms/`:

```bash
# Test division 1 (Colombo, population 752,993)
npm run test:pipeline

# Or test specific division
npm run test:pipeline -- 28    # Kandy (731,453 people)
npm run test:pipeline -- 5     # Galle (495,631 people)
```

### 3. Expected Output

The script will process through all steps and print:

```
========================================
🚀 FULL PIPELINE E2E TEST
========================================

📍 Test Division: Colombo (ID: 1)
👥 Population: 752,993
📅 Test Date: 2026-05-10

--- STEP 1: Generate Synthetic Weather Data ---
  ✓ Rain: 45.3 mm
  ✓ Temp: 28.5 °C
  ✓ Soil Moisture (7-28cm): 0.234

--- STEP 2: Generate ML Features ---
  ✓ Rain Lag 1d: 32.1 mm
  ✓ Rain Rolling 3d: 128.5 mm
  ✓ SPI: -0.342

--- STEP 3: Generate ML Predictions (Mock) ---
  Flood Probabilities:
    - Normal: 0.02
    - Moderate: 0.07
    - Severe: 0.35
    - Extreme: 0.56
  
  [Landslide and Drought probabilities...]

--- STEP 4: Calculate Consideration Score ---
  📊 Consideration Score: 0.2847 (0-1 scale)
  💡 Interpretation: 🟡 MEDIUM

--- STEP 5: Create Risk Alert Event ---
  ✓ Alert ID: ALT-TEST-1-1715162947123
  ✓ Severity: HIGH
  ✓ Category: FLOOD
  ✓ Crisis Probability: 91.0%
  ✓ Resource Pressure: 62.4%
  ✓ Consideration Score: 0.2847

--- STEP 6: Publish to Kafka ---
  ✓ Published to: j2.engine.risk-alerts
  ✓ Payload size: 1247 bytes

--- STEP 7: Persist to PostgreSQL ---
  ✓ Saved to risk_alert_events table

========================================
✅ PIPELINE TEST COMPLETE
========================================
```

## Understanding Consideration Score

The **Consideration Score** combines three factors:

$$\text{Consideration Score} = \text{Crisis Probability} \times \text{Population Factor} \times \text{Hazard Weights}$$

Where:
- **Crisis Probability** = P(Severe) + P(Extreme) for each hazard
- **Population Factor** = MIN(population / 1,000,000, 1.0) — normalized to 0-1
- **Hazard Weights**: Flood (0.4), Landslide (0.4), Drought (0.2)

### Example Calculation

For **Colombo** (population 752,993):

```
Flood:      P(Severe)=0.35 + P(Extreme)=0.56 = 0.91
Landslide:  P(Severe)=0.28 + P(Extreme)=0.42 = 0.70
Drought:    P(Severe)=0.12 + P(Extreme)=0.08 = 0.20

Population Factor = 752,993 / 1,000,000 = 0.753

Crisis Probability = (0.91 × 0.4) + (0.70 × 0.4) + (0.20 × 0.2)
                   = 0.364 + 0.280 + 0.040 = 0.684

Consideration Score = 0.684 × 0.753 = 0.515

Result: 🟡 MEDIUM (0.515 is between 0.4 and 0.7)
```

## Verification Steps

### ✅ Step 1: Check Kafka Message

```bash
# Terminal 1: Watch Kafka topic
docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning

# You should see the published alert within 2 seconds
```

### ✅ Step 2: Check Frontend Alert Display

1. Open http://localhost:3000/public-alerts
2. You should see a new alert appear in real-time with:
   - ✓ Title (e.g., "HIGH FLOOD Watch for Colombo")
   - ✓ Severity badge (HIGH, CRITICAL, etc.)
   - ✓ Prediction Probability (91%)
   - ✓ Consideration Score (51.5%)
   - ✓ Resource Pressure (62.4%)

### ✅ Step 3: Check Database Persistence

```bash
# Query the risk_alert_events table
psql $DATABASE_URL << EOF
SELECT 
  alert_id,
  division_name,
  prediction_probability,
  consideration_score,
  severity,
  created_at
FROM risk_alert_events
WHERE division_id = 1
ORDER BY created_at DESC
LIMIT 5;
EOF
```

### ✅ Step 4: Verify Event Bridge Routing

```bash
# Check bridge logs for Kafka consume + WebSocket emit
tail -f j3-system-interaction/dms/bridge.log | grep -E "Routing|risk-alert"
```

You should see:
```
📡 [Kafka -> UI] Routing j2.engine.risk-alerts to frontend!
```

## Troubleshooting

### Alert doesn't appear on frontend

1. **Is Kafka running?**
   ```bash
   docker exec disaster-kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
   ```

2. **Is Event Bridge connected to Kafka?**
   ```bash
   ps aux | grep event-bridge
   # Should see: node event-bridge.js
   ```

3. **Check WebSocket connection in browser:**
   - Open DevTools → Network → WS
   - Connect to http://localhost:3001
   - You should see a socket.io WebSocket connection

4. **Check permissions:**
   - Your user needs `issue:alerts` permission or role must be INCIDENT_COMMANDER_*

### Consideration Score is 0 or very low

1. **Check population data:**
   ```sql
   SELECT division_id, division_name, division_population 
   FROM "Division" WHERE division_id = 1;
   ```

2. **Verify formula:**
   - Low population = low score (by design)
   - High probability + small population = still medium score
   - This is intentional: we prioritize heavily-populated areas at risk

### Synthetic data generation fails

```bash
# Ensure DATABASE_URL is set
echo $DATABASE_URL

# If empty:
export DATABASE_URL="postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres"

npm run test:pipeline
```

## Advanced: Run for Multiple Divisions

```bash
# Test all divisions in sequence
for div in 1 5 28; do
  echo "Testing Division $div..."
  npm run test:pipeline -- $div
  sleep 2
done
```

## Advanced: Custom Probability Values

Edit `test-full-pipeline.js` to hardcode specific probabilities:

```javascript
// Change generateMockPredictions() to:
function generateMockPredictions(category) {
  if (category === 'FLOOD') {
    return {
      prob_normal: 0.02,
      prob_moderate: 0.07,
      prob_severe: 0.35,
      prob_extreme: 0.56,
    };
  }
  // ...
}
```

Then run: `npm run test:pipeline -- 1`

## Dashboard Alert Display

When the alert is received by the frontend, it displays in this format:

```
┌─────────────────────────────────────────────────────┐
│ 🚨 HIGH FLOOD Watch for Colombo                    │
├─────────────────────────────────────────────────────┤
│ Prediction: 91%  | Consideration: 51.5%  | Resources: 62.4% │
│                                                     │
│ Risk alert for Colombo with 91% probability       │
│                                                     │
│ [FLOOD] [PROBABILITY 0.91] [SCORE 0.515]          │
│ Source: Synthetic Test Producer                    │
│ Status: PUBLICLY VISIBLE                           │
└─────────────────────────────────────────────────────┘
```

## Related Files

- **Test Script**: [scripts/test-full-pipeline.js](./scripts/test-full-pipeline.js)
- **Event Bridge**: [event-bridge.js](./event-bridge.js)
- **Backend Alert Endpoint**: [app/api/alerts/route.ts](./app/api/alerts/route.ts)
- **Frontend Alerts Page**: [app/dashboard/alerts/page.tsx](./app/dashboard/alerts/page.tsx)
- **Risk Alert Normalizer**: [lib/risk-alert.ts](./lib/risk-alert.ts)
- **Consideration Score Docs**: [../../../DATA_AND_INTELLIGENCE_APPROACH.md](../../../DATA_AND_INTELLIGENCE_APPROACH.md#consideration-score)
- **SQL Schema**: [prisma/create_disaster_predictions.sql](./prisma/create_disaster_predictions.sql)

## Performance Notes

- **Kafka publish latency**: ~5-10ms
- **WebSocket delivery**: ~50-200ms (browser dependent)
- **Total alert-to-frontend**: ~100-250ms
- **Database insert**: ~50ms (async, doesn't block Kafka)

## Next Steps

1. Run this test with real J2 model predictions (not mocks)
2. Add consideration score thresholds to alert routing logic
3. Create scheduled job to run predictions daily
4. Set up alerting if consideration score exceeds 0.7
