'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { HotspotIpBinding, IpBindingType } from './router-detail.types';
import {
  buildCreateHotspotIpBindingPayload,
  buildUpdateHotspotIpBindingPayload,
  createEmptyHotspotIpBindingForm,
  createHotspotIpBindingFormFromBinding,
  hasHotspotIpBindingIdentity,
  type HotspotIpBindingFormValues,
} from './hotspot-ip-binding.forms';

interface UseHotspotIpBindingsManagementOptions {
  id: string;
  routerHotspotServer?: string;
}

export function useHotspotIpBindingsManagement({
  id,
  routerHotspotServer,
}: UseHotspotIpBindingsManagementOptions) {
  const queryClient = useQueryClient();

  const [ipBindingTarget, setIpBindingTarget] = useState<HotspotIpBinding | null>(
    null,
  );
  const [editIpBindingForm, setEditIpBindingForm] = useState<HotspotIpBindingFormValues>(
    () => createEmptyHotspotIpBindingForm(),
  );
  const [ipBindingActionId, setIpBindingActionId] = useState<string | null>(null);

  const [isCreateIpBindingOpen, setIsCreateIpBindingOpen] = useState(false);
  const [createIpBindingForm, setCreateIpBindingForm] =
    useState<HotspotIpBindingFormValues>(() =>
      createEmptyHotspotIpBindingForm(routerHotspotServer ?? ''),
    );

  const invalidateHotspotBindings = () =>
    queryClient.invalidateQueries({ queryKey: ['router-hotspot-bindings', id] });

  const setEditIpBindingField = <K extends keyof HotspotIpBindingFormValues>(
    field: K,
    value: HotspotIpBindingFormValues[K],
  ) => {
    setEditIpBindingForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const setCreateIpBindingField = <K extends keyof HotspotIpBindingFormValues>(
    field: K,
    value: HotspotIpBindingFormValues[K],
  ) => {
    setCreateIpBindingForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openEditIpBindingModal = (binding: HotspotIpBinding) => {
    setIpBindingTarget(binding);
    setEditIpBindingForm(createHotspotIpBindingFormFromBinding(binding));
  };

  const closeIpBindingModal = () => {
    setIpBindingTarget(null);
    setEditIpBindingForm(createEmptyHotspotIpBindingForm());
    setIpBindingActionId(null);
  };

  const openCreateIpBindingModal = () => {
    setCreateIpBindingForm(
      createEmptyHotspotIpBindingForm(routerHotspotServer ?? ''),
    );
    setIsCreateIpBindingOpen(true);
  };

  const closeCreateIpBindingModal = () => {
    setIsCreateIpBindingOpen(false);
    setCreateIpBindingForm(createEmptyHotspotIpBindingForm());
  };

  const updateIpBindingMutation = useMutation({
    mutationFn: () => {
      if (!ipBindingTarget) {
        throw new Error('Aucun IP binding selectionne');
      }

      return api.routers.updateIpBinding(
        id,
        ipBindingTarget.id,
        buildUpdateHotspotIpBindingPayload(editIpBindingForm),
      );
    },
    onSuccess: async () => {
      await invalidateHotspotBindings();
      toast.success('IP binding mis a jour avec succes.');
      closeIpBindingModal();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Mise a jour IP binding impossible',
      );
    },
  });

  const createIpBindingMutation = useMutation({
    mutationFn: () => {
      if (!hasHotspotIpBindingIdentity(createIpBindingForm)) {
        throw new Error('Renseigne au moins une adresse IP ou une adresse MAC');
      }

      return api.routers.createIpBinding(
        id,
        buildCreateHotspotIpBindingPayload(createIpBindingForm),
      );
    },
    onSuccess: async () => {
      await invalidateHotspotBindings();
      toast.success('IP binding cree avec succes.');
      closeCreateIpBindingModal();
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Creation IP binding impossible',
      );
    },
  });

  const toggleIpBindingBlockMutation = useMutation({
    mutationFn: ({ bindingId, block }: { bindingId: string; block: boolean }) =>
      block
        ? api.routers.blockIpBinding(id, bindingId)
        : api.routers.unblockIpBinding(id, bindingId),
    onSuccess: async (_response, variables) => {
      await invalidateHotspotBindings();
      toast.success(variables.block ? 'IP binding bloque.' : 'IP binding debloque.');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Impossible de modifier l etat bloque/debloque',
      );
    },
    onSettled: () => {
      setIpBindingActionId(null);
    },
  });

  const toggleIpBindingEnabledMutation = useMutation({
    mutationFn: ({
      bindingId,
      disabled,
    }: {
      bindingId: string;
      disabled: boolean;
    }) =>
      disabled
        ? api.routers.disableIpBinding(id, bindingId)
        : api.routers.enableIpBinding(id, bindingId),
    onSuccess: async (_response, variables) => {
      await invalidateHotspotBindings();
      toast.success(variables.disabled ? 'IP binding desactive.' : 'IP binding active.');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Impossible de modifier l etat active/desactive',
      );
    },
    onSettled: () => {
      setIpBindingActionId(null);
    },
  });

  const removeIpBindingMutation = useMutation({
    mutationFn: (bindingId: string) => api.routers.removeIpBinding(id, bindingId),
    onSuccess: async () => {
      await invalidateHotspotBindings();
      toast.success('IP binding supprime.');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Suppression IP binding impossible',
      );
    },
    onSettled: () => {
      setIpBindingActionId(null);
    },
  });

  return {
    ipBindingTarget,
    ipBindingType: editIpBindingForm.type,
    setIpBindingType: (value: IpBindingType) =>
      setEditIpBindingField('type', value),
    ipBindingServer: editIpBindingForm.server,
    setIpBindingServer: (value: string) =>
      setEditIpBindingField('server', value),
    ipBindingAddress: editIpBindingForm.address,
    setIpBindingAddress: (value: string) =>
      setEditIpBindingField('address', value),
    ipBindingMacAddress: editIpBindingForm.macAddress,
    setIpBindingMacAddress: (value: string) =>
      setEditIpBindingField('macAddress', value),
    ipBindingComment: editIpBindingForm.comment,
    setIpBindingComment: (value: string) =>
      setEditIpBindingField('comment', value),
    ipBindingToAddress: editIpBindingForm.toAddress,
    setIpBindingToAddress: (value: string) =>
      setEditIpBindingField('toAddress', value),
    ipBindingAddressList: editIpBindingForm.addressList,
    setIpBindingAddressList: (value: string) =>
      setEditIpBindingField('addressList', value),
    ipBindingDisabled: editIpBindingForm.disabled,
    setIpBindingDisabled: (value: boolean) =>
      setEditIpBindingField('disabled', value),
    ipBindingActionId,
    setIpBindingActionId,
    openEditIpBindingModal,
    closeIpBindingModal,
    isCreateIpBindingOpen,
    openCreateIpBindingModal,
    closeCreateIpBindingModal,
    newIpBindingServer: createIpBindingForm.server,
    setNewIpBindingServer: (value: string) =>
      setCreateIpBindingField('server', value),
    newIpBindingAddress: createIpBindingForm.address,
    setNewIpBindingAddress: (value: string) =>
      setCreateIpBindingField('address', value),
    newIpBindingMacAddress: createIpBindingForm.macAddress,
    setNewIpBindingMacAddress: (value: string) =>
      setCreateIpBindingField('macAddress', value),
    newIpBindingType: createIpBindingForm.type,
    setNewIpBindingType: (value: IpBindingType) =>
      setCreateIpBindingField('type', value),
    newIpBindingComment: createIpBindingForm.comment,
    setNewIpBindingComment: (value: string) =>
      setCreateIpBindingField('comment', value),
    newIpBindingToAddress: createIpBindingForm.toAddress,
    setNewIpBindingToAddress: (value: string) =>
      setCreateIpBindingField('toAddress', value),
    newIpBindingAddressList: createIpBindingForm.addressList,
    setNewIpBindingAddressList: (value: string) =>
      setCreateIpBindingField('addressList', value),
    newIpBindingDisabled: createIpBindingForm.disabled,
    setNewIpBindingDisabled: (value: boolean) =>
      setCreateIpBindingField('disabled', value),
    updateIpBindingMutation,
    createIpBindingMutation,
    toggleIpBindingBlockMutation,
    toggleIpBindingEnabledMutation,
    removeIpBindingMutation,
  };
}
