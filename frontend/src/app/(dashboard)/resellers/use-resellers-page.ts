'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import type {
  FormData,
  PermissionOptions,
  ProfileFormData,
  Reseller,
} from './resellers.types';
import {
  CUSTOM_PROFILE_KEY,
  defaultPermissionProfileByRole,
  emptyForm,
  emptyPermissionOptions,
  emptyProfileForm,
  filterResellers,
  getQueryErrorMessage,
} from './resellers.utils';

export function useResellersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [accessTarget, setAccessTarget] = useState<Reseller | null>(null);
  const [accessProfile, setAccessProfile] = useState<string>(CUSTOM_PROFILE_KEY);
  const [accessPermissions, setAccessPermissions] = useState<string[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [profileTarget, setProfileTarget] = useState<Reseller | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormData>(emptyProfileForm);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<
    'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'
  >('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const deferredSearchFilter = useDeferredValue(searchFilter);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewUsers = hasAnyPermission(currentUser, ['users.view', 'users.manage']);
  const canManageUsers = hasPermission(currentUser, 'users.manage');
  const canDeleteUsers = currentUser?.role === 'SUPER_ADMIN';

  const {
    data,
    isLoading,
    isError: usersError,
    error: usersQueryError,
  } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => api.users.list(),
    refetchInterval: 30_000,
    staleTime: 60_000,
    enabled: canViewUsers,
  });

  const {
    data: permissionOptionsData,
    isError: permissionOptionsError,
    error: permissionOptionsQueryError,
  } = useQuery({
    queryKey: ['users', 'permission-options'],
    queryFn: () => api.users.permissionOptions(),
    enabled: canManageUsers,
    staleTime: 5 * 60 * 1000,
  });

  const users = useMemo<Reseller[]>(
    () => ((data?.data?.data as Reseller[]) ?? []),
    [data],
  );
  const permissionOptions = useMemo<PermissionOptions>(
    () =>
      (permissionOptionsData ? unwrap<PermissionOptions>(permissionOptionsData) : undefined) ??
      emptyPermissionOptions,
    [permissionOptionsData],
  );

  const usersErrorMessage = usersError
    ? getQueryErrorMessage(
        usersQueryError,
        "Impossible de charger la liste des utilisateurs. Verifie les permissions 'users.view'.",
      )
    : null;

  const permissionOptionsErrorMessage =
    canManageUsers && permissionOptionsError
      ? getQueryErrorMessage(
          permissionOptionsQueryError,
          "Impossible de charger les profils d'acces. Verifie la permission 'users.manage'.",
        )
      : null;

  const createMutation = useMutation({
    mutationFn: () =>
      api.users.create({
        ...form,
        permissionProfile: form.permissionProfile,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setFormError(e?.response?.data?.message ?? 'Erreur lors de la creation');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.users.suspend(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'list'] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.users.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'list'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setDeletingId(null);
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: () => {
      if (!accessTarget) {
        throw new Error('Aucun utilisateur selectionne');
      }

      return api.users.updateAccess(accessTarget.id, {
        permissionProfile: accessProfile === CUSTOM_PROFILE_KEY ? null : accessProfile,
        permissions: accessProfile === CUSTOM_PROFILE_KEY ? accessPermissions : [],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setAccessTarget(null);
      setAccessError(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setAccessError(e?.response?.data?.message ?? "Erreur lors de la mise a jour de l'acces");
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: () => {
      if (!profileTarget) {
        throw new Error('Aucun utilisateur selectionne');
      }

      return api.users.updateProfile(profileTarget.id, {
        email: profileForm.email,
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setProfileTarget(null);
      setProfileForm(emptyProfileForm);
      setProfileError(null);
      setPasswordError(null);
      setPasswordSuccess(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setProfileError(e?.response?.data?.message ?? 'Erreur lors de la mise a jour du profil');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => {
      if (!profileTarget) {
        throw new Error('Aucun utilisateur selectionne');
      }

      return api.users.resetPassword(profileTarget.id, {
        password: profileForm.password,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setPasswordError(null);
      setPasswordSuccess('Mot de passe reinitialise et sessions actives revoquees.');
      setProfileForm((current) => ({ ...current, password: '' }));
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setPasswordSuccess(null);
      setPasswordError(
        e?.response?.data?.message ?? 'Erreur lors de la reinitialisation du mot de passe',
      );
    },
  });

  const filteredUsers = useMemo(
    () => filterResellers(users, roleFilter, statusFilter, deferredSearchFilter),
    [deferredSearchFilter, roleFilter, statusFilter, users],
  );

  const activeCount = users.filter((user) => user.status === 'ACTIVE').length;
  const suspendedCount = users.filter((user) => user.status === 'SUSPENDED').length;
  const pendingCount = users.filter(
    (user) => user.status === 'PENDING_VERIFICATION',
  ).length;
  const recentlyActiveCount = users.filter((user) => {
    if (!user.lastLoginAt) return false;
    return Date.now() - new Date(user.lastLoginAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const openAccessModal = (reseller: Reseller) => {
    setAccessTarget(reseller);
    setAccessProfile(reseller.permissionProfile ?? CUSTOM_PROFILE_KEY);
    setAccessPermissions(
      reseller.permissionOverrides?.length
        ? reseller.permissionOverrides
        : reseller.permissions ?? [],
    );
    setAccessError(null);
  };

  const openProfileModal = (reseller: Reseller) => {
    setProfileTarget(reseller);
    setProfileForm({
      email: reseller.email,
      firstName: reseller.firstName,
      lastName: reseller.lastName,
      phone: reseller.phone ?? '',
      password: '',
    });
    setProfileError(null);
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const closeProfileModal = () => {
    setProfileTarget(null);
    setProfileForm(emptyProfileForm);
    setProfileError(null);
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const handleProfileChange = (profileKey: string) => {
    setAccessProfile(profileKey);
    if (profileKey === CUSTOM_PROFILE_KEY) {
      return;
    }

    const profile = permissionOptions.profiles.find((item) => item.key === profileKey);
    setAccessPermissions(profile?.permissions ?? []);
  };

  const togglePermission = (permission: string) => {
    setAccessProfile(CUSTOM_PROFILE_KEY);
    setAccessPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission].sort(),
    );
  };

  return {
    currentUser,
    isMeLoading,
    canViewUsers,
    canManageUsers,
    canDeleteUsers,
    users,
    filteredUsers,
    activeCount,
    suspendedCount,
    pendingCount,
    recentlyActiveCount,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    searchFilter,
    setSearchFilter,
    showForm,
    setShowForm,
    form,
    setForm,
    formError,
    setFormError,
    deletingId,
    setDeletingId,
    accessTarget,
    setAccessTarget,
    accessProfile,
    accessPermissions,
    accessError,
    setAccessError,
    profileTarget,
    profileForm,
    setProfileForm,
    profileError,
    passwordError,
    passwordSuccess,
    permissionOptions,
    usersErrorMessage,
    permissionOptionsErrorMessage,
    isLoading,
    usersError,
    createMutation,
    suspendMutation,
    activateMutation,
    deleteMutation,
    updateAccessMutation,
    updateProfileMutation,
    resetPasswordMutation,
    openAccessModal,
    openProfileModal,
    closeProfileModal,
    handleProfileChange,
    togglePermission,
    defaultPermissionProfileByRole,
  };
}
