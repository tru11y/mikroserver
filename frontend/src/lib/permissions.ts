export interface PermissionAwareUser {
  role?: string | null;
  permissions?: string[] | null;
}

export function isAdminUser(
  user: PermissionAwareUser | null | undefined,
): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}

export function hasPermission(
  user: PermissionAwareUser | null | undefined,
  permission: string,
): boolean {
  if (!user) {
    return false;
  }

  if (user.role === 'SUPER_ADMIN') {
    return true;
  }

  return Array.isArray(user.permissions)
    ? user.permissions.includes(permission)
    : false;
}

export function hasAnyPermission(
  user: PermissionAwareUser | null | undefined,
  permissions: string[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}
