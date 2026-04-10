'use client';

import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { BulkAction, RouterFormState, RouterItem, RouterStatus } from './routers.types';
import {
  EMPTY_FORM,
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

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['routers', statusFilter, siteFilter, tagFilter, deferredSearchFilter],
    queryFn: () =>
      api.routers.list({
        status: statusFilter,
        site: siteFilter,
        tag: tagFilter,
        search: deferredSearchFilter,
      }),
    enabled: canViewRouters,
  });

  const routers = useMemo<RouterItem[]>(
    () => (data ? unwrap<RouterItem[]>(data) : []),
    [data],
  );

  const routersErrorMessage = isError
    ? getQueryErrorMessage(error, 'Impossible de charger la flotte de routeurs.')
    : null;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => routers.some((router) => router.id === id)));
  }, [routers]);

  const siteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          routers
            .map((router) => router.site?.trim())
            .filter((site): site is string => Boolean(site)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [routers],
  );

  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set(
          routers.flatMap((router) => (Array.isArray(router.tags) ? router.tags : [])),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [routers],
  );

  const summary = useMemo(() => {
    const online = routers.filter((router) => router.status === 'ONLINE').length;
    const degraded = routers.filter((router) => router.status === 'DEGRADED').length;
    const offline = routers.filter((router) => router.status === 'OFFLINE').length;
    const maintenance = routers.filter((router) => router.status === 'MAINTENANCE').length;

    return {
      total: routers.length,
      online,
      degraded,
      offline,
      maintenance,
      sites: siteOptions.length,
    };
  }, [routers, siteOptions.length]);

  const hasActiveFilters = Boolean(
    deferredSearchFilter.trim() || siteFilter.trim() || tagFilter.trim() || statusFilter !== 'ALL',
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
      await invalidateRouters();
      closeForm();
      toast.success(editingRouter ? 'Routeur mis a jour.' : 'Routeur ajoute — configuration WireGuard en cours...');

      if (wasCreating && response) {
        const created = unwrap<{ id: string }>(response);
        if (created?.id) {
          void triggerWgBootstrap(created.id);
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
      toast.success('Routeur supprime.');
    },
    onError: (queryError: unknown) => {
      toast.error(getQueryErrorMessage(queryError, 'Suppression impossible.'));
    },
    onSettled: () => setBusyRouterId(null),
  });

  const routerActionMutation = useMutation({
    mutationFn: async ({ router, action }: { router: RouterItem; action: BulkAction }) => {
      setBusyRouterId(router.id);

      if (action === 'HEALTH_CHECK') {
        return api.routers.healthCheck(router.id);
      }

      if (action === 'SYNC') {
        return api.routers.sync(router.id);
      }

      return api.routers.bulkAction([router.id], action);
    },
    onSuccess: async (_response, variables) => {
      await invalidateRouters();

      const messages: Record<BulkAction, string> = {
        HEALTH_CHECK: 'Health check termine.',
        SYNC: 'Synchronisation routeur terminee.',
        ENABLE_MAINTENANCE: 'Routeur passe en maintenance.',
        DISABLE_MAINTENANCE: 'Routeur retire de la maintenance.',
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

      const result = response ? unwrap<{ processedCount?: number; failedCount?: number }>(response) : undefined;
      const processedCount = result?.processedCount ?? variables.routerIds.length;
      const failedCount = result?.failedCount ?? 0;

      toast.success(
        `${processedCount} routeur(s) traite(s)${failedCount ? `, ${failedCount} en echec` : ''}.`,
      );

      if (!failedCount) {
        setSelectedIds([]);
      }
    },
    onError: (queryError: unknown) => {
      toast.error(getQueryErrorMessage(queryError, 'Action de masse impossible.'));
    },
  });

  const triggerWgBootstrap = async (routerId: string) => {
    try {
      const res = await api.routers.getBootstrap(routerId);
      const bootstrap = unwrap<{
        localIp: string | null;
        wgIp: string | null;
        privateKey: string | null;
        vpsPublicKey: string | null;
        endpoint: string | null;
        listenPort: number;
        tunnelReady: boolean;
        mikrotikCmd: string | null;
      }>(res);

      if (!bootstrap || bootstrap.tunnelReady) return;

      // Try pushing via MikroTik REST API (browser → local router)
      // This will fail with CORS/PNA in Chrome — we catch silently
      if (bootstrap.localIp && bootstrap.mikrotikCmd) {
        try {
          await fetch(`http://${bootstrap.localIp}/rest/system/script`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${btoa(`${formState.apiUsername}:${formState.apiPassword}`)}`,
            },
            body: JSON.stringify({
              name: 'wg-mks-bootstrap',
              source: bootstrap.mikrotikCmd,
            }),
            signal: AbortSignal.timeout(5000),
          });
          // If somehow it works (no CORS block), also run the script
          await fetch(`http://${bootstrap.localIp}/rest/system/script/wg-mks-bootstrap/run`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${formState.apiUsername}:${formState.apiPassword}`)}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          toast.success('Configuration WireGuard envoyée au routeur.');
          return;
        } catch {
          // Expected — CORS/PNA blocks this in Chrome
        }
      }

      // Fallback: show persistent toast with copy button
      if (bootstrap.mikrotikCmd) {
        const cmd = bootstrap.mikrotikCmd;
        toast('Tunnel WireGuard en attente', {
          description: `Copiez la commande dans le terminal Winbox ou WebFig du routeur (${bootstrap.localIp ?? ''}).`,
          duration: 30000,
          action: {
            label: 'Copier la commande',
            onClick: () => void navigator.clipboard.writeText(cmd),
          },
        });
      }
    } catch {
      // Bootstrap fetch failed — not critical, router will remain pending
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate(formState);
  };

  const toggleSelection = (routerId: string) => {
    setSelectedIds((current) =>
      current.includes(routerId) ? current.filter((id) => id !== routerId) : [...current, routerId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === routers.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(routers.map((router) => router.id));
  };

  const runBulkAction = (action: BulkAction) => {
    if (selectedIds.length === 0) {
      toast.error('Selectionne au moins un routeur.');
      return;
    }

    bulkMutation.mutate({ action, routerIds: selectedIds });
  };

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
    selectedIds,
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
