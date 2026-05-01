const { Server } = require('socket.io');

const io = new Server(3001, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

console.log("Mock J1/J2 WebSocket server running on port 3001");

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Simulate J1: Incoming SOS Reports every 20 seconds
  setInterval(() => {
    socket.emit('dashboard:new-report', {
      reportId: `REP-${Math.floor(Math.random() * 10000)}`, // Changed from id
      source: "J1_SOS_APP", // Added source
      disasterType: ["FLOOD", "LANDSLIDE", "MEDICAL"][Math.floor(Math.random() * 3)], // Changed from type
      district: ["Colombo", "Galle", "Kandy", "Matara"][Math.floor(Math.random() * 4)], // Changed from location
      latitude: 6.9271, // Added mock coordinates
      longitude: 79.8612,
      verificationStatus: "PENDING_REVIEW", // Changed from status
      description: "Mock description of the reported incident.", // Added description
      mediaUrls: [], // Added empty media array to prevent other mapping errors
      createdAt: new Date().toISOString(), // Changed from timestamp
      contact: "0771234567"
    });
  }, 20000);

  // Simulate J2: Risk Engine Alerts every 35 seconds
  setInterval(() => {
    socket.emit('dashboard:risk-alert', {
      alertId: `ALT-${Math.floor(Math.random() * 10000)}`,
      type: "RISK_ALERT",
      severity: ["HIGH", "CRITICAL", "MEDIUM"][Math.floor(Math.random() * 3)],
      title: "Water Levels Rising",
      description: "Water levels rising rapidly in Kelani River basin. Please be vigilant.",
      district: ["Colombo", "Gampaha", "Kalutara"][Math.floor(Math.random() * 3)],
      isPublic: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      source: "J2 Risk Engine"
    });
  }, 35000);

  // Simulate J1: Sensor Telemetry Updates every 5 seconds
  setInterval(() => {
    const mockSensorIds = ['SNS-KEL-001', 'SNS-KAL-014', 'SNS-ATT-005', 'SNS-GIN-021'];
    socket.emit('sensor:telemetry-update', {
      id: mockSensorIds[Math.floor(Math.random() * mockSensorIds.length)],
      battery: Math.floor(Math.random() * 100), 
      status: Math.random() > 0.8 ? 'OFFLINE' : 'ONLINE', 
      latestValue: `${(Math.random() * 10).toFixed(1)} m`,
      lastSeenMinutes: 0
    });
  }, 5000);
});