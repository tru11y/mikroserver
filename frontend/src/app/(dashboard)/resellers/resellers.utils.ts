import type { FormData, PermissionOptions, ProfileFormData, Reseller } from './resellers.types';

export const statusConfig = {
  ACTIVE: {
    label: 'Actif',
    cls: 'bg-success/10 text-success border border-success/20',
  },
  SUSPENDED: {
    label: 'Suspendu',
    cls: 'bg-destructive/10 text-destructive border border-destructive/20',
  },
  PENDING_VERIFICATION: {
    label: 'En attente',
    cls: 'bg-warning/10 text-warning border border-warning/20',
  },
};

export const CUSTOM_PROFILE_KEY = '__CUSTOM__';

export const emptyForm: FormData = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  phone: '',
  role: 'RESELLER',
  permissionProfile: 'RESELLER_STANDARD',
};

export const emptyProfileForm: ProfileFormData = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  password: '',
};

export const defaultPermissionProfileByRole: Record<FormData['role'], string> = {
  ADMIN: 'ADMIN_STANDARD',
  RESELLER: 'RESELLER_STANDARD',
  VIEWER: 'READ_ONLY',
};

export const emptyPermissionOptions: PermissionOptions = {
  groups: [],
  profiles: [],
};

export function buildProfileLabel(profile: string | null, overrides: string[]): string {
  if (!profile && overrides.length > 0) {
    return 'Personnalise';
  }

  if (!profile) {
    return 'Par defaut';
  }

  return profile
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getQueryErrorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }
  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(', ');
  }

  const nativeMessage = (error as { message?: unknown })?.message;
  if (typeof nativeMessage === 'string' && nativeMessage.trim()) {
    return nativeMessage;
  }

  return fallback;
}

export function filterResellers(
  users: Reseller[],
  roleFilter: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER',
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION',
  searchFilter: string,
) {
  const needle = searchFilter.trim().toLowerCase();

  return users.filter((user) => {
    const matchesRole = roleFilter === 'ALL' ? true : user.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' ? true : user.status === statusFilter;
    const matchesSearch =
      !needle ||
      [
        user.firstName,
        user.lastName,
        user.email,
        user.phone ?? '',
        user.role,
        buildProfileLabel(user.permissionProfile, user.permissionOverrides),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);

    return matchesRole && matchesStatus && matchesSearch;
  });
}

export function getRoleLabel(role: Reseller['role']) {
  if (role === 'SUPER_ADMIN') {
    return 'Super Admin';
  }
  if (role === 'ADMIN') {
    return 'Admin';
  }
  if (role === 'RESELLER') {
    return 'Revendeur';
  }
  return 'Lecture';
}

export function getUserInitials(user: Pick<Reseller, 'firstName' | 'lastName'>) {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
}

export function formatResellerDateTime(value: string | null) {
  if (!value) {
    return 'Jamais';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatResellerDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}
