const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'j1-j2-mock-systems',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer = kafka.producer();

const SRI_LANKA_LOCATIONS = [
  { district: "Colombo", lat: 6.9271, lng: 79.8612 },
  { district: "Galle", lat: 6.0367, lng: 80.2170 },
  { district: "Kandy", lat: 7.2906, lng: 80.6337 },
  { district: "Matara", lat: 5.9549, lng: 80.5469 },
  { district: "Ratnapura", lat: 6.7056, lng: 80.3847 },
  { district: "Kegalle", lat: 7.2513, lng: 80.3464 }
];

function getRandomLocation() {
  const loc = SRI_LANKA_LOCATIONS[Math.floor(Math.random() * SRI_LANKA_LOCATIONS.length)];
  const jitterLat = (Math.random() - 0.5) * 0.1;
  const jitterLng = (Math.random() - 0.5) * 0.1;
  return { district: loc.district, latitude: loc.lat + jitterLat, longitude: loc.lng + jitterLng };
}

// Simulated J1: Mobile SOS Reports
async function sendSOSReport() {
  const loc = getRandomLocation();
  const report = {
    reportId: `REP-${Math.floor(Math.random() * 10000)}`,
    source: "J1_SOS_APP",
    disasterType: ["FLOOD", "LANDSLIDE", "MEDICAL"][Math.floor(Math.random() * 3)],
    district: loc.district, 
    latitude: loc.latitude, 
    longitude: loc.longitude,
    verificationStatus: "PENDING_REVIEW",
    description: "Automated mock SOS report.",
    createdAt: new Date().toISOString()
  };
  await producer.send({ topic: 'j1.sos.raw-reports', messages: [{ value: JSON.stringify(report) }] });
  console.log(`🔥 [Kafka] Published SOS Report: ${report.reportId}`);
}

// Simulated J2: Risk Alerts
async function sendRiskAlert() {
  const alert = {
    alertId: `ALT-${Math.floor(Math.random() * 10000)}`,
    type: "RISK_ALERT",
    severity: ["HIGH", "CRITICAL", "MEDIUM"][Math.floor(Math.random() * 3)],
    title: "System Warning",
    district: SRI_LANKA_LOCATIONS[Math.floor(Math.random() * SRI_LANKA_LOCATIONS.length)].district,
    isActive: true, 
    createdAt: new Date().toISOString()
  };
  await producer.send({ topic: 'j2.engine.risk-alerts', messages: [{ value: JSON.stringify(alert) }] });
  console.log(`⚠️ [Kafka] Published Risk Alert: ${alert.alertId}`);
}

// Simulated J1: Hardware Sensors (NEW)
async function sendSensorTelemetry() {
  const mockSensorIds = ['SNS-KEL-001', 'SNS-KAL-014', 'SNS-ATT-005', 'SNS-GIN-021'];
  const telemetryData = {
    id: mockSensorIds[Math.floor(Math.random() * mockSensorIds.length)],
    battery: Math.floor(Math.random() * 100), 
    status: Math.random() > 0.8 ? 'OFFLINE' : 'ONLINE', 
    latestValue: `${(Math.random() * 10).toFixed(1)} m`, // e.g., Water level in meters
    lastSeenMinutes: 0
  };

  await producer.send({ topic: 'j1.sensor.telemetry', messages: [{ value: JSON.stringify(telemetryData) }] });
  console.log(`📟 [Kafka] Published Sensor Data: ${telemetryData.id}`);
}

async function runMockSystems() {
  await producer.connect();
  console.log('🚀 Mock Systems connected to real Kafka. Firing initial data...');

  // Fire immediately
  await sendSOSReport();
  await sendRiskAlert();
  await sendSensorTelemetry();

  // Continue firing
  setInterval(sendSOSReport, 10000);
  setInterval(sendRiskAlert, 15000);
  setInterval(sendSensorTelemetry, 5000); // Sensors fire much faster!
}

runMockSystems().catch(console.error);