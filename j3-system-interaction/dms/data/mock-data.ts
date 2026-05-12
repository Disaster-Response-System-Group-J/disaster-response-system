import {
  IncomingReport, ConfirmedIncident, Resource, Alert, ShelterInfo, EmergencyContact, User,
  UserRole, DISASTER_TYPES, ReportSource, VerificationStatus, IncidentStatus, IncidentSeverity,
  ResourceType, ResourceStatus, AlertType, DashboardSummary,
} from '@/types';

// ── Mock Users ───────────────────────────────────────────────
// export const MOCK_USERS: (User & { password: string, assignedDistrict?: string })[] = [
//   { id: 'ADM-001', email: 'admin@dmc.gov.lk', name: 'Kamal Perera', role: UserRole.SYSTEM_ADMIN, password: 'admin123', assignedDistrict: 'ALL' },
//   { id: 'OFF-001', email: 'officer@dmc.gov.lk', name: 'Nimal Silva', role: UserRole.OPERATIONS_OFFICER_ZONAL, password: 'officer123', assignedDistrict: 'Colombo' },
//   { id: 'RM-001', email: 'resource@dmc.gov.lk', name: 'Sunil Fernando', role: UserRole.RESOURCE_MANAGER_NATIONAL, password: 'resource123', assignedDistrict: 'ALL' },
//   { id: 'IC-001', email: 'commander@dmc.gov.lk', name: 'Incident Commander', role: UserRole.INCIDENT_COMMANDER_NATIONAL, password: 'admin123', assignedDistrict: 'ALL' },
//   // Mobile App Role Users
//   { id: 'FO-001', email: 'fieldofficer@dmc.gov.lk', name: 'Asanka Rathnayake', role: UserRole.FIELD_OFFICER, password: 'field123', assignedDistrict: 'Colombo' },
//   { id: 'FO-002', email: 'fieldofficer2@dmc.gov.lk', name: 'Ruwan Jayasena', role: UserRole.FIELD_OFFICER, password: 'field123', assignedDistrict: 'Ratnapura' },
//   { id: 'LS-001', email: 'logistics@dmc.gov.lk', name: 'Chaminda Jayawardena', role: UserRole.LOGISTICS_STAFF, password: 'logistics123', assignedDistrict: 'ALL' },
//   { id: 'LS-002', email: 'logistics2@dmc.gov.lk', name: 'Pathum Senanayake', role: UserRole.LOGISTICS_STAFF, password: 'logistics123', assignedDistrict: 'ALL' },
//   { id: 'RT-001', email: 'response@dmc.gov.lk', name: 'Priya Bandara', role: UserRole.RESPONSE_TEAM_MEMBER, password: 'response123', assignedDistrict: 'ALL' },
//   { id: 'RT-002', email: 'response2@dmc.gov.lk', name: 'Dilshan Perera', role: UserRole.RESPONSE_TEAM_MEMBER, password: 'response123', assignedDistrict: 'ALL' },
//   { id: 'AUD-001', email: 'auditor@dmc.gov.lk', name: 'Priya Jayawardena', role: UserRole.AUDITOR, password: 'auditor123', assignedDistrict: 'ALL' },
// ];
// ── Mock Incoming Reports ────────────────────────────────────
export const MOCK_INCOMING_REPORTS: IncomingReport[] = [
  {
    reportId: 'RPT-001', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Ratnapura', latitude: 6.6828, longitude: 80.4025,
    description: 'Severe flooding near Kalu Ganga river. Water level rising rapidly. Several houses submerged in Ratnapura town area.',
    contact: '+94 71 234 5678', mediaUrls: ['/uploads/flood-ratnapura-01.jpg'],
    verificationStatus: VerificationStatus.PENDING_REVIEW, createdAt: '2026-04-27T08:30:00Z',
  },
  {
    reportId: 'RPT-002', source: ReportSource.J1_SOS_APP, disasterType: DISASTER_TYPES.LANDSLIDE,
    district: 'Kegalle', latitude: 7.2513, longitude: 80.3464,
    description: 'SOS: Landslide blocking Kegalle-Colombo road near Mawanella.',
    contact: '', mediaUrls: [], sosId: 'SOS-4421', sosType: 'LANDSLIDE', deviceId: 'DEV-889',
    verificationStatus: VerificationStatus.PENDING_REVIEW, createdAt: '2026-04-27T09:15:00Z',
  },
  {
    reportId: 'RPT-003', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Colombo', latitude: 6.9350, longitude: 79.8538,
    description: 'Flash flooding in Kaduwela area. Roads impassable. Families stranded on rooftops.',
    contact: '+94 77 987 6543', mediaUrls: ['/uploads/flood-kaduwela-01.jpg', '/uploads/flood-kaduwela-02.jpg'],
    verificationStatus: VerificationStatus.VERIFIED, createdAt: '2026-04-27T07:45:00Z',
    reviewedBy: 'OFF-001', reviewedAt: '2026-04-27T08:00:00Z',
  },
  {
    reportId: 'RPT-004', source: ReportSource.J1_SOS_APP, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Kalutara', latitude: 6.5854, longitude: 80.0817,
    description: 'SOS: Water entering homes in Kalutara North. Urgent evacuation needed.',
    contact: '+94 76 111 2233', mediaUrls: [], sosId: 'SOS-4422', sosType: 'FLOOD', deviceId: 'DEV-112',
    verificationStatus: VerificationStatus.PENDING_REVIEW, createdAt: '2026-04-27T10:00:00Z',
  },
  {
    reportId: 'RPT-005', source: ReportSource.WEATHER_API, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Gampaha', latitude: 7.0840, longitude: 80.0098,
    description: 'Automated alert: Attanagalu Oya water level exceeded danger mark at 5.2m.',
    contact: '', mediaUrls: [],
    verificationStatus: VerificationStatus.CONVERTED_TO_INCIDENT, createdAt: '2026-04-27T06:30:00Z',
    reviewedBy: 'OFF-001', reviewedAt: '2026-04-27T06:45:00Z',
  },
  {
    reportId: 'RPT-006', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: DISASTER_TYPES.LANDSLIDE,
    district: 'Badulla', latitude: 6.9934, longitude: 81.0550,
    description: 'Minor earth slip near Haputale tea plantations. No casualties reported yet but road partially blocked.',
    contact: '+94 72 555 6677', mediaUrls: ['/uploads/slip-badulla-01.jpg'],
    verificationStatus: VerificationStatus.PENDING_REVIEW, createdAt: '2026-04-27T11:20:00Z',
  },
  {
    reportId: 'RPT-007', source: ReportSource.J1_SENSOR_SYSTEM, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Galle', latitude: 6.0535, longitude: 80.2210,
    description: 'Sensor alert: Gin Ganga water level at 4.8m — approaching critical threshold.',
    contact: '', mediaUrls: [],
    verificationStatus: VerificationStatus.VERIFIED, createdAt: '2026-04-27T09:50:00Z',
  },
  {
    reportId: 'RPT-008', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Matara', latitude: 5.9485, longitude: 80.5353,
    description: 'Duplicate report — same flooding event as RPT-007 in Galle downstream.',
    contact: '+94 71 999 8877', mediaUrls: [],
    verificationStatus: VerificationStatus.DUPLICATE, createdAt: '2026-04-27T10:30:00Z',
  },
  {
    reportId: 'RPT-009', source: ReportSource.OFFICER_CREATED, disasterType: DISASTER_TYPES.LANDSLIDE,
    district: 'Nuwara Eliya', latitude: 6.9497, longitude: 80.7891,
    description: 'Field observation: Crack formation spotted on hillside near Ramboda. Risk of major landslide.',
    contact: '', mediaUrls: [],
    verificationStatus: VerificationStatus.VERIFIED, createdAt: '2026-04-27T12:00:00Z',
    reviewedBy: 'OFF-001', reviewedAt: '2026-04-27T12:00:00Z',
  },
  {
    reportId: 'RPT-010', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: DISASTER_TYPES.FLOOD,
    district: 'Colombo', latitude: 6.9100, longitude: 79.8900,
    description: 'False report — area confirmed dry by field team.',
    contact: '+94 70 000 1122', mediaUrls: [],
    verificationStatus: VerificationStatus.REJECTED, createdAt: '2026-04-27T08:10:00Z',
    officerNotes: 'Field team confirmed no flooding. Area is dry.',
  },
  {
    reportId: 'RPT-011', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: DISASTER_TYPES.DROUGHT,
    district: 'Anuradhapura', latitude: 8.3114, longitude: 80.4037,
    description: 'Severe water shortage in Anuradhapura district. Wells drying up, crops failing.',
    contact: '+94 25 222 3344', mediaUrls: ['/uploads/drought-anuradhapura-01.jpg'],
    verificationStatus: VerificationStatus.PENDING_REVIEW, createdAt: '2026-04-27T14:00:00Z',
  },
  {
    reportId: 'RPT-012', source: ReportSource.WEATHER_API, disasterType: DISASTER_TYPES.DROUGHT,
    district: 'Polonnaruwa', latitude: 7.9403, longitude: 81.0188,
    description: 'Drought conditions worsening. 60 consecutive days without rainfall. Water rationing implemented.',
    contact: '', mediaUrls: [],
    verificationStatus: VerificationStatus.CONVERTED_TO_INCIDENT, createdAt: '2026-04-27T13:30:00Z',
  },
  {
    reportId: 'RPT-013', source: ReportSource.J3_PUBLIC_PORTAL, disasterType: 'CYCLONE',
    district: 'Trincomalee', latitude: 8.5874, longitude: 81.2152,
    description: 'Cyclone approaching eastern coast. Strong winds and heavy rain expected.',
    contact: '+94 26 222 4455', mediaUrls: [],
    verificationStatus: VerificationStatus.VERIFIED, createdAt: '2026-04-27T15:00:00Z',
    reviewedBy: 'ADM-001', reviewedAt: '2026-04-27T15:15:00Z',
  },
];

// ── Mock Confirmed Incidents ─────────────────────────────────
export const MOCK_CONFIRMED_INCIDENTS: ConfirmedIncident[] = [
  {
    incidentId: 'INC-001', sourceReports: ['RPT-003'], disasterType: DISASTER_TYPES.FLOOD,
    district: 'Colombo', severity: IncidentSeverity.CRITICAL, status: IncidentStatus.ACTIVE,
    latitude: 6.9350, longitude: 79.8538, title: 'Flash Flooding — Kaduwela',
    description: 'Severe flash flooding in Kaduwela area affecting 3,500 people. Multiple evacuations underway.',
    publicVisibility: true, affectedPeople: 3500, createdAt: '2026-04-27T08:05:00Z', updatedAt: '2026-04-27T11:00:00Z',
  },
  {
    incidentId: 'INC-002', sourceReports: ['RPT-005'], disasterType: DISASTER_TYPES.FLOOD,
    district: 'Gampaha', severity: IncidentSeverity.HIGH, status: IncidentStatus.UNDER_RESPONSE,
    latitude: 7.0840, longitude: 80.0098, title: 'Attanagalu Oya Overflow',
    description: 'Attanagalu Oya exceeded danger level. Low-lying areas in Gampaha flooded.',
    publicVisibility: true, affectedPeople: 5200, createdAt: '2026-04-27T06:50:00Z', updatedAt: '2026-04-27T10:30:00Z',
  },
  {
    incidentId: 'INC-003', sourceReports: [], disasterType: DISASTER_TYPES.FLOOD,
    district: 'Ratnapura', severity: IncidentSeverity.CRITICAL, status: IncidentStatus.ACTIVE,
    latitude: 6.6828, longitude: 80.4025, title: 'Kalu Ganga Basin Flooding',
    description: 'Major flooding along Kalu Ganga. Ratnapura town partially submerged. 12,450 affected.',
    publicVisibility: true, affectedPeople: 12450, createdAt: '2026-04-26T22:00:00Z', updatedAt: '2026-04-27T11:30:00Z',
  },
  {
    incidentId: 'INC-004', sourceReports: [], disasterType: DISASTER_TYPES.LANDSLIDE,
    district: 'Kegalle', severity: IncidentSeverity.HIGH, status: IncidentStatus.UNDER_RESPONSE,
    latitude: 7.2200, longitude: 80.3200, title: 'Mawanella Landslide',
    description: 'Major landslide on Kegalle-Colombo road near Mawanella. Road completely blocked.',
    publicVisibility: true, affectedPeople: 800, createdAt: '2026-04-27T05:30:00Z', updatedAt: '2026-04-27T09:00:00Z',
  },
  {
    incidentId: 'INC-005', sourceReports: [], disasterType: DISASTER_TYPES.FLOOD,
    district: 'Kalutara', severity: IncidentSeverity.MEDIUM, status: IncidentStatus.ACTIVE,
    latitude: 6.5500, longitude: 80.0500, title: 'Kalu Ganga Downstream Flooding',
    description: 'Moderate flooding in Kalutara low-lying areas from Kalu Ganga overflow.',
    publicVisibility: true, affectedPeople: 2100, createdAt: '2026-04-27T07:00:00Z', updatedAt: '2026-04-27T10:00:00Z',
  },
  {
    incidentId: 'INC-006', sourceReports: ['RPT-007'], disasterType: DISASTER_TYPES.FLOOD,
    district: 'Galle', severity: IncidentSeverity.MEDIUM, status: IncidentStatus.ACTIVE,
    latitude: 6.0535, longitude: 80.2210, title: 'Gin Ganga Rising — Galle',
    description: 'Gin Ganga approaching critical levels in Galle. Precautionary evacuations initiated.',
    publicVisibility: true, affectedPeople: 1800, createdAt: '2026-04-27T10:00:00Z', updatedAt: '2026-04-27T11:00:00Z',
  },
  {
    incidentId: 'INC-007', sourceReports: [], disasterType: DISASTER_TYPES.LANDSLIDE,
    district: 'Badulla', severity: IncidentSeverity.LOW, status: IncidentStatus.RESOLVED,
    latitude: 7.0000, longitude: 81.0600, title: 'Minor Slip — Haputale Road',
    description: 'Minor earth slip cleared. Road reopened to traffic.',
    publicVisibility: false, affectedPeople: 50, createdAt: '2026-04-26T14:00:00Z', updatedAt: '2026-04-27T06:00:00Z',
  },
  {
    incidentId: 'INC-008', sourceReports: ['RPT-009'], disasterType: DISASTER_TYPES.LANDSLIDE,
    district: 'Nuwara Eliya', severity: IncidentSeverity.HIGH, status: IncidentStatus.ACTIVE,
    latitude: 6.9497, longitude: 80.7891, title: 'Ramboda Landslide Risk',
    description: 'Active hillside crack formation near Ramboda. Precautionary evacuation of 15 families.',
    publicVisibility: true, affectedPeople: 75, createdAt: '2026-04-27T12:10:00Z', updatedAt: '2026-04-27T12:10:00Z',
  },
  {
    incidentId: 'INC-009', sourceReports: ['RPT-012'], disasterType: DISASTER_TYPES.DROUGHT,
    district: 'Polonnaruwa', severity: IncidentSeverity.HIGH, status: IncidentStatus.ACTIVE,
    latitude: 7.9403, longitude: 81.0188, title: 'Severe Drought — Polonnaruwa',
    description: 'Extended drought period affecting agriculture and water supply. 60+ days without rain.',
    publicVisibility: true, affectedPeople: 8500, createdAt: '2026-04-27T13:45:00Z', updatedAt: '2026-04-27T14:30:00Z',
  },
  {
    incidentId: 'INC-010', sourceReports: ['RPT-011'], disasterType: DISASTER_TYPES.DROUGHT,
    district: 'Anuradhapura', severity: IncidentSeverity.MEDIUM, status: IncidentStatus.UNDER_RESPONSE,
    latitude: 8.3114, longitude: 80.4037, title: 'Water Crisis — Anuradhapura',
    description: 'Critical water shortage in Anuradhapura. Wells drying up, water rationing in effect.',
    publicVisibility: true, affectedPeople: 3200, createdAt: '2026-04-27T14:15:00Z', updatedAt: '2026-04-27T15:00:00Z',
  },
  {
    incidentId: 'INC-011', sourceReports: ['RPT-013'], disasterType: 'CYCLONE',
    district: 'Trincomalee', severity: IncidentSeverity.CRITICAL, status: IncidentStatus.ACTIVE,
    latitude: 8.5874, longitude: 81.2152, title: 'Cyclone Threat — Eastern Coast',
    description: 'Category 3 cyclone approaching Trincomalee coast. Winds up to 150km/h expected.',
    publicVisibility: true, affectedPeople: 15000, createdAt: '2026-04-27T15:30:00Z', updatedAt: '2026-04-27T15:30:00Z',
  },
];

// ── Mock Resources ───────────────────────────────────────────
export const MOCK_RESOURCES: Resource[] = [
  { resourceId: 'RSC-001', type: ResourceType.RESCUE_TEAM, name: 'Navy Swift Water Unit 4', district: 'Ratnapura', status: ResourceStatus.ASSIGNED, assignedIncident: 'INC-003', assignedIncidentTitle: 'Kalu Ganga Basin Flooding', latitude: 6.68, longitude: 80.40, lastUpdated: '2026-04-27T10:00:00Z' },
  { resourceId: 'RSC-002', type: ResourceType.AMBULANCE, name: 'Ambulance AMB-942', district: 'Colombo', status: ResourceStatus.ASSIGNED, assignedIncident: 'INC-001', assignedIncidentTitle: 'Flash Flooding — Kaduwela', latitude: 6.93, longitude: 79.85, lastUpdated: '2026-04-27T09:30:00Z' },
  { resourceId: 'RSC-003', type: ResourceType.BOAT, name: 'Rescue Boat RBT-118', district: 'Gampaha', status: ResourceStatus.BUSY, assignedIncident: 'INC-002', assignedIncidentTitle: 'Attanagalu Oya Overflow', latitude: 7.08, longitude: 80.01, lastUpdated: '2026-04-27T08:45:00Z' },
  { resourceId: 'RSC-004', type: ResourceType.RESCUE_TEAM, name: 'Ground Team TM-099', district: 'Kalutara', status: ResourceStatus.AVAILABLE, latitude: 6.58, longitude: 80.08, lastUpdated: '2026-04-27T11:00:00Z' },
  { resourceId: 'RSC-005', type: ResourceType.MEDICAL_TEAM, name: 'Medical Corps Detachment', district: 'Ratnapura', status: ResourceStatus.ASSIGNED, assignedIncident: 'INC-003', assignedIncidentTitle: 'Kalu Ganga Basin Flooding', latitude: 6.69, longitude: 80.41, lastUpdated: '2026-04-27T09:00:00Z' },
  { resourceId: 'RSC-006', type: ResourceType.AMBULANCE, name: 'Ambulance AMB-845', district: 'Gampaha', status: ResourceStatus.AVAILABLE, latitude: 7.10, longitude: 80.00, lastUpdated: '2026-04-27T10:30:00Z' },
  { resourceId: 'RSC-007', type: ResourceType.FOOD_WATER, name: 'Supply Unit FW-22', district: 'Colombo', status: ResourceStatus.ASSIGNED, assignedIncident: 'INC-001', assignedIncidentTitle: 'Flash Flooding — Kaduwela', lastUpdated: '2026-04-27T08:00:00Z' },
  { resourceId: 'RSC-008', type: ResourceType.SHELTER, name: 'Ratnapura Central School', district: 'Ratnapura', status: ResourceStatus.BUSY, capacity: 500, currentLoad: 480, latitude: 6.6830, longitude: 80.4030, lastUpdated: '2026-04-27T11:30:00Z' },
  { resourceId: 'RSC-009', type: ResourceType.SHELTER, name: 'Kaduwela Community Hall', district: 'Colombo', status: ResourceStatus.ASSIGNED, capacity: 300, currentLoad: 250, latitude: 6.9360, longitude: 79.8540, lastUpdated: '2026-04-27T10:00:00Z' },
  { resourceId: 'RSC-010', type: ResourceType.BOAT, name: 'Rescue Boat RBT-205', district: 'Ratnapura', status: ResourceStatus.ASSIGNED, assignedIncident: 'INC-003', latitude: 6.67, longitude: 80.39, lastUpdated: '2026-04-27T07:30:00Z' },
  { resourceId: 'RSC-011', type: ResourceType.RESCUE_TEAM, name: 'Army Rescue Platoon B2', district: 'Kegalle', status: ResourceStatus.ASSIGNED, assignedIncident: 'INC-004', assignedIncidentTitle: 'Mawanella Landslide', latitude: 7.22, longitude: 80.32, lastUpdated: '2026-04-27T06:00:00Z' },
  { resourceId: 'RSC-012', type: ResourceType.AMBULANCE, name: 'Ambulance AMB-301', district: 'Kegalle', status: ResourceStatus.OUT_OF_SERVICE, lastUpdated: '2026-04-27T05:00:00Z' },
];

// ── Mock Alerts ──────────────────────────────────────────────
export const MOCK_ALERTS: Alert[] = [
  {
    alertId: 'ALT-001',
    type: AlertType.RISK_ALERT,
    severity: IncidentSeverity.CRITICAL,
    title: 'Level 3 Flood Warning — Kelani River Basin',
    description: 'Kelani River water levels exceeding danger mark. Colombo & Gampaha districts under evacuation orders.',
    district: 'Colombo',
    isPublic: true,
    isActive: true,
    createdAt: '2026-04-27T06:00:00Z',
    source: 'J2 Risk Engine',
    predictionProbability: 0.87,
    considerationScore: 0.92,
    resourcePressure: 0.78,
    predictionCategory: 'FLOOD',
    topProbabilityKey: 'SEVERE',
    probabilities: { NORMAL: 0.02, MODERATE: 0.07, SEVERE: 0.78, EXTREME: 0.13 },
    resourceSummary: {
      overall: { total: 45, available: 10 },
      by_type: { shelter: { total: 12, available: 2 }, water_supply: { total: 8, available: 1 }, medical: { total: 15, available: 4 }, transport: { total: 10, available: 3 } }
    }
  },
  {
    alertId: 'ALT-002',
    type: AlertType.RISK_ALERT,
    severity: IncidentSeverity.HIGH,
    title: 'Landslide Warning — Central Highlands',
    description: 'Heavy rainfall triggering landslide risk in Nuwara Eliya, Kandy, and Kegalle districts.',
    district: 'Nuwara Eliya',
    isPublic: true,
    isActive: true,
    createdAt: '2026-04-27T07:00:00Z',
    source: 'J2 Risk Engine',
    predictionProbability: 0.73,
    considerationScore: 0.81,
    resourcePressure: 0.42,
    predictionCategory: 'LANDSLIDE',
    topProbabilityKey: 'MODERATE',
    probabilities: { NORMAL: 0.12, MODERATE: 0.64, SEVERE: 0.20, EXTREME: 0.04 },
    resourceSummary: {
      overall: { total: 38, available: 22 },
      by_type: { shelter: { total: 10, available: 7 }, water_supply: { total: 6, available: 4 }, medical: { total: 12, available: 7 }, transport: { total: 10, available: 4 } }
    }
  },
  {
    alertId: 'ALT-003',
    type: AlertType.SHELTER_CAPACITY,
    severity: IncidentSeverity.HIGH,
    title: 'Shelter Over Capacity — Ratnapura Central',
    description: 'Ratnapura Central School shelter at 96% capacity. Overflow arrangements needed.',
    district: 'Ratnapura',
    isPublic: false,
    isActive: true,
    createdAt: '2026-04-27T10:00:00Z'
  },
  {
    alertId: 'ALT-004',
    type: AlertType.RESOURCE_SHORTAGE,
    severity: IncidentSeverity.MEDIUM,
    title: 'Medical Supply Shortage — Galle Zone',
    description: 'Medical supplies running low in Galle district shelters. Resupply within 12 hours.',
    district: 'Galle',
    isPublic: false,
    isActive: true,
    createdAt: '2026-04-27T09:00:00Z'
  },
  {
    alertId: 'ALT-005',
    type: AlertType.PUBLIC_ALERT,
    severity: IncidentSeverity.CRITICAL,
    title: 'Evacuation Order — Kaduwela Division',
    description: 'All residents in Kaduwela low-lying areas must evacuate immediately. Report to nearest shelter.',
    district: 'Colombo',
    isPublic: true,
    isActive: true,
    createdAt: '2026-04-27T08:30:00Z',
    predictionProbability: 0.91,
    considerationScore: 0.84,
    resourcePressure: 0.65,
    predictionCategory: 'FLOOD',
    topProbabilityKey: 'SEVERE',
    probabilities: { NORMAL: 0.02, MODERATE: 0.07, SEVERE: 0.78, EXTREME: 0.13 },
    resourceSummary: {
      overall: { total: 45, available: 18 },
      by_type: { shelter: { total: 12, available: 4 }, water_supply: { total: 8, available: 3 }, medical: { total: 15, available: 6 }, transport: { total: 10, available: 5 } }
    }
  },
  {
    alertId: 'ALT-006',
    type: AlertType.INCIDENT_STATUS,
    severity: IncidentSeverity.LOW,
    title: 'Road Reopened — Haputale',
    description: 'Haputale road cleared of debris. Normal traffic resumed.',
    district: 'Badulla',
    isPublic: true,
    isActive: false,
    createdAt: '2026-04-27T06:30:00Z'
  },
  {
    alertId: 'ALT-007',
    type: AlertType.PUBLIC_ALERT,
    severity: IncidentSeverity.HIGH,
    title: 'Heavy Rainfall Expected — SW Monsoon',
    description: '150mm rainfall expected in next 24h across Western & Sabaragamuwa provinces.',
    district: 'Ratnapura',
    isPublic: true,
    isActive: true,
    createdAt: '2026-04-27T05:00:00Z',
    source: 'Meteorological Dept',
    predictionProbability: 0.68,
    considerationScore: 0.76,
    resourcePressure: 0.71,
    predictionCategory: 'FLOOD',
    topProbabilityKey: 'SEVERE',
    probabilities: { NORMAL: 0.05, MODERATE: 0.27, SEVERE: 0.56, EXTREME: 0.12 },
    resourceSummary: {
      overall: { total: 42, available: 12 },
      by_type: { shelter: { total: 14, available: 3 }, water_supply: { total: 7, available: 2 }, medical: { total: 13, available: 4 }, transport: { total: 8, available: 3 } }
    }
  },
  {
    alertId: 'ALT-008',
    type: AlertType.RESOURCE_SHORTAGE,
    severity: IncidentSeverity.HIGH,
    title: 'Potable Water Critical — Ratnapura',
    description: 'Water purification supplies running critically low in Ratnapura shelters.',
    district: 'Ratnapura',
    isPublic: false,
    isActive: true,
    createdAt: '2026-04-27T11:00:00Z'
  },
  {
    alertId: 'ALT-SYN-1715169688637',
    type: AlertType.RISK_ALERT,
    severity: IncidentSeverity.HIGH,
    title: 'Synthetic Flood Watch for Colombo',
    description: 'Risk alert',
    district: 'Colombo',
    isPublic: true,
    isActive: true,
    createdAt: '2026-05-08T15:01:28.637Z',
    source: 'Synthetic Test Producer',
    predictionProbability: 0.91,
    considerationScore: 0.84,
    resourcePressure: 0.65,
    predictionCategory: 'FLOOD',
    topProbabilityKey: 'SEVERE',
    divisionId: 1,
    divisionName: 'Colombo',
    forecastDate: '2026-05-08',
    hazardType: 'FLOOD',
    featureDate: '2026-05-08',
    probabilities: { NORMAL: 0.02, MODERATE: 0.07, SEVERE: 0.78, EXTREME: 0.13 },
    resourceSummary: {
      overall: { total: 52, available: 20 },
      by_type: { shelter: { total: 14, available: 5 }, water_supply: { total: 9, available: 3 }, medical: { total: 17, available: 7 }, transport: { total: 12, available: 5 } }
    }
  },
];

// ── Mock Shelters ────────────────────────────────────────────
export const MOCK_SHELTERS: ShelterInfo[] = [
  { shelterId: 'SH-001', name: 'Ratnapura Central School', district: 'Ratnapura', address: 'Main St, Ratnapura', latitude: 6.6830, longitude: 80.4030, capacity: 500, currentOccupancy: 480, status: 'OPEN', facilities: ['Water', 'First Aid', 'Meals', 'Sanitation'], contactNumber: '+94 45 222 3344' },
  { shelterId: 'SH-002', name: 'Kaduwela Community Hall', district: 'Colombo', address: 'Avissawella Rd, Kaduwela', latitude: 6.9360, longitude: 79.8540, capacity: 300, currentOccupancy: 250, status: 'OPEN', facilities: ['Water', 'First Aid', 'Sanitation'], contactNumber: '+94 11 255 6677' },
  { shelterId: 'SH-003', name: 'Galle Central College', district: 'Galle', address: 'Fort Rd, Galle', latitude: 6.0300, longitude: 80.2170, capacity: 1000, currentOccupancy: 640, status: 'OPEN', facilities: ['Water', 'First Aid', 'Meals', 'Sanitation', 'Medical Unit'], contactNumber: '+94 91 223 4455' },
  { shelterId: 'SH-004', name: 'Karapitiya Temple', district: 'Galle', address: 'Karapitiya, Galle', latitude: 6.0500, longitude: 80.2300, capacity: 200, currentOccupancy: 195, status: 'FULL', facilities: ['Water', 'Sanitation'], contactNumber: '+94 91 229 9001' },
  { shelterId: 'SH-005', name: 'Gampaha Town Hall', district: 'Gampaha', address: 'Main St, Gampaha', latitude: 7.0840, longitude: 80.0098, capacity: 400, currentOccupancy: 310, status: 'OPEN', facilities: ['Water', 'First Aid', 'Meals'], contactNumber: '+94 33 222 1100' },
  { shelterId: 'SH-006', name: 'Kegalle Multipurpose Hall', district: 'Kegalle', address: 'Kandy Rd, Kegalle', latitude: 7.2513, longitude: 80.3464, capacity: 250, currentOccupancy: 120, status: 'OPEN', facilities: ['Water', 'First Aid', 'Sanitation'], contactNumber: '+94 35 222 3300' },
  { shelterId: 'SH-007', name: 'Kalutara Dharmasala', district: 'Kalutara', address: 'Galle Rd, Kalutara', latitude: 6.5854, longitude: 80.0817, capacity: 350, currentOccupancy: 0, status: 'CLOSED', facilities: ['Water', 'Sanitation'], contactNumber: '+94 34 222 5500' },
];

// ── Mock Emergency Contacts ──────────────────────────────────
export const MOCK_EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: 'EC-001', name: 'National Emergency Hotline', number: '119', category: 'Emergency', available24x7: true, description: 'Police, Fire, Ambulance' },
  { id: 'EC-002', name: 'Disaster Management Centre', number: '117', category: 'Disaster', available24x7: true, description: 'National disaster coordination and reporting' },
  { id: 'EC-003', name: 'Ambulance / Suwa Seriya', number: '1990', category: 'Medical', available24x7: true, description: 'Free ambulance service island-wide' },
  { id: 'EC-004', name: 'Fire Brigade', number: '110', category: 'Emergency', available24x7: true },
  { id: 'EC-005', name: 'Sri Lanka Red Cross', number: '+94 11 269 1095', category: 'Relief', available24x7: false, description: 'Humanitarian aid and relief operations' },
  { id: 'EC-006', name: 'National Building Research Org.', number: '+94 11 288 8356', category: 'Disaster', available24x7: false, description: 'Landslide risk assessment and warnings' },
  { id: 'EC-007', name: 'Meteorological Department', number: '+94 11 269 4846', category: 'Weather', available24x7: true, description: 'Weather forecasts and warnings' },
  { id: 'EC-008', name: 'Irrigation Department', number: '+94 11 258 7240', category: 'Disaster', available24x7: false, description: 'River water levels and flood warnings' },
  { id: 'EC-009', name: 'Sri Lanka Navy (Rescue)', number: '+94 11 244 5368', category: 'Rescue', available24x7: true, description: 'Naval rescue operations during floods' },
  { id: 'EC-010', name: 'Sri Lanka Army (Disaster)', number: '+94 11 243 4050', category: 'Rescue', available24x7: true, description: 'Military disaster response operations' },
];

// ── Mock Dashboard Summary ───────────────────────────────────
export const MOCK_DASHBOARD_SUMMARY: DashboardSummary = {
  activeIncidents: 10,
  activeIncidentsChange: 3,
  criticalAlerts: 4,
  pendingReports: 6,
  peopleAffected: 42200,
  peopleAffectedChange: 15,
  inShelters: 2095,
  incidents: { floods: 5, landslides: 2, droughts: 2, other: 1, CYCLONE: 1 },
  resources: {
    availableTeams: { current: 2, total: 12 },
    activeShelters: { current: 6, total: 7 },
    heavyMachinery: { current: 0, total: 3 },
  },
  recentAlerts: MOCK_ALERTS.filter(a => a.isActive).slice(0, 4), // Include recent active alerts
};
