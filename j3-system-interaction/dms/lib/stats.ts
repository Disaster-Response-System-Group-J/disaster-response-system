import {
  ConfirmedIncident, Resource, IncomingReport,
  IncidentStatus, IncidentSeverity, ResourceStatus, VerificationStatus,
} from '@/types';

export function getActiveIncidentCount(incidents: ConfirmedIncident[]): number {
  return incidents.filter(i => i.status === IncidentStatus.ACTIVE).length;
}

export function getCriticalIncidentCount(incidents: ConfirmedIncident[]): number {
  return incidents.filter(i => i.severity === IncidentSeverity.CRITICAL).length;
}

export function getHighSeverityIncidentCount(incidents: ConfirmedIncident[]): number {
  return incidents.filter(
    i => i.severity === IncidentSeverity.HIGH || i.severity === IncidentSeverity.CRITICAL,
  ).length;
}

export function getAvailableResourceCount(resources: Resource[]): number {
  return resources.filter(r => r.status === ResourceStatus.AVAILABLE).length;
}

export function getPendingReportCount(reports: IncomingReport[]): number {
  return reports.filter(r => r.verificationStatus === VerificationStatus.PENDING_REVIEW).length;
}

export function getTotalAffectedPeople(incidents: ConfirmedIncident[]): number {
  return incidents.reduce((sum, i) => sum + (i.affectedPeople ?? 0), 0);
}
