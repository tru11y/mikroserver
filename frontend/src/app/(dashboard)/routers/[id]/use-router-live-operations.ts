'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from 'sonner';
import { sortLiveClients, type LiveClientSortColumn, type LiveClientWithHotspotMeta, type SortDirection } from './router-detail.selectors';
import type { SyncSummary } from './router-detail.types';

interface UseRouterLiveOperationsOptions {
  id: string;
  liveClients: LiveClientWithHotspotMeta[];
}

export function useRouterLiveOperations({
  id,
  liveClients,
}: UseRouterLiveOperationsOptions) {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<LiveClientSortColumn>('bytesIn');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const sortedClients = useMemo(
    () => sortLiveClients(liveClients, sortCol, sortDir),
    [liveClients, sortCol, sortDir],
  );

  const toggleSort = (col: LiveClientSortColumn) => {
    if (sortCol === col) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortCol(col);
    setSortDir('desc');
  };

  const syncMutation = useMutation({
    mutationFn: () => api.routers.sync(id),
    onSuccess: async (response) => {
      const summary = response ? unwrap<SyncSummary>(response) : undefined;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['router', id] }),
        queryClient.invalidateQueries({ queryKey: ['router-live', id] }),
        queryClient.invalidateQueries({ queryKey: ['router-hotspot-profiles', id] }),
        queryClient.invalidateQueries({ queryKey: ['router-hotspot-bindings', id] }),
        queryClient.invalidateQueries({ queryKey: ['router-hotspot-users', id] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
      ]);
      toast.success(
        summary
          ? `Sync OK: ${summary.activeClients} client(s), ${summary.matchedVouchers} ticket(s) apparié(s)`
          : 'Synchronisation terminée',
      );
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Synchronisation impossible');
    },
  });

  const healthCheck = async () => {
    if (!id) {
      toast.error('Identifiant routeur introuvable.');
      return;
    }

    setIsChecking(true);
    try {
      const response = await api.routers.healthCheck(id);
      const result = response ? unwrap<{ online?: boolean; error?: string }>(response) : undefined;
      await queryClient.invalidateQueries({ queryKey: ['router', id] });
      if (result?.online) {
        toast.success('Routeur joignable via l’API MikroTik');
      } else {
        toast.error(result?.error || 'Connexion API MikroTik impossible');
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Health check routeur impossible',
      );
    } finally {
      setIsChecking(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: (mikrotikId: string) => api.sessions.terminate(id, mikrotikId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['router-live', id] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      ]);
      toast.success('Session coupee avec succes.');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Coupure de session impossible',
      );
    },
    onSettled: () => setDisconnectingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (username: string) => api.vouchers.deleteVerified(username, undefined, id),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['router-live', id] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
      ]);
      toast.success(
        (response ? unwrap<{ message?: string }>(response) : undefined)?.message ??
          'Ticket supprimé définitivement.',
      );
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          'Suppression permanente impossible.',
      );
    },
  });

  const disconnectExpiredMutation = useMutation({
    mutationFn: () => api.routers.disconnectExpired(id),
    onSuccess: async (response) => {
      const result = response?.data?.data as { disconnected: number; usernames: string[] } | undefined;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['router-live', id] }),
        queryClient.invalidateQueries({ queryKey: ['router-hotspot-users', id] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      ]);
      toast.success(
        result
          ? `${result.disconnected} session(s) expirée(s) déconnectée(s)`
          : 'Sessions expirées purgées',
      );
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ?? error?.message ?? 'Purge des expirés impossible',
      );
    },
  });

  return {
    isChecking,
    disconnectingId,
    setDisconnectingId,
    sortCol,
    sortDir,
    sortedClients,
    toggleSort,
    syncMutation,
    healthCheck,
    disconnectMutation,
    deleteMutation,
    disconnectExpiredMutation,
  };
}
