'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from 'sonner';
import type { HotspotUserRow } from './router-detail.types';
import { normalizeProfileName } from './router-detail.utils';

interface UseHotspotProfileChangeOptions {
  id: string;
  availableHotspotProfileNames: string[];
}

export function useHotspotProfileChange({
  id,
  availableHotspotProfileNames,
}: UseHotspotProfileChangeOptions) {
  const queryClient = useQueryClient();

  const [profileTarget, setProfileTarget] = useState<HotspotUserRow | null>(null);
  const [nextProfile, setNextProfile] = useState('');
  const [disconnectActiveOnProfileChange, setDisconnectActiveOnProfileChange] =
    useState(false);

  useEffect(() => {
    if (!profileTarget || nextProfile.trim().length > 0) {
      return;
    }

    const fallbackProfile =
      profileTarget.profile ?? availableHotspotProfileNames[0] ?? '';
    if (fallbackProfile) {
      setNextProfile(fallbackProfile);
    }
  }, [availableHotspotProfileNames, nextProfile, profileTarget]);

  const openProfileChangeModal = (user: HotspotUserRow) => {
    setProfileTarget(user);
    setNextProfile(user.profile ?? availableHotspotProfileNames[0] ?? '');
    setDisconnectActiveOnProfileChange(Boolean(user.active));
  };

  const closeProfileChangeModal = () => {
    setProfileTarget(null);
    setNextProfile('');
    setDisconnectActiveOnProfileChange(false);
  };

  const updateHotspotProfileMutation = useMutation({
    mutationFn: () => {
      if (!profileTarget) {
        throw new Error('Aucun utilisateur hotspot selectionne');
      }

      const targetProfile = nextProfile.trim();
      if (!targetProfile) {
        throw new Error('Profil hotspot manquant');
      }

      if (
        normalizeProfileName(profileTarget.profile) ===
        normalizeProfileName(targetProfile)
      ) {
        throw new Error('Selectionne un profil different du profil actuel');
      }

      return api.routers.updateHotspotUserProfile(id, {
        userId: profileTarget.id,
        profile: targetProfile,
        disconnectActive: disconnectActiveOnProfileChange,
      });
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['router-hotspot-users', id] }),
        queryClient.invalidateQueries({ queryKey: ['router-live', id] }),
      ]);
      const data = response ? unwrap<{ disconnectedSessions?: number }>(response) : undefined;
      toast.success(
        data?.disconnectedSessions > 0
          ? `Profil mis a jour. ${data.disconnectedSessions} session(s) active(s) ont ete coupees.`
          : 'Profil hotspot mis a jour avec succes.',
      );
      closeProfileChangeModal();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Mise a jour du profil hotspot impossible',
      );
    },
  });

  return {
    profileTarget,
    nextProfile,
    setNextProfile,
    disconnectActiveOnProfileChange,
    setDisconnectActiveOnProfileChange,
    openProfileChangeModal,
    closeProfileChangeModal,
    updateHotspotProfileMutation,
  };
}
