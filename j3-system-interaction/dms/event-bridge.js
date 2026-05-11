const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');

const brokerCandidates = (process.env.KAFKA_BROKER || 'localhost:29092,localhost:9092')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

// 1. Initialize Socket.IO Server (configurable port with fallback)
const DEFAULT_PORT = parseInt(process.env.PORT || process.env.BRIDGE_PORT || '3001', 10);
let io;

async function bindSocketPort(startPort = DEFAULT_PORT, maxAttempts = 10) {
  for (let p = startPort; p < startPort + maxAttempts; p++) {
    try {
      const candidate = new Server({ cors: { origin: "*", methods: ["GET", "POST"] } });
      // Attach an error handler to avoid unhandled 'error' events during probe
      candidate.on('error', (err) => {
        // no-op here; the listen() call will throw synchronously for EADDRINUSE
      });
      candidate.listen(p);
      io = candidate; // assign the working server to the module-scoped `io`
      return p;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`Port ${p} in use — trying ${p + 1}`);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Unable to bind Socket.IO to a port in range ${startPort}-${startPort + maxAttempts - 1}`);
}

// 2. Initialize Kafka Client 
const kafka = new Kafka({
  clientId: 'j3-event-bridge',
  brokers: brokerCandidates
});

const consumer = kafka.consumer({ groupId: 'j3-dashboard-group' });
const producer = kafka.producer();
const admin = kafka.admin(); // <-- NEW: Admin client to manage topics

async function startBridge() {
  const topics = [
    'j1.sos.raw-reports',
    'j1.sensor.telemetry',
    'j1.sensor.telemetry.flood',
    'j1.sensor.telemetry.landslide',
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

  // 4. Bind socket port and connect bridge
  const usedPort = await bindSocketPort();
  await producer.connect();
  await consumer.connect();
  console.log(`✅ Event Bridge Online. Connected to Kafka via ${brokerCandidates.join(', ')} & Next.js (${usedPort})`);

  // 5. Subscribe
  for (const t of topics) {
    await consumer.subscribe({ topic: t, fromBeginning: true });
  }

  // 6. Listen to Kafka and push to WebSockets
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      console.log(`📡 [Kafka -> UI] Routing ${topic} to frontend!`);

      if (topic === 'j1.sos.raw-reports') {
        // Flatten payload so dashboard can access latitude/longitude directly
        const p = data.payload || {};
        const report = {
          ...data,
          reportId: data.eventId,
          latitude: p.latitude ?? data.latitude,
          longitude: p.longitude ?? data.longitude,
          sosType: p.sosType ?? data.sosType,
          district: p.district ?? data.district,
        };
        io.emit('dashboard:new-report', report);
      }
      if (topic === 'j1.sensor.telemetry' || topic === 'j1.sensor.telemetry.flood' || topic === 'j1.sensor.telemetry.landslide') {
        io.emit('sensor:telemetry-update', data);
      }
      if (topic === 'j2.engine.risk-alerts') io.emit('dashboard:risk-alert', data);
      if (topic === 'j2.engine.incidents') io.emit('dashboard:new-incident', data);
      if (topic === 'j3.dashboard.report-updates') io.emit('dashboard:report-updated', data);
      if (topic === 'j3.dashboard.resource-updates') io.emit('dashboard:resource-updated', data);
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
  });
}

startBridge().catch(console.error);