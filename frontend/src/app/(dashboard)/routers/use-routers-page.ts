'use client';

import { FormEvent, useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { triggerWgBootstrap } from './router-wg-bootstrap';
import type { BulkAction, RouterFormState, RouterItem, RouterStatus } from './routers.types';
import {
  EMPTY_FORM,
  STATUS_PRIORITY,
  getQueryErrorMessage,
  parseTags,
  toFormState,
} from './routers.utils';

export function useRoutersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'ALL' | RouterStatus>('ALL');
  const [siteFilter, setSiteFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRouter, setEditingRouter] = useState<RouterItem | null>(null);
  const [formState, setFormState] = useState<RouterFormState>(EMPTY_FORM);
  const [busyRouterId, setBusyRouterId] = useState<string | null>(null);
  const deferredSearchFilter = useDeferredValue(searchFilter);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewRouters = hasPermission(currentUser, 'routers.view');
  const canManageRouters = hasPermission(currentUser, 'routers.manage');
  const canRunHealthCheck = hasPermission(currentUser, 'routers.health_check');
  const canSyncRouters = hasPermission(currentUser, 'routers.sync');

  // Always fetch full fleet — filtering is done client-side to keep global summary accurate
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['routers'],
    queryFn: () => api.routers.list({}),
    enabled: canViewRouters,
  });

  const allRouters = useMemo<RouterItem[]>(() => {
    const raw = data ? unwrap<RouterItem[]>(data) : [];
    return [...raw].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  }, [data]);

  const routers = useMemo<RouterItem[]>(() => {
    let result = allRouters;

    if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (siteFilter) {
      result = result.filter((r) => r.site === siteFilter);
    }
    if (tagFilter) {
      result = result.filter((r) => r.tags.includes(tagFilter));
    }
    if (deferredSearchFilter.trim()) {
      const q = deferredSearchFilter.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.wireguardIp?.includes(q) ?? false) ||
          (r.site?.toLowerCase().includes(q) ?? false) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [allRouters, statusFilter, siteFilter, tagFilter, deferredSearchFilter]);

  const routersErrorMessage = isError
    ? getQueryErrorMessage(error, 'Impossible de charger la flotte de routeurs.')
    : null;

  const siteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRouters
            .map((r) => r.site?.trim())
            .filter((s): s is string => Boolean(s)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allRouters],
  );

  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set(allRouters.flatMap((r) => (Array.isArray(r.tags) ? r.tags : []))),
      ).sort((a, b) => a.localeCompare(b)),
    [allRouters],
  );

  // Summary always reflects the full unfiltered fleet
  const summary = useMemo(() => {
    const online = allRouters.filter((r) => r.status === 'ONLINE').length;
    const degraded = allRouters.filter((r) => r.status === 'DEGRADED').length;
    const offline = allRouters.filter((r) => r.status === 'OFFLINE').length;
    const maintenance = allRouters.filter((r) => r.status === 'MAINTENANCE').length;

    return {
      total: allRouters.length,
      online,
      degraded,
      offline,
      maintenance,
      sites: siteOptions.length,
    };
  }, [allRouters, siteOptions.length]);

  const hasActiveFilters = Boolean(
    deferredSearchFilter.trim() || siteFilter || tagFilter || statusFilter !== 'ALL',
  );

  const openCreateForm = () => {
    setEditingRouter(null);
    setFormState(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEditForm = (router: RouterItem) => {
    setEditingRouter(router);
    setFormState(toFormState(router));
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingRouter(null);
    setFormState(EMPTY_FORM);
    setIsFormOpen(false);
  };

  const invalidateRouters = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['routers'] }),
      queryClient.invalidateQueries({ queryKey: ['router'] }),
      queryClient.invalidateQueries({ queryKey: ['metrics'] }),
      queryClient.invalidateQueries({ queryKey: ['incidents'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: RouterFormState) => {
      const body = {
        name: payload.name.trim(),
        description: payload.description.trim() || undefined,
        location: payload.location.trim() || undefined,
        site: payload.site.trim() || undefined,
        tags: parseTags(payload.tags),
        wireguardIp: payload.wireguardIp.trim() || undefined,
        apiPort: Number(payload.apiPort || '8728'),
        apiUsername: payload.apiUsername.trim(),
        apiPassword: payload.apiPassword.trim() || undefined,
        hotspotProfile: payload.hotspotProfile.trim() || undefined,
        hotspotServer: payload.hotspotServer.trim() || undefined,
        ownerId: payload.ownerId.trim() || undefined,
      };

      if (editingRouter) {
        if (!body.apiPassword) {
          delete (body as { apiPassword?: string }).apiPassword;
        }
        return api.routers.update(editingRouter.id, body);
      }

      if (!body.apiPassword) {
        throw new Error('Le mot de passe API est obligatoire pour un nouveau routeur.');
      }

      return api.routers.create(body);
    },
    onSuccess: async (response) => {
      const wasCreating = !editingRouter;
      // Capture credentials before closeForm resets formState
      const capturedUsername = formState.apiUsername;
      const capturedPassword = formState.apiPassword;

      await invalidateRouters();
      closeForm();
      toast.success(editingRouter ? 'Routeur mis à jour.' : 'Routeur ajouté — configuration WireGuard en cours...');

      if (wasCreating && response) {
        const created = unwrap<{ id: string }>(response);
        if (created?.id) {
          void triggerWgBootstrap(created.id, capturedUsername, capturedPassword);
        }
      }
    },
    onError: (queryError: unknown) => {
      toast.error(
        getQueryErrorMessage(queryError, 'Enregistrement impossible pour ce routeur.'),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (routerId: string) => api.routers.remove(routerId),
    onSuccess: async () => {
      await invalidateRouters();
      toast.success('Routeur supprimé.');
    },
    onError: (queryError: unknown) => {
      toast.error(getQueryErrorMessage(queryError, 'Suppression impossible.'));
    },
    onSettled: () => setBusyRouterId(null),
  });

  const routerActionMutation = useMutation({
    mutationFn: async ({ router, action }: { router: RouterItem; action: BulkAction }) => {
      setBusyRouterId(router.id);

      if (action === 'HEALTH_CHECK') return api.routers.healthCheck(router.id);
      if (action === 'SYNC') return api.routers.sync(router.id);
      return api.routers.bulkAction([router.id], action);
    },
    onSuccess: async (_response, variables) => {
      await invalidateRouters();

      const messages: Record<BulkAction, string> = {
        HEALTH_CHECK:        'Health-check terminé.',
        SYNC:                'Synchronisation routeur terminée.',
        ENABLE_MAINTENANCE:  'Routeur passé en maintenance.',
        DISABLE_MAINTENANCE: 'Routeur retiré de la maintenance.',
      };

      toast.success(messages[variables.action]);
    },
    onError: (queryError: unknown) => {
      toast.error(getQueryErrorMessage(queryError, 'Action routeur impossible.'));
    },
    onSettled: () => setBusyRouterId(null),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, routerIds }: { action: BulkAction; routerIds: string[] }) =>
      api.routers.bulkAction(routerIds, action),
    onSuccess: async (response, variables) => {
      await invalidateRouters();

      const result = response
        ? unwrap<{ processedCount?: number; failedCount?: number }>(response)
        : undefined;
      const processedCount = result?.processedCount ?? variables.routerIds.length;
      const failedCount = result?.failedCount ?? 0;

      toast.success(
        `${processedCount} routeur(s) traité(s)${failedCount ? `, ${failedCount} en échec` : ''}.`,
      );

      if (!failedCount) setSelectedIds([]);
    },
    onError: (queryError: unknown) => {
      toast.error(getQueryErrorMessage(queryError, 'Action de masse impossible.'));
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(formState);
  };

  const toggleSelection = (routerId: string) => {
    setSelectedIds((current) =>
      current.includes(routerId)
        ? current.filter((id) => id !== routerId)
        : [...current, routerId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === routers.length && routers.length > 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(routers.map((r) => r.id));
  };

  const runBulkAction = (action: BulkAction) => {
    if (validSelectedIds.length === 0) {
      toast.error('Sélectionne au moins un routeur.');
      return;
    }
    bulkMutation.mutate({ action, routerIds: validSelectedIds });
  };

  // IDs that still exist in the full fleet (survives filter changes)
  const validSelectedIds = useMemo(
    () => selectedIds.filter((id) => allRouters.some((r) => r.id === id)),
    [selectedIds, allRouters],
  );

  // Status of selected routers — drives bulk maintenance UX
  const selectedStatuses = useMemo<RouterStatus[]>(
    () =>
      validSelectedIds
        .map((id) => allRouters.find((r) => r.id === id)?.status)
        .filter((s): s is RouterStatus => Boolean(s)),
    [validSelectedIds, allRouters],
  );

  return {
    currentUser,
    isMeLoading,
    canViewRouters,
    canManageRouters,
    canRunHealthCheck,
    canSyncRouters,
    routers,
    summary,
    siteOptions,
    tagOptions,
    routersErrorMessage,
    isLoading,
    isRefetching,
    statusFilter,
    setStatusFilter,
    siteFilter,
    setSiteFilter,
    tagFilter,
    setTagFilter,
    searchFilter,
    setSearchFilter,
    selectedIds: validSelectedIds,
    selectedStatuses,
    isFormOpen,
    editingRouter,
    formState,
    setFormState,
    busyRouterId,
    hasActiveFilters,
    refetch,
    openCreateForm,
    openEditForm,
    closeForm,
    handleSubmit,
    toggleSelection,
    toggleSelectAll,
    runBulkAction,
    saveMutation,
    deleteMutation,
    routerActionMutation,
    bulkMutation,
    setBusyRouterId,
  };
}
