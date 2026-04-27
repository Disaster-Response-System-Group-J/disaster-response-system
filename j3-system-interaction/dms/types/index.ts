// ============================================================
// J3 DMS — Shared TypeScript Types & Enums
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export enum UserRole {
  PUBLIC_USER = 'PUBLIC_USER',
  OFFICER = 'OFFICER',
  RESOURCE_MANAGER = 'RESOURCE_MANAGER',
  ADMIN = 'ADMIN',
}

export enum DisasterType {
  FLOOD = 'FLOOD',
  LANDSLIDE = 'LANDSLIDE',
  OTHER = 'OTHER',
}

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
    other: number;
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
  [UserRole.OFFICER]: [
    'view:dashboard',
    'view:incoming-reports',
    'verify:reports',
    'reject:reports',
    'view:incident-map',
    'view:resources',
    'view:alerts',
    'view:analytics',
    'create:incident',
  ],
  [UserRole.RESOURCE_MANAGER]: [
    'view:dashboard',
    'view:incident-map',
    'view:resources',
    'assign:resources',
    'update:resource-status',
    'view:alerts',
    'view:analytics',
  ],
  [UserRole.ADMIN]: [
    'view:dashboard',
    'view:incoming-reports',
    'verify:reports',
    'reject:reports',
    'view:incident-map',
    'view:resources',
    'assign:resources',
    'update:resource-status',
    'view:alerts',
    'view:analytics',
    'manage:users',
    'manage:settings',
    'create:incident',
  ],
};
