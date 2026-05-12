// ============================================================
// J3 DMS — Shared TypeScript Types & Enums
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export enum UserRole {
  PUBLIC_USER = 'PUBLIC_USER',
  INCIDENT_COMMANDER_NATIONAL = 'INCIDENT_COMMANDER_NATIONAL',
  INCIDENT_COMMANDER_ZONAL = 'INCIDENT_COMMANDER_ZONAL',
  OPERATIONS_OFFICER_NATIONAL = 'OPERATIONS_OFFICER_NATIONAL',
  OPERATIONS_OFFICER_ZONAL = 'OPERATIONS_OFFICER_ZONAL',
  RESOURCE_MANAGER_NATIONAL = 'RESOURCE_MANAGER_NATIONAL',
  RESOURCE_MANAGER_ZONAL = 'RESOURCE_MANAGER_ZONAL',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  AUDITOR = 'AUDITOR',
}

// ── Enums ────────────────────────────────────────────────────

// Core disaster types (always available)
export const DISASTER_TYPES = {
  FLOOD: 'FLOOD',
  LANDSLIDE: 'LANDSLIDE',
  DROUGHT: 'DROUGHT',
  OTHER: 'OTHER', // For admin-defined disasters
} as const;

export type DisasterType = typeof DISASTER_TYPES[keyof typeof DISASTER_TYPES] | string; // Allow custom disaster types

export enum ReportSource {
  J1_SOS_APP = 'J1_SOS_APP',
  J3_PUBLIC_PORTAL = 'J3_PUBLIC_PORTAL',
  J1_SENSOR_SYSTEM = 'J1_SENSOR_SYSTEM',
  WEATHER_API = 'WEATHER_API',
  OFFICER_CREATED = 'OFFICER_CREATED',
}

export enum VerificationStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  DUPLICATE = 'DUPLICATE',
  CONVERTED_TO_INCIDENT = 'CONVERTED_TO_INCIDENT',
}

export enum IncidentStatus {
  ACTIVE = 'ACTIVE',
  UNDER_RESPONSE = 'UNDER_RESPONSE',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ResourceType {
  RESCUE_TEAM = 'RESCUE_TEAM',
  BOAT = 'BOAT',
  AMBULANCE = 'AMBULANCE',
  SHELTER = 'SHELTER',
  MEDICAL_TEAM = 'MEDICAL_TEAM',
  FOOD_WATER = 'FOOD_WATER',
}

export enum ResourceStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  BUSY = 'BUSY',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum AlertType {
  RISK_ALERT = 'RISK_ALERT',
  PUBLIC_ALERT = 'PUBLIC_ALERT',
  SHELTER_CAPACITY = 'SHELTER_CAPACITY',
  RESOURCE_SHORTAGE = 'RESOURCE_SHORTAGE',
  INCIDENT_STATUS = 'INCIDENT_STATUS',
}

// ── Interfaces ───────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface IncomingReport {
  reportId: string;
  source: ReportSource;
  disasterType: DisasterType;
  district: string;
  latitude: number;
  longitude: number;
  description: string;
  contact: string;
  mediaUrls: string[];
  verificationStatus: VerificationStatus;
  createdAt: string;
  // J1 SOS specific fields
  sosId?: string;
  sosType?: string;
  deviceId?: string;
  // Officer notes
  officerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ConfirmedIncident {
  incidentId: string;
  sourceReports: string[];
  disasterType: DisasterType;
  district: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  description: string;
  title: string;
  publicVisibility: boolean;
  affectedPeople?: number;
  createdAt: string;
  updatedAt: string;
  // Assigned by J1/backend on incident creation; never generated in J3
  blockchainCaseId?: number | null;
}

// ── J4 Blockchain Audit Types ─────────────────────────────────

export interface LogAuditEventPayload {
  caseId: number;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId?: string;
  alertId?: string;
  performedBy: string;
  performedRole: string;
  previousStatus?: string;
  newStatus?: string;
  district?: string;
  notes?: string;
  correlationId?: string;
}

export interface AuditEvent {
  id: number;
  caseId: number;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId?: string;
  alertId?: string;
  performedBy: string;
  performedRole: string;
  previousStatus?: string;
  newStatus?: string;
  district?: string;
  notes?: string;
  correlationId?: string;
  timestamp: number;
}

export interface Resource {
  resourceId: string;
  type: ResourceType;
  name: string;
  district: string;
  status: ResourceStatus;
  assignedIncident?: string;
  assignedIncidentTitle?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  currentLoad?: number;
  lastUpdated: string;
}

export interface Alert {
  alertId: string;
  type: AlertType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  district: string;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  source?: string;
  // Prediction & AI Context
  predictionProbability?: number;  // 0-1 confidence
  considerationScore?: number;     // 0-1 AI confidence
  predictionCategory?: string;     // FLOOD, LANDSLIDE, etc.
  topProbabilityKey?: string;      // Most likely scenario (NORMAL, MODERATE, SEVERE, EXTREME)
  probabilities?: Record<string, number>; // Full probability distribution
  // Resource Context
  resourcePressure?: number;       // 0-1 resource availability pressure
  resourceSummary?: {
    overall: { total: number; available: number };
    by_type: Record<string, { total: number; available: number }>;
  };
}

export interface ShelterInfo {
  shelterId: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  currentOccupancy: number;
  status: 'OPEN' | 'FULL' | 'CLOSED';
  facilities: string[];
  contactNumber: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  category: string;
  available24x7: boolean;
  description?: string;
}

export interface DashboardSummary {
  activeIncidents: number;
  activeIncidentsChange: number;
  criticalAlerts: number;
  pendingReports: number;
  peopleAffected: number;
  peopleAffectedChange: number;
  inShelters: number;
  incidents: {
    floods: number;
    landslides: number;
    droughts: number;
    other: number;
    [key: string]: number; // Allow for custom disaster types
  };
  resources: {
    availableTeams: { current: number; total: number };
    activeShelters: { current: number; total: number };
    heavyMachinery: { current: number; total: number };
  };
  recentAlerts: Alert[];
}

// ── Kafka Event Interfaces ───────────────────────────────────

export interface KafkaEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SOSReportEvent extends KafkaEvent {
  eventType: 'raw-sos-report';
  payload: {
    sosId: string;
    source: ReportSource.J1_SOS_APP;
    sosType: string;
    district: string;
    latitude: number;
    longitude: number;
    contact?: string;
    deviceId?: string;
  };
}

export interface PublicReportEvent extends KafkaEvent {
  eventType: 'raw-public-report';
  payload: {
    reportId: string;
    source: ReportSource.J3_PUBLIC_PORTAL;
    disasterType: DisasterType;
    district: string;
    latitude: number;
    longitude: number;
    description: string;
    contact: string;
    mediaUrls: string[];
  };
}

export interface RiskAlertEvent extends KafkaEvent {
  eventType: 'risk-alert';
  payload: {
    alertId: string;
    type: AlertType;
    severity: IncidentSeverity;
    district: string;
    description: string;
  };
}

// ── Permission Map ───────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.PUBLIC_USER]: [
    'view:public-alerts',
    'view:shelters',
    'view:emergency-contacts',
    'create:public-report',
  ],
  [UserRole.INCIDENT_COMMANDER_NATIONAL]: [
    'view:dashboard', 'view:incident-map', 'view:alerts', 'view:analytics', 'view:predictions',
    'view:sensors', 'approve:incidents', 'reject:incidents', 'issue:alerts', 'force-reallocate:resources'
  ],
  [UserRole.INCIDENT_COMMANDER_ZONAL]: [
    'view:dashboard', 'view:incident-map', 'view:alerts', 'view:analytics', 'view:predictions',
    'view:sensors', 'approve:incidents', 'reject:incidents', 'issue:alerts', 'force-reallocate:resources'
  ],
  [UserRole.OPERATIONS_OFFICER_NATIONAL]: [
    'view:dashboard', 'view:incoming-reports', 'view:incident-map', 'view:sensors',
    'verify:reports', 'reject:reports', 'update:incident-status', 'request:resources'
  ],
  [UserRole.OPERATIONS_OFFICER_ZONAL]: [
    'view:dashboard', 'view:incoming-reports', 'view:incident-map', 'view:sensors',
    'verify:reports', 'reject:reports', 'update:incident-status', 'request:resources'
  ],
  [UserRole.RESOURCE_MANAGER_NATIONAL]: [
    'view:dashboard', 'view:incident-map', 'view:resources', 'view:predictions',
    'dispatch:resources', 'update:resource-status', 'manage:shelters'
  ],
  [UserRole.RESOURCE_MANAGER_ZONAL]: [
    'view:dashboard', 'view:incident-map', 'view:resources', 'view:predictions',
    'dispatch:resources', 'update:resource-status', 'manage:shelters'
  ],
  [UserRole.SYSTEM_ADMIN]: [
    'view:dashboard', 'manage:users', 'manage:settings', 'view:audit-logs',
    'view:blockchain-audit',
  ],
  [UserRole.AUDITOR]: [
    'view:dashboard', 'view:audit-logs', 'view:blockchain-audit',
    'view:incident-map',
  ],
};
