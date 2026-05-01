const { Server } = require('socket.io');
const SRI_LANKA_LOCATIONS = [
  { district: "Colombo", lat: 6.9271, lng: 79.8612 },
  { district: "Galle", lat: 6.0367, lng: 80.2170 },
  { district: "Kandy", lat: 7.2906, lng: 80.6337 },
  { district: "Matara", lat: 5.9549, lng: 80.5469 },
  { district: "Ratnapura", lat: 6.7056, lng: 80.3847 },
  { district: "Kegalle", lat: 7.2513, lng: 80.3464 },
  { district: "Gampaha", lat: 7.0840, lng: 80.0098 },
  { district: "Kalutara", lat: 6.5854, lng: 79.9607 },
  { district: "Jaffna", lat: 9.6615, lng: 80.0255 },
  { district: "Anuradhapura", lat: 8.3114, lng: 80.4037 },
  { district: "Trincomalee", lat: 8.5875, lng: 81.2152 },
  { district: "Batticaloa", lat: 7.7170, lng: 81.6998 },
  { district: "Badulla", lat: 6.9819, lng: 81.0559 }
];
function getRandomLocation() {
  const loc = SRI_LANKA_LOCATIONS[Math.floor(Math.random() * SRI_LANKA_LOCATIONS.length)];
  const jitterLat = (Math.random() - 0.5) * 0.1;
  const jitterLng = (Math.random() - 0.5) * 0.1;
  return {
    district: loc.district,
    latitude: loc.lat + jitterLat,
    longitude: loc.lng + jitterLng
  };
}
const io = new Server(3001, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

console.log("Mock J1/J2 WebSocket server running on port 3001");

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Simulate J1: Incoming SOS Reports every 20 seconds
  setInterval(() => {
    const location = getRandomLocation(); 

    socket.emit('dashboard:new-report', {
      reportId: `REP-${Math.floor(Math.random() * 10000)}`,
      source: "J1_SOS_APP",
      disasterType: ["FLOOD", "LANDSLIDE", "MEDICAL"][Math.floor(Math.random() * 3)],
      district: location.district, 
      latitude: location.latitude, 
      longitude: location.longitude, 
      verificationStatus: "PENDING_REVIEW",
      description: "Mock description of the reported incident.",
      mediaUrls: [],
      createdAt: new Date().toISOString(),
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

  socket.on('client:update-report-status', (data) => {
    console.log(`[Socket] Report ${data.reportId} updated to ${data.status} by officer`);
    
    // Broadcast this update to ALL OTHER connected clients
    socket.broadcast.emit('dashboard:report-updated', {
      reportId: data.reportId,
      verificationStatus: data.status,
      reviewedAt: new Date().toISOString()
    });
  });

  socket.on('client:update-resource-status', (data) => {
    console.log(`[Socket] Resource ${data.resourceId} updated to ${data.status}`);
    
    socket.broadcast.emit('dashboard:resource-updated', {
      resourceId: data.resourceId,
      status: data.status,
      lastUpdated: data.lastUpdated
    });
  });

  setInterval(() => {
    const location = getRandomLocation(); 

    socket.emit('dashboard:new-incident', {
      incidentId: `INC-${Math.floor(Math.random() * 10000)}`,
      disasterType: ["FLOOD", "LANDSLIDE"][Math.floor(Math.random() * 2)],
      district: location.district, // Use matched district
      severity: ["HIGH", "CRITICAL", "MEDIUM"][Math.floor(Math.random() * 3)],
      status: "ACTIVE",
      latitude: location.latitude, 
      longitude: location.longitude, 
      title: "Automated Field Incident",
      description: "New incident verified by field sensors and drones.",
      affectedPeople: Math.floor(Math.random() * 5000),
      createdAt: new Date().toISOString()
    });
  }, 40000);
});