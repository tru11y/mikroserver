export interface Reseller {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  permissionProfile: string | null;
  permissionOverrides: string[];
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  group: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionDefinition[];
}

export interface PermissionProfile {
  key: string;
  label: string;
  description: string;
  permissions: string[];
}

export interface PermissionOptions {
  groups: PermissionGroup[];
  profiles: PermissionProfile[];
}

export type FormData = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
  role: 'ADMIN' | 'RESELLER' | 'VIEWER';
  permissionProfile: string;
  /** Optional: link to an existing user by ID instead of creating a new account */
  userId?: string;
};

export type ProfileFormData = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
};
