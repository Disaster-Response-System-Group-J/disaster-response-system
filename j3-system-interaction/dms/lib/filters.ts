import {
  ConfirmedIncident, Resource,
  DisasterType, IncidentSeverity, IncidentStatus,
  ResourceType, ResourceStatus,
} from '@/types';

export interface IncidentFilters {
  disasterType?: DisasterType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  district?: string;
}

export function filterIncidents(
  incidents: ConfirmedIncident[],
  filters: IncidentFilters,
): ConfirmedIncident[] {
  return incidents.filter((incident) => {
    if (filters.disasterType && incident.disasterType !== filters.disasterType) return false;
    if (filters.severity && incident.severity !== filters.severity) return false;
    if (filters.status && incident.status !== filters.status) return false;
    if (filters.district && incident.district !== filters.district) return false;
    return true;
  });
}

export interface ResourceFilters {
  type?: ResourceType;
  status?: ResourceStatus;
  district?: string;
  search?: string;
}

export function filterResources(
  resources: Resource[],
  filters: ResourceFilters,
): Resource[] {
  return resources.filter((resource) => {
    if (filters.search) {
      const query = filters.search.toLowerCase();
      if (
        !resource.name.toLowerCase().includes(query) &&
        !resource.resourceId.toLowerCase().includes(query)
      ) return false;
    }
    if (filters.type && resource.type !== filters.type) return false;
    if (filters.status && resource.status !== filters.status) return false;
    if (filters.district && resource.district !== filters.district) return false;
    return true;
  });
}
