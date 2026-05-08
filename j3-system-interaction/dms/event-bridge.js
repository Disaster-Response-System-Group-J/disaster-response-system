const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');

// 1. Initialize Socket.IO Server
const io = new Server(3001, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// 2. Initialize Kafka Client 
const kafka = new Kafka({
  clientId: 'j3-event-bridge',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'j3-dashboard-group' });
const producer = kafka.producer();
const admin = kafka.admin(); // <-- NEW: Admin client to manage topics

async function startBridge() {
  const topics = [
    'j1.sos.raw-reports',
    'j1.sensor.telemetry',
    'j2.engine.risk-alerts',
    'j2.engine.incidents',
    'j3.dashboard.report-updates',
    'j3.dashboard.resource-updates'
  ];

  // 3. Guarantee all topics exist before doing anything else!
  await admin.connect();
  await admin.createTopics({
    topics: topics.map(t => ({ topic: t, numPartitions: 1 }))
  });
  console.log("📂 Verified all required Kafka topics exist.");
  await admin.disconnect();

  // 4. Connect Bridge
  await producer.connect();
  await consumer.connect();
  console.log("✅ Event Bridge Online. Connected to Kafka (9092) & Next.js (3001)");

  // 5. Subscribe
  for (const t of topics) {
    await consumer.subscribe({ topic: t, fromBeginning: true });
  }

  // 6. Listen to Kafka and push to WebSockets
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      console.log(`📡 [Kafka -> UI] Routing ${topic} to frontend!`);
      
      if (topic === 'j1.sos.raw-reports') io.emit('dashboard:new-report', data);
      if (topic === 'j1.sensor.telemetry') io.emit('sensor:telemetry-update', data);
      if (topic === 'j2.engine.risk-alerts') io.emit('dashboard:risk-alert', data);
      if (topic === 'j2.engine.incidents') io.emit('dashboard:new-incident', data);
      
    },
  });

  // 7. Listen to UI Actions
  io.on('connection', (socket) => {
    console.log(`💻 User Connected to Dashboard UI (ID: ${socket.id})`);

    socket.on('client:update-report-status', async (data) => {
      const payload = { reportId: data.reportId, verificationStatus: data.status, reviewedAt: new Date().toISOString() };
      await producer.send({ topic: 'j3.dashboard.report-updates', messages: [{ value: JSON.stringify(payload) }] });
    });

    socket.on('client:update-resource-status', async (data) => {
      const payload = { resourceId: data.resourceId, status: data.status, lastUpdated: data.lastUpdated };
      await producer.send({ topic: 'j3.dashboard.resource-updates', messages: [{ value: JSON.stringify(payload) }] });
    });

    socket.on('client:create-alert', async (data) => {
      // Broadcast alert to all clients immediately
      io.emit('dashboard:risk-alert', data);
    });
  });
}

startBridge().catch(console.error);