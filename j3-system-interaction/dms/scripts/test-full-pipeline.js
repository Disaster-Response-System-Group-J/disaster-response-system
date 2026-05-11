#!/usr/bin/env node

/**
 * Complete End-to-End Pipeline Test
 * 
 * This script tests the full flow:
 * 1. Generate synthetic raw weather data for a division
 * 2. Create forecast features
 * 3. Generate mock ML predictions (or call real model)
 * 4. Calculate consideration score (probability × population × hazard_weighting)
 * 5. Create risk alert event with all required fields
 * 6. Publish to Kafka j2.engine.risk-alerts topic
 * 7. Display pipeline status
 * 
 * Usage:
 *   node scripts/test-full-pipeline.js [divisionId]
 *   node scripts/test-full-pipeline.js 1          # Test Colombo division
 *   node scripts/test-full-pipeline.js 28         # Test Kandy division
 */

const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

// Kafka configuration
const brokerCandidates = (process.env.KAFKA_BROKER || 'localhost:29092,localhost:9092')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

// PostgreSQL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres'
});

// ====================================================================
// DIVISION & POPULATION DATA (from your CSV)
// ====================================================================
const DIVISIONS = {
  1: { name: 'Colombo', population: 752993 },
  2: { name: 'Colombo2', population: 450000 },
  28: { name: 'Kandy', population: 731453 },
  5: { name: 'Galle', population: 495631 },
};

// ====================================================================
// CONSIDERATION SCORE CALCULATION
// Formula: (crisis_probability × population_factor × hazard_weight)
// ====================================================================
function calculateConsiderationScore(floodProb, landslideProb, droughtProb, population) {
  // Crisis probability = P(Severe) + P(Extreme)
  const floodCrisisProb = floodProb.prob_severe + floodProb.prob_extreme;
  const landslideCrisisProb = landslideProb.prob_severe + landslideProb.prob_extreme;
  const droughtCrisisProb = droughtProb.prob_severe + droughtProb.prob_extreme;

  // Normalize population to 0-1 range
  const populationFactor = Math.min(population / 1000000, 1); // Max 1M people = factor 1

  // Hazard weights (flood & landslide = higher weight)
  const FLOOD_WEIGHT = 0.4;
  const LANDSLIDE_WEIGHT = 0.4;
  const DROUGHT_WEIGHT = 0.2;

  // Raw score
  const rawScore =
    floodCrisisProb * FLOOD_WEIGHT +
    landslideCrisisProb * LANDSLIDE_WEIGHT +
    droughtCrisisProb * DROUGHT_WEIGHT;

  // Final consideration score = raw score × population factor
  return Math.min(rawScore * populationFactor, 1.0);
}

// ====================================================================
// SYNTHETIC DATA GENERATION
// ====================================================================
function generateSyntheticWeatherData(divisionId, date) {
  return {
    division_id: divisionId,
    date: date,
    rain_sum: Math.random() * 100, // 0-100mm
    temperature: 20 + Math.random() * 15, // 20-35°C
    moisture_7_28cm: Math.random() * 0.5,
    moisture_28_100cm: Math.random() * 0.4,
    moisture_100_255cm: Math.random() * 0.3,
  };
}

function generateSyntheticFeatures(divisionId, date) {
  const monthNum = new Date(date).getMonth();
  return {
    division_id: divisionId,
    date: date,
    rain_lag_1: Math.random() * 100,
    rain_rolling_3d: Math.random() * 200,
    rain_rolling_7d: Math.random() * 300,
    month_sin: Math.sin((2 * Math.PI * monthNum) / 12),
    month_cos: Math.cos((2 * Math.PI * monthNum) / 12),
    spi: Math.random() * 2 - 1, // -1 to 1
    division_encoded: divisionId,
  };
}

function generateMockPredictions() {
  // Mock ML model output: 4-class probabilities that sum to 1
  const rand = () => Math.random();
  const probs = [rand(), rand(), rand(), rand()];
  const sum = probs.reduce((a, b) => a + b, 0);
  const normalized = probs.map(p => p / sum);

  return {
    prob_normal: normalized[0],
    prob_moderate: normalized[1],
    prob_severe: normalized[2],
    prob_extreme: normalized[3],
    predicted_severity: normalized.indexOf(Math.max(...normalized)),
  };
}

// ====================================================================
// MAIN TEST FLOW
// ====================================================================
async function testFullPipeline() {
  console.log('\n========================================');
  console.log('🚀 FULL PIPELINE E2E TEST');
  console.log('========================================\n');

  try {
    // 1. SELECT DIVISION
    const divisionId = parseInt(process.argv[2]) || 1; // Default: Colombo
    const testDate = new Date().toISOString().split('T')[0];

    if (!DIVISIONS[divisionId]) {
      console.error(`❌ Division ${divisionId} not found. Available: ${Object.keys(DIVISIONS).join(', ')}`);
      process.exit(1);
    }

    const division = DIVISIONS[divisionId];
    console.log(`📍 Test Division: ${division.name} (ID: ${divisionId})`);
    console.log(`👥 Population: ${division.population.toLocaleString()}`);
    console.log(`📅 Test Date: ${testDate}\n`);

    // 2. GENERATE SYNTHETIC DATA
    console.log('--- STEP 1: Generate Synthetic Weather Data ---');
    const weatherData = generateSyntheticWeatherData(divisionId, testDate);
    console.log('  ✓ Rain:', weatherData.rain_sum.toFixed(1), 'mm');
    console.log('  ✓ Temp:', weatherData.temperature.toFixed(1), '°C');
    console.log('  ✓ Soil Moisture (7-28cm):', weatherData.moisture_7_28cm.toFixed(3));

    // 3. GENERATE FEATURES
    console.log('\n--- STEP 2: Generate ML Features ---');
    const featureData = generateSyntheticFeatures(divisionId, testDate);
    console.log('  ✓ Rain Lag 1d:', featureData.rain_lag_1.toFixed(1), 'mm');
    console.log('  ✓ Rain Rolling 3d:', featureData.rain_rolling_3d.toFixed(1), 'mm');
    console.log('  ✓ SPI:', featureData.spi.toFixed(3));

    // 4. GENERATE MOCK PREDICTIONS (each hazard type)
    console.log('\n--- STEP 3: Generate ML Predictions (Mock) ---');
    const floodPred = generateMockPredictions();
    const landslidePred = generateMockPredictions();
    const droughtPred = generateMockPredictions();

    console.log('  Flood Probabilities:');
    console.log(`    - Normal: ${floodPred.prob_normal.toFixed(2)}`);
    console.log(`    - Moderate: ${floodPred.prob_moderate.toFixed(2)}`);
    console.log(`    - Severe: ${floodPred.prob_severe.toFixed(2)}`);
    console.log(`    - Extreme: ${floodPred.prob_extreme.toFixed(2)}`);

    console.log('  Landslide Probabilities:');
    console.log(`    - Normal: ${landslidePred.prob_normal.toFixed(2)}`);
    console.log(`    - Moderate: ${landslidePred.prob_moderate.toFixed(2)}`);
    console.log(`    - Severe: ${landslidePred.prob_severe.toFixed(2)}`);
    console.log(`    - Extreme: ${landslidePred.prob_extreme.toFixed(2)}`);

    console.log('  Drought Probabilities:');
    console.log(`    - Normal: ${droughtPred.prob_normal.toFixed(2)}`);
    console.log(`    - Moderate: ${droughtPred.prob_moderate.toFixed(2)}`);
    console.log(`    - Severe: ${droughtPred.prob_severe.toFixed(2)}`);
    console.log(`    - Extreme: ${droughtPred.prob_extreme.toFixed(2)}`);

    // 5. CALCULATE CONSIDERATION SCORE
    console.log('\n--- STEP 4: Calculate Consideration Score ---');
    const considerationScore = calculateConsiderationScore(
      floodPred,
      landslidePred,
      droughtPred,
      division.population
    );
    console.log(`  📊 Consideration Score: ${considerationScore.toFixed(4)} (0-1 scale)`);
    console.log(`  💡 Interpretation: ${considerationScore > 0.7 ? '🔴 HIGH PRIORITY' : considerationScore > 0.4 ? '🟡 MEDIUM' : '🟢 LOW'}`);

    // 6. DETERMINE ALERT SEVERITY & CATEGORY
    const floodCrisisProb = floodPred.prob_severe + floodPred.prob_extreme;
    const landslideCrisisProb = landslidePred.prob_severe + landslidePred.prob_extreme;
    const droughtCrisisProb = droughtPred.prob_severe + droughtPred.prob_extreme;

    const maxCrisisProb = Math.max(floodCrisisProb, landslideCrisisProb, droughtCrisisProb);
    let alertCategory, alertSeverity;

    if (floodCrisisProb === maxCrisisProb) {
      alertCategory = 'FLOOD';
      alertSeverity = maxCrisisProb > 0.7 ? 'CRITICAL' : maxCrisisProb > 0.4 ? 'HIGH' : 'MEDIUM';
    } else if (landslideCrisisProb === maxCrisisProb) {
      alertCategory = 'LANDSLIDE';
      alertSeverity = maxCrisisProb > 0.7 ? 'CRITICAL' : maxCrisisProb > 0.4 ? 'HIGH' : 'MEDIUM';
    } else {
      alertCategory = 'DROUGHT';
      alertSeverity = maxCrisisProb > 0.7 ? 'HIGH' : maxCrisisProb > 0.4 ? 'MEDIUM' : 'LOW';
    }

    // 7. CREATE ALERT PAYLOAD (Kafka event)
    console.log('\n--- STEP 5: Create Risk Alert Event ---');
    const alertId = `ALT-TEST-${divisionId}-${Date.now()}`;
    const resourcePressure = Math.random() * 0.8; // Mock resource availability

    const riskAlertPayload = {
      eventId: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'risk-alert',
      timestamp: new Date().toISOString(),
      payload: {
        alertId: alertId,
        type: 'RISK_ALERT',
        severity: alertSeverity,
        title: `${alertSeverity} ${alertCategory} Watch for ${division.name}`,
        description: `Risk alert for ${division.name} with ${(maxCrisisProb * 100).toFixed(0)}% probability`,
        district: division.name,
        divisionId: divisionId,
        divisionName: division.name,
        forecastDate: testDate,
        predictionKind: 'probabilistic',
        predictionCategory: alertCategory,
        predictionProbability: maxCrisisProb,
        topProbabilityKey: maxCrisisProb === floodPred.prob_extreme || maxCrisisProb === landslidePred.prob_extreme || maxCrisisProb === droughtPred.prob_extreme ? 'EXTREME' : 'SEVERE',
        probabilities: {
          NORMAL: alertCategory === 'FLOOD' ? floodPred.prob_normal : alertCategory === 'LANDSLIDE' ? landslidePred.prob_normal : droughtPred.prob_normal,
          MODERATE: alertCategory === 'FLOOD' ? floodPred.prob_moderate : alertCategory === 'LANDSLIDE' ? landslidePred.prob_moderate : droughtPred.prob_moderate,
          SEVERE: alertCategory === 'FLOOD' ? floodPred.prob_severe : alertCategory === 'LANDSLIDE' ? landslidePred.prob_severe : droughtPred.prob_severe,
          EXTREME: alertCategory === 'FLOOD' ? floodPred.prob_extreme : alertCategory === 'LANDSLIDE' ? landslidePred.prob_extreme : droughtPred.prob_extreme,
        },
        considerationScore: considerationScore,
        resourcePressure: resourcePressure,
        source: 'Synthetic Test Producer',
        isActive: true,
        isPublic: true,
      },
    };

    console.log(`  ✓ Alert ID: ${alertId}`);
    console.log(`  ✓ Severity: ${alertSeverity}`);
    console.log(`  ✓ Category: ${alertCategory}`);
    console.log(`  ✓ Crisis Probability: ${(maxCrisisProb * 100).toFixed(1)}%`);
    console.log(`  ✓ Resource Pressure: ${(resourcePressure * 100).toFixed(1)}%`);
    console.log(`  ✓ Consideration Score: ${considerationScore.toFixed(4)}`);

    // 8. PUBLISH TO KAFKA
    console.log('\n--- STEP 6: Publish to Kafka ---');
    const kafka = new Kafka({
      clientId: 'test-full-pipeline',
      brokers: brokerCandidates,
    });

    const producer = kafka.producer();
    await producer.connect();

    await producer.send({
      topic: 'j2.engine.risk-alerts',
      messages: [
        {
          key: `div-${divisionId}`,
          value: JSON.stringify(riskAlertPayload),
        },
      ],
    });

    console.log(`  ✓ Published to: j2.engine.risk-alerts`);
    console.log(`  ✓ Payload size: ${JSON.stringify(riskAlertPayload).length} bytes`);
    await producer.disconnect();

    // 9. SAVE TO POSTGRES (for persistence & history)
    console.log('\n--- STEP 7: Persist to PostgreSQL ---');
    try {
      const result = await pool.query(
        `INSERT INTO risk_alert_events (
          event_id, event_type, event_timestamp, alert_id, alert_type, severity, title, description,
          district, division_id, division_name, forecast_date, prediction_kind, prediction_category,
          prediction_probability, top_probability_key, probabilities, consideration_score, resource_pressure,
          hazard_type, source, is_active, is_public, raw_message
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        ) ON CONFLICT (alert_id, event_timestamp) DO NOTHING`,
        [
          riskAlertPayload.eventId,
          riskAlertPayload.eventType,
          riskAlertPayload.timestamp,
          riskAlertPayload.payload.alertId,
          riskAlertPayload.payload.type,
          riskAlertPayload.payload.severity,
          riskAlertPayload.payload.title,
          riskAlertPayload.payload.description,
          riskAlertPayload.payload.district,
          riskAlertPayload.payload.divisionId,
          riskAlertPayload.payload.divisionName,
          riskAlertPayload.payload.forecastDate,
          riskAlertPayload.payload.predictionKind,
          riskAlertPayload.payload.predictionCategory,
          riskAlertPayload.payload.predictionProbability,
          riskAlertPayload.payload.topProbabilityKey,
          JSON.stringify(riskAlertPayload.payload.probabilities),
          riskAlertPayload.payload.considerationScore,
          riskAlertPayload.payload.resourcePressure,
          alertCategory,
          riskAlertPayload.payload.source,
          riskAlertPayload.payload.isActive,
          riskAlertPayload.payload.isPublic,
          JSON.stringify(riskAlertPayload),
        ]
      );
      console.log(`  ✓ Saved to risk_alert_events table`);
    } catch (dbErr) {
      console.log(`  ⚠️  Database persist skipped (offline): ${dbErr.message}`);
    }

    // 10. SUMMARY
    console.log('\n========================================');
    console.log('✅ PIPELINE TEST COMPLETE');
    console.log('========================================\n');

    console.log('📡 ALERT SUMMARY:');
    console.log(`  ID: ${alertId}`);
    console.log(`  Division: ${division.name} (${division.population.toLocaleString()} people)`);
    console.log(`  Category: ${alertCategory} with ${(maxCrisisProb * 100).toFixed(1)}%`);
    console.log(`  Severity: ${alertSeverity}`);
    console.log(`  Consideration Score: ${considerationScore.toFixed(4)} (normalized by population)`);
    console.log(`  Resource Pressure: ${(resourcePressure * 100).toFixed(1)}%`);

    console.log('\n🔄 NEXT STEPS TO VERIFY FRONTEND:');
    console.log('  1. Open http://localhost:3000/public-alerts in your browser');
    console.log('  2. You should see a new alert appear within 2 seconds');
    console.log('  3. Alert will show:');
    console.log(`     - Title: "${riskAlertPayload.payload.title}"`);
    console.log(`     - Prediction Probability: ${(maxCrisisProb * 100).toFixed(0)}%`);
    console.log(`     - Consideration Score: ${(considerationScore * 100).toFixed(1)}%`);
    console.log(`     - Resource Pressure: ${(resourcePressure * 100).toFixed(1)}%`);

    console.log('\n🔧 DEBUG COMMANDS:');
    console.log('  # View Kafka message:');
    console.log('  docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \\');
    console.log('    --bootstrap-server kafka:29092 \\');
    console.log('    --topic j2.engine.risk-alerts \\');
    console.log('    --from-beginning | tail -1 | jq');

    console.log('\n  # Query persisted alerts from DB:');
    console.log('  SELECT alert_id, severity, prediction_probability, consideration_score');
    console.log('  FROM risk_alert_events');
    console.log(`  WHERE division_id = ${divisionId}`);
    console.log('  ORDER BY created_at DESC LIMIT 5;');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testFullPipeline();
