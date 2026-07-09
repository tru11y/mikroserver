'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { hasPermission, isAdminUser } from '@/lib/permissions';

export interface Session {
  id: string;
  routerId: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  routerName?: string;
  connectedAt: string | null;
  expiresAt: string | null;
  planName: string | null;
}

export interface RouterError {
  routerId: string;
  routerName: string;
  error: string;
}

export interface SessionsResponse {
  items: Session[];
  routerErrors: RouterError[];
  totalRouters: number;
  respondingRouters: number;
}

export type SortCol = 'uptime' | 'bytesIn' | 'bytesOut';
export type SortDir = 'asc' | 'desc';

export function useSessionsPage() {
  const queryClient = useQueryClient();

  const [routerId, setRouterId] = useState<string | undefined>();
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<Session | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>('uptime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canAdminDeleteTicket =
    isAdminUser(currentUser) && hasPermission(currentUser, 'tickets.delete');

  const { data: routersData } = useQuery({
    queryKey: ['routers'],
    queryFn: () => api.routers.list(),
  });
  const routers = routersData ? unwrap<{ id: string; name: string }[]>(routersData) : [];

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessions', routerId],
    queryFn: () => api.sessions.active(routerId),
    refetchInterval: 10_000,
  });

  const raw: SessionsResponse = (data ? unwrap<SessionsResponse>(data) : null) ?? {
    items: [],
    routerErrors: [],
    totalRouters: 0,
    respondingRouters: 0,
  };

  const sessions = useMemo<Session[]>(() => {
    const items = [...(raw.items ?? [])];
    return items.sort((a, b) => {
      let diff = 0;
      if (sortCol === 'bytesIn') diff = a.bytesIn - b.bytesIn;
      else if (sortCol === 'bytesOut') diff = a.bytesOut - b.bytesOut;
      else diff = a.uptime.localeCompare(b.uptime);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [raw.items, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const terminateMutation = useMutation({
    mutationFn: (session: Session) => api.sessions.terminate(session.routerId, session.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['router-live'] });
    },
    onError: () => toast.error('Impossible de couper la session.'),
    onSettled: () => setTerminatingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (session: Session) =>
      api.vouchers.deleteVerified(session.username, undefined, session.routerId),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
        queryClient.invalidateQueries({ queryKey: ['router-live'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
      ]);
      toast.success(
        (response ? unwrap<{ message?: string }>(response) : undefined)?.message ??
          'Ticket supprimé définitivement.',
      );
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Suppression permanente impossible.';
      toast.error(msg);
    },
    onSettled: () => {
      setDeletingId(null);
      setConfirmDeleteSession(null);
    },
  });

  const isExpiringSoon = (iso: string | null) =>
    iso ? new Date(iso).getTime() - Date.now() < 5 * 60_000 : false;

  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : 'Impossible de charger les sessions actives.'
    : null;

  return {
    sessions,
    routerErrors: raw.routerErrors ?? [],
    totalRouters: raw.totalRouters,
    respondingRouters: raw.respondingRouters,
    routers,
    routerId,
    setRouterId,
    isLoading,
    isFetching,
    errorMessage,
    refetch,
    canAdminDeleteTicket,
    terminatingId,
    setTerminatingId,
    deletingId,
    setDeletingId,
    confirmDeleteSession,
    setConfirmDeleteSession,
    terminateMutation,
    deleteMutation,
    isExpiringSoon,
    sortCol,
    sortDir,
    toggleSort,
  };
}
