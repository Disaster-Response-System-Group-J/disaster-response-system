import { describe, it, expect } from 'vitest';
import { hasPermission, hasRole } from '@/lib/permissions';
import { UserRole } from '@/types';
import type { User } from '@/types';

// J3 uses granular roles — no single super-admin
const incidentCommander: User = { id: 'IC-001', email: 'commander@dmc.gov.lk', name: 'Commander', role: UserRole.INCIDENT_COMMANDER_NATIONAL };
const opsOfficer: User = { id: 'OFF-001', email: 'officer@dmc.gov.lk', name: 'Nimal Silva', role: UserRole.OPERATIONS_OFFICER_ZONAL };
const resourceManager: User = { id: 'RM-001', email: 'resource@dmc.gov.lk', name: 'Sunil Fernando', role: UserRole.RESOURCE_MANAGER_NATIONAL };
const systemAdmin: User = { id: 'ADM-001', email: 'admin@dmc.gov.lk', name: 'Kamal Perera', role: UserRole.SYSTEM_ADMIN };
const publicUser: User = { id: 'PUB-001', email: 'public@example.com', name: 'Public User', role: UserRole.PUBLIC_USER };

describe('hasPermission', () => {
  it('returns false when user is null', () => {
    expect(hasPermission(null, 'view:dashboard')).toBe(false);
  });

  // Incident Commander permissions
  it('INCIDENT_COMMANDER_NATIONAL can approve incidents', () => {
    expect(hasPermission(incidentCommander, 'approve:incidents')).toBe(true);
  });

  it('INCIDENT_COMMANDER_NATIONAL can issue alerts', () => {
    expect(hasPermission(incidentCommander, 'issue:alerts')).toBe(true);
  });

  it('INCIDENT_COMMANDER_NATIONAL can view dashboard', () => {
    expect(hasPermission(incidentCommander, 'view:dashboard')).toBe(true);
  });

  it('INCIDENT_COMMANDER_NATIONAL cannot manage users', () => {
    expect(hasPermission(incidentCommander, 'manage:users')).toBe(false);
  });

  // Operations Officer permissions
  it('OPERATIONS_OFFICER_ZONAL can verify reports', () => {
    expect(hasPermission(opsOfficer, 'verify:reports')).toBe(true);
  });

  it('OPERATIONS_OFFICER_ZONAL can view incoming reports', () => {
    expect(hasPermission(opsOfficer, 'view:incoming-reports')).toBe(true);
  });

  it('OPERATIONS_OFFICER_ZONAL cannot approve incidents', () => {
    expect(hasPermission(opsOfficer, 'approve:incidents')).toBe(false);
  });

  it('OPERATIONS_OFFICER_ZONAL cannot dispatch resources', () => {
    expect(hasPermission(opsOfficer, 'dispatch:resources')).toBe(false);
  });

  // Resource Manager permissions
  it('RESOURCE_MANAGER_NATIONAL can dispatch resources', () => {
    expect(hasPermission(resourceManager, 'dispatch:resources')).toBe(true);
  });

  it('RESOURCE_MANAGER_NATIONAL can update resource status', () => {
    expect(hasPermission(resourceManager, 'update:resource-status')).toBe(true);
  });

  it('RESOURCE_MANAGER_NATIONAL cannot verify reports', () => {
    expect(hasPermission(resourceManager, 'verify:reports')).toBe(false);
  });

  it('RESOURCE_MANAGER_NATIONAL cannot approve incidents', () => {
    expect(hasPermission(resourceManager, 'approve:incidents')).toBe(false);
  });

  // System Admin permissions
  it('SYSTEM_ADMIN can manage users', () => {
    expect(hasPermission(systemAdmin, 'manage:users')).toBe(true);
  });

  it('SYSTEM_ADMIN can manage settings', () => {
    expect(hasPermission(systemAdmin, 'manage:settings')).toBe(true);
  });

  it('SYSTEM_ADMIN cannot verify reports (not their role)', () => {
    expect(hasPermission(systemAdmin, 'verify:reports')).toBe(false);
  });

  it('SYSTEM_ADMIN cannot approve incidents (not their role)', () => {
    expect(hasPermission(systemAdmin, 'approve:incidents')).toBe(false);
  });

  // Public User permissions
  it('PUBLIC_USER cannot view dashboard', () => {
    expect(hasPermission(publicUser, 'view:dashboard')).toBe(false);
  });

  it('PUBLIC_USER cannot verify reports', () => {
    expect(hasPermission(publicUser, 'verify:reports')).toBe(false);
  });

  it('PUBLIC_USER can view public alerts', () => {
    expect(hasPermission(publicUser, 'view:public-alerts')).toBe(true);
  });

  it('PUBLIC_USER can create a public report', () => {
    expect(hasPermission(publicUser, 'create:public-report')).toBe(true);
  });
});

describe('hasRole', () => {
  it('returns false when user is null', () => {
    expect(hasRole(null, UserRole.OPERATIONS_OFFICER_ZONAL)).toBe(false);
  });

  it('INCIDENT_COMMANDER_NATIONAL matches its own role', () => {
    expect(hasRole(incidentCommander, UserRole.INCIDENT_COMMANDER_NATIONAL)).toBe(true);
  });

  it('INCIDENT_COMMANDER_NATIONAL does not match RESOURCE_MANAGER_NATIONAL', () => {
    expect(hasRole(incidentCommander, UserRole.RESOURCE_MANAGER_NATIONAL)).toBe(false);
  });

  it('OPERATIONS_OFFICER_ZONAL matches its own role', () => {
    expect(hasRole(opsOfficer, UserRole.OPERATIONS_OFFICER_ZONAL)).toBe(true);
  });

  it('OPERATIONS_OFFICER_ZONAL does not match OPERATIONS_OFFICER_NATIONAL', () => {
    expect(hasRole(opsOfficer, UserRole.OPERATIONS_OFFICER_NATIONAL)).toBe(false);
  });

  it('RESOURCE_MANAGER_NATIONAL matches its own role', () => {
    expect(hasRole(resourceManager, UserRole.RESOURCE_MANAGER_NATIONAL)).toBe(true);
  });

  it('PUBLIC_USER does not match OPERATIONS_OFFICER_ZONAL', () => {
    expect(hasRole(publicUser, UserRole.OPERATIONS_OFFICER_ZONAL)).toBe(false);
  });

  it('SYSTEM_ADMIN matches its own role', () => {
    expect(hasRole(systemAdmin, UserRole.SYSTEM_ADMIN)).toBe(true);
  });
});
