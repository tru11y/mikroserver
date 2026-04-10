'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission, isAdminUser } from '@/lib/permissions';
import { toast } from 'sonner';
import { Users, Wifi, RefreshCw, Ban, AlertTriangle, Trash2 } from 'lucide-react';

interface Session {
  id: string;
  routerId: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  routerName?: string;
}

interface RouterError {
  routerId: string;
  routerName: string;
  error: string;
}

interface SessionsResponse {
  items: Session[];
  routerErrors: RouterError[];
  totalRouters: number;
  respondingRouters: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function SessionsPage() {
  const [routerId, setRouterId] = useState<string | undefined>();
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions', routerId],
    queryFn: () => api.sessions.active(routerId),
    refetchInterval: 10_000,
  });

  const result: SessionsResponse = (data ? unwrap<SessionsResponse>(data) : null) ?? { items: [], routerErrors: [], totalRouters: 0, respondingRouters: 0 };
  const sessions = result.items ?? [];
  const routerErrors = result.routerErrors ?? [];

  const terminateMutation = useMutation({
    mutationFn: (session: Session) => api.sessions.terminate(session.routerId, session.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['router-live'] });
    },
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
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          'Suppression permanente impossible.',
      );
    },
    onSettled: () => setDeletingId(null),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions actives</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {sessions.length} client{sessions.length !== 1 ? 's' : ''} connecté{sessions.length !== 1 ? 's' : ''} · {result.respondingRouters}/{result.totalRouters} routeur{result.totalRouters > 1 ? 's' : ''} joignable{result.respondingRouters > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={routerId ?? ''}
            onChange={e => setRouterId(e.target.value || undefined)}
            className="flex-1 sm:flex-none rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les routeurs</option>
            {routers.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted transition-colors text-sm shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {routerErrors.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
          <div className="flex items-start gap-2 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">Certains routeurs n'ont pas répondu à la remontée des sessions</p>
              <div className="space-y-1 text-xs text-amber-100">
                {routerErrors.map((routerError) => (
                  <p key={routerError.routerId}>
                    {routerError.routerName}: {routerError.error}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium">Aucun client connecté</p>
            <p className="text-muted-foreground text-sm mt-1">Les sessions hotspot actives apparaîtront ici</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Utilisateur', 'IP / MAC', 'Routeur', 'Uptime', 'Download', 'Upload', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <span className="font-mono text-xs font-medium">{s.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-xs">{s.ipAddress}</p>
                    <p className="font-mono text-xs text-muted-foreground">{s.macAddress}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Wifi className="h-3 w-3" />{s.routerName ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap">{s.uptime}</td>
                  <td className="px-5 py-3.5 text-emerald-400 font-medium">{formatBytes(s.bytesIn)}</td>
                  <td className="px-5 py-3.5 text-blue-400 font-medium">{formatBytes(s.bytesOut)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setTerminatingId(s.id); terminateMutation.mutate(s); }}
                        disabled={terminatingId === s.id && terminateMutation.isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        {terminatingId === s.id && terminateMutation.isPending ? "Coupure..." : "Couper"}
                      </button>
                      {canAdminDeleteTicket && (
                        confirmDeleteId === s.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-amber-300">Confirmer ?</span>
                            <button
                              onClick={() => { setDeletingId(s.id); setConfirmDeleteId(null); deleteMutation.mutate(s); }}
                              disabled={deletingId === s.id && deleteMutation.isPending}
                              className="px-2 py-1 rounded-lg border border-red-400/30 bg-red-400/10 text-xs text-red-300 hover:bg-red-400/20 transition-colors disabled:opacity-50"
                            >
                              {deletingId === s.id && deleteMutation.isPending ? "..." : "Oui"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg border text-xs text-muted-foreground hover:bg-muted transition-colors"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(s.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-amber-300 hover:bg-amber-400/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
