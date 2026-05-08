const { Kafka } = require('kafkajs');
const { spawnSync } = require('child_process');

const brokerCandidates = (process.env.KAFKA_BROKER || 'localhost:29092,localhost:9092')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const topic = process.env.KAFKA_TOPIC || 'j2.engine.risk-alerts';

const kafka = new Kafka({
  clientId: 'dms-demo-alert-stream',
  brokers: brokerCandidates,
});

const producer = kafka.producer();

// Demo alert scenarios from J2 Risk Engine
const demoAlerts = [
  {
    name: 'FLOOD WARNING - HIGH CONFIDENCE',
    payload: {
      alertId: `ALT-DEMO-FLOOD-${Date.now()}`,
      type: 'RISK_ALERT',
      severity: 'CRITICAL',
      title: 'Level 3 Flood Warning — Kelani River Basin',
      description: 'Kelani River water levels exceeding danger mark. Colombo & Gampaha districts under evacuation orders.',
      district: 'Colombo',
      divisionId: 1,
      divisionName: 'Colombo',
      forecastDate: new Date().toISOString().slice(0, 10),
      predictionKind: 'probabilistic',
      predictionCategory: 'FLOOD',
      predictionProbability: 0.87,
      topProbabilityKey: 'SEVERE',
      probabilities: { NORMAL: 0.02, MODERATE: 0.07, SEVERE: 0.78, EXTREME: 0.13 },
      considerationScore: 0.92,
      resourcePressure: 0.78,
      hazardType: 'FLOOD',
      featureDate: new Date().toISOString().slice(0, 10),
      source: 'J2 Risk Engine',
      isActive: true,
      isPublic: true,
    },
  },
  {
    name: 'LANDSLIDE WARNING - MODERATE',
    payload: {
      alertId: `ALT-DEMO-LANDSLIDE-${Date.now() + 1000}`,
      type: 'RISK_ALERT',
      severity: 'HIGH',
      title: 'Landslide Warning — Central Highlands',
      description: 'Heavy rainfall triggering landslide risk in Nuwara Eliya, Kandy, and Kegalle districts.',
      district: 'Nuwara Eliya',
      divisionId: 3,
      divisionName: 'Nuwara Eliya',
      forecastDate: new Date().toISOString().slice(0, 10),
      predictionKind: 'probabilistic',
      predictionCategory: 'LANDSLIDE',
      predictionProbability: 0.73,
      topProbabilityKey: 'MODERATE',
      probabilities: { NORMAL: 0.12, MODERATE: 0.64, SEVERE: 0.20, EXTREME: 0.04 },
      considerationScore: 0.81,
      resourcePressure: 0.42,
      hazardType: 'LANDSLIDE',
      featureDate: new Date().toISOString().slice(0, 10),
      source: 'J2 Risk Engine',
      isActive: true,
      isPublic: true,
    },
  },
  {
    name: 'EVACUATION ORDER - URGENT',
    payload: {
      alertId: `ALT-DEMO-EVACUATION-${Date.now() + 2000}`,
      type: 'RISK_ALERT',
      severity: 'CRITICAL',
      title: 'Evacuation Order — Kaduwela Division',
      description: 'All residents in Kaduwela low-lying areas must evacuate immediately. Report to nearest shelter.',
      district: 'Colombo',
      divisionId: 1,
      divisionName: 'Colombo',
      forecastDate: new Date().toISOString().slice(0, 10),
      predictionKind: 'probabilistic',
      predictionCategory: 'FLOOD',
      predictionProbability: 0.91,
      topProbabilityKey: 'SEVERE',
      probabilities: { NORMAL: 0.02, MODERATE: 0.07, SEVERE: 0.78, EXTREME: 0.13 },
      considerationScore: 0.84,
      resourcePressure: 0.65,
      hazardType: 'FLOOD',
      featureDate: new Date().toISOString().slice(0, 10),
      source: 'J2 Risk Engine',
      isActive: true,
      isPublic: true,
    },
  },
  {
    name: 'HEAVY RAINFALL - SOUTHWEST MONSOON',
    payload: {
      alertId: `ALT-DEMO-RAINFALL-${Date.now() + 3000}`,
      type: 'RISK_ALERT',
      severity: 'HIGH',
      title: 'Heavy Rainfall Expected — SW Monsoon',
      description: '150mm rainfall expected in next 24h across Western & Sabaragamuwa provinces.',
      district: 'Ratnapura',
      divisionId: 7,
      divisionName: 'Ratnapura',
      forecastDate: new Date().toISOString().slice(0, 10),
      predictionKind: 'probabilistic',
      predictionCategory: 'FLOOD',
      predictionProbability: 0.68,
      topProbabilityKey: 'SEVERE',
      probabilities: { NORMAL: 0.05, MODERATE: 0.27, SEVERE: 0.56, EXTREME: 0.12 },
      considerationScore: 0.76,
      resourcePressure: 0.71,
      hazardType: 'FLOOD',
      featureDate: new Date().toISOString().slice(0, 10),
      source: 'J2 Risk Engine - Meteorological Integration',
      isActive: true,
      isPublic: true,
    },
  },
];

async function sendAlert(alert, delayMs) {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const payload = {
        eventId: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'risk-alert',
        timestamp: new Date().toISOString(),
        payload: alert.payload,
      };

      try {
        await producer.connect();
        await producer.send({
          topic,
          messages: [{ key: '1', value: JSON.stringify(payload) }],
        });
        await producer.disconnect();

        console.log(`✅ [${new Date().toLocaleTimeString()}] ${alert.name}`);
        console.log(`   Alert ID: ${alert.payload.alertId}`);
        console.log(`   District: ${alert.payload.district}`);
        console.log(`   Prediction: ${(alert.payload.predictionProbability * 100).toFixed(0)}% | Consideration: ${(alert.payload.considerationScore * 100).toFixed(0)}% | Resource: ${(alert.payload.resourcePressure * 100).toFixed(0)}%`);
        console.log('');
        resolve();
      } catch (error) {
        try {
          await producer.disconnect();
        } catch (_) {}

        const dockerResult = spawnSync(
          'docker',
          [
            'exec',
            '-i',
            'disaster-kafka',
            '/opt/kafka/bin/kafka-console-producer.sh',
            '--bootstrap-server',
            'kafka:29092',
            '--topic',
            topic,
          ],
          {
            input: JSON.stringify(payload),
            encoding: 'utf8',
          }
        );

        if (dockerResult.status !== 0) {
          console.error(`❌ ${alert.name} - Failed to send`);
          resolve();
        } else {
          console.log(`✅ [${new Date().toLocaleTimeString()}] ${alert.name} (via Docker)`);
          console.log(`   Alert ID: ${alert.payload.alertId}`);
          console.log('');
          resolve();
        }
      }
    }, delayMs);
  });
}

async function runDemo() {
  console.log('🚀 LIVE ALERT STREAM DEMO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📡 Kafka Brokers: ${brokerCandidates.join(', ')}`);
  console.log(`📬 Topic: ${topic}`);
  console.log('');
  console.log('🎬 Starting alert stream in 2 seconds...');
  console.log('   Watch http://localhost:3000/public-alerts for real-time updates');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Send alerts with staggered timing (every 3 seconds)
  for (let i = 0; i < demoAlerts.length; i++) {
    await sendAlert(demoAlerts[i], 2000 + i * 3000);
  }

  console.log('✅ All alerts sent!');
  console.log('');
  console.log('🔍 Frontend Updates:');
  console.log('   ✓ Socket listeners in event-bridge.js route j2.engine.risk-alerts to dashboard:risk-alert');
  console.log('   ✓ public-alerts/page.tsx normalizes & displays alerts in real-time');
  console.log('   ✓ Each alert shows: Prediction % | Consideration % | Resource Pressure %');
  console.log('   ✓ Resource breakdown by type (shelter, water, medical, transport)');
  console.log('   ✓ Probability distribution chart (NORMAL, MODERATE, SEVERE, EXTREME)');
  console.log('');
}

runDemo().catch(async (error) => {
  console.error('❌ Demo failed:', error.message);
  try {
    await producer.disconnect();
  } catch (_) {}
  process.exit(1);
});
