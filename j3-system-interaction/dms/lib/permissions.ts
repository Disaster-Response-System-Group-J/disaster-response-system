import { User, UserRole, ROLE_PERMISSIONS } from '@/types';

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function hasRole(user: User | null, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}
