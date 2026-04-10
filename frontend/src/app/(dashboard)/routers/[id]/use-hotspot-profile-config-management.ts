'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { HotspotProfile } from './router-detail.types';
import { parseOptionalPositiveInteger } from './router-detail.utils';

interface UseHotspotProfileConfigManagementOptions {
  id: string;
}

/** Parse "rx/tx" or "rx" into separate parts. */
function splitRateLimit(rateLimit: string | null | undefined): { rx: string; tx: string } {
  if (!rateLimit) return { rx: '', tx: '' };
  const parts = rateLimit.trim().split('/');
  return { rx: parts[0]?.trim() ?? '', tx: parts[1]?.trim() ?? '' };
}

/** Compose rx + tx into MikroTik rate-limit string. Empty string if both empty. */
function buildRateLimit(rx: string, tx: string): string {
  const r = rx.trim();
  const t = tx.trim();
  if (!r && !t) return '';
  if (!t) return r;
  return `${r}/${t}`;
}

export function useHotspotProfileConfigManagement({
  id,
}: UseHotspotProfileConfigManagementOptions) {
  const queryClient = useQueryClient();

  const [profileConfigTarget, setProfileConfigTarget] = useState<HotspotProfile | null>(null);
  const [profileConfigName, setProfileConfigName] = useState('');
  const [profileConfigRateRx, setProfileConfigRateRx] = useState('');
  const [profileConfigRateTx, setProfileConfigRateTx] = useState('');
  const [profileConfigSharedUsers, setProfileConfigSharedUsers] = useState('');
  const [profileConfigSessionTimeout, setProfileConfigSessionTimeout] = useState('');
  const [profileConfigIdleTimeout, setProfileConfigIdleTimeout] = useState('');
  const [profileConfigKeepaliveTimeout, setProfileConfigKeepaliveTimeout] = useState('');
  const [profileConfigAddressPool, setProfileConfigAddressPool] = useState('');
  const [profileActionId, setProfileActionId] = useState<string | null>(null);
  const [isProfileConfigModalOpen, setIsProfileConfigModalOpen] = useState(false);

  const invalidateHotspotProfiles = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['router-hotspot-profiles', id] }),
      queryClient.invalidateQueries({ queryKey: ['router-hotspot-users', id] }),
      queryClient.invalidateQueries({ queryKey: ['router-plans-quick-list'] }),
    ]);

  const resetProfileConfigForm = () => {
    setProfileConfigTarget(null);
    setProfileConfigName('');
    setProfileConfigRateRx('');
    setProfileConfigRateTx('');
    setProfileConfigSharedUsers('');
    setProfileConfigSessionTimeout('');
    setProfileConfigIdleTimeout('');
    setProfileConfigKeepaliveTimeout('');
    setProfileConfigAddressPool('');
    setProfileActionId(null);
  };

  const openCreateProfileModal = () => {
    resetProfileConfigForm();
    setIsProfileConfigModalOpen(true);
  };

  const openEditProfileModal = (profile: HotspotProfile) => {
    const { rx, tx } = splitRateLimit(profile.rateLimit);
    setProfileConfigTarget(profile);
    setProfileConfigName(profile.name ?? '');
    setProfileConfigRateRx(rx);
    setProfileConfigRateTx(tx);
    setProfileConfigSharedUsers(
      profile.sharedUsers !== null && profile.sharedUsers !== undefined
        ? String(profile.sharedUsers)
        : '',
    );
    setProfileConfigSessionTimeout(profile.sessionTimeout ?? '');
    setProfileConfigIdleTimeout(profile.idleTimeout ?? '');
    setProfileConfigKeepaliveTimeout(profile.keepaliveTimeout ?? '');
    setProfileConfigAddressPool(profile.addressPool ?? '');
    setIsProfileConfigModalOpen(true);
  };

  const closeProfileConfigModal = () => {
    resetProfileConfigForm();
    setIsProfileConfigModalOpen(false);
  };

  const createHotspotProfileMutation = useMutation({
    mutationFn: () => {
      if (!profileConfigName.trim()) {
        throw new Error('Nom du profil requis');
      }
      const rateLimit = buildRateLimit(profileConfigRateRx, profileConfigRateTx);
      return api.routers.createHotspotProfile(id, {
        name: profileConfigName.trim(),
        rateLimit: rateLimit || undefined,
        sharedUsers: parseOptionalPositiveInteger(profileConfigSharedUsers),
        sessionTimeout: profileConfigSessionTimeout.trim() || undefined,
        idleTimeout: profileConfigIdleTimeout.trim() || undefined,
        keepaliveTimeout: profileConfigKeepaliveTimeout.trim() || undefined,
        addressPool: profileConfigAddressPool.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await invalidateHotspotProfiles();
      toast.success('Profil hotspot cree avec succes.');
      closeProfileConfigModal();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Creation du profil impossible',
      );
    },
  });

  const updateHotspotProfileConfigMutation = useMutation({
    mutationFn: () => {
      if (!profileConfigTarget) {
        throw new Error('Aucun profil cible');
      }
      const rateLimit = buildRateLimit(profileConfigRateRx, profileConfigRateTx);
      return api.routers.updateHotspotProfile(id, profileConfigTarget.id, {
        name: profileConfigName.trim() || undefined,
        rateLimit,
        sharedUsers: parseOptionalPositiveInteger(profileConfigSharedUsers),
        sessionTimeout: profileConfigSessionTimeout.trim(),
        idleTimeout: profileConfigIdleTimeout.trim(),
        keepaliveTimeout: profileConfigKeepaliveTimeout.trim(),
        addressPool: profileConfigAddressPool.trim(),
      });
    },
    onSuccess: async () => {
      await invalidateHotspotProfiles();
      toast.success('Profil hotspot mis a jour.');
      closeProfileConfigModal();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Mise a jour du profil hotspot impossible',
      );
    },
  });

  const removeHotspotProfileMutation = useMutation({
    mutationFn: (profileId: string) => api.routers.removeHotspotProfile(id, profileId),
    onSuccess: async () => {
      await invalidateHotspotProfiles();
      toast.success('Profil hotspot supprime.');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Suppression profil impossible',
      );
    },
    onSettled: () => {
      setProfileActionId(null);
    },
  });

  return {
    profileConfigTarget,
    profileConfigName,
    setProfileConfigName,
    profileConfigRateRx,
    setProfileConfigRateRx,
    profileConfigRateTx,
    setProfileConfigRateTx,
    profileConfigSharedUsers,
    setProfileConfigSharedUsers,
    profileConfigSessionTimeout,
    setProfileConfigSessionTimeout,
    profileConfigIdleTimeout,
    setProfileConfigIdleTimeout,
    profileConfigKeepaliveTimeout,
    setProfileConfigKeepaliveTimeout,
    profileConfigAddressPool,
    setProfileConfigAddressPool,
    profileActionId,
    setProfileActionId,
    isProfileConfigModalOpen,
    openCreateProfileModal,
    openEditProfileModal,
    closeProfileConfigModal,
    createHotspotProfileMutation,
    updateHotspotProfileConfigMutation,
    removeHotspotProfileMutation,
  };
}
