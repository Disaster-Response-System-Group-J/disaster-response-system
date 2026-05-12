const { Kafka } = require('kafkajs');
const { spawnSync } = require('child_process');

const brokerCandidates = (process.env.KAFKA_BROKER || 'localhost:29092,localhost:9092')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const topic = process.env.KAFKA_TOPIC || 'j2.engine.risk-alerts';

const kafka = new Kafka({
  clientId: 'dms-synthetic-alert',
  brokers: brokerCandidates,
});

const producer = kafka.producer();

async function main() {
  const payload = {
    eventId: `synthetic-${Date.now()}`,
    eventType: 'risk-alert',
    timestamp: new Date().toISOString(),
    payload: {
      alertId: `ALT-SYN-${Date.now()}`,
      type: 'RISK_ALERT',
      severity: 'HIGH',
      title: 'Synthetic Flood Watch for Colombo',
      description: 'Synthetic risk alert sent to verify the UI notification path.',
      district: 'Colombo',
      divisionId: 1,
      divisionName: 'Colombo',
      forecastDate: new Date().toISOString().slice(0, 10),
      predictionKind: 'probabilistic',
      predictionCategory: 'FLOOD',
      predictionProbability: 0.91,
      topProbabilityKey: 'SEVERE',
      probabilities: {
        NORMAL: 0.02,
        MODERATE: 0.07,
        SEVERE: 0.78,
        EXTREME: 0.13,
      },
      considerationScore: 0.84,
      resourcePressure: 0.65,
      hazardType: 'FLOOD',
      featureDate: new Date().toISOString().slice(0, 10),
      source: 'Synthetic Test Producer',
      isActive: true,
      isPublic: false,
    },
  };

  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: [{ key: '1', value: JSON.stringify(payload) }],
    });
    await producer.disconnect();

    console.log(`Sent synthetic alert to ${topic} via ${brokerCandidates.join(', ')}`);
    return;
  } catch (error) {
    try {
      await producer.disconnect();
    } catch (_) {
      // ignore disconnect failures before fallback
    }

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
      const stderr = dockerResult.stderr || '';
      throw new Error(
        `KafkaJS publish failed and docker fallback failed. KafkaJS error: ${error.message}. Docker stderr: ${stderr}`
      );
    }

    console.log(`Sent synthetic alert to ${topic} via docker exec fallback`);
  }
}

main().catch(async (error) => {
  console.error('Failed to send synthetic alert:', error);
  try {
    await producer.disconnect();
  } catch (_) {
    // ignore disconnect failures on exit
  }
  process.exit(1);
});