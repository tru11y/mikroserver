'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, Wifi, RefreshCw, Ban } from 'lucide-react';

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
  const queryClient = useQueryClient();

  const { data: routersData } = useQuery({
    queryKey: ['routers'],
    queryFn: () => api.routers.list(),
  });
  const routers = (routersData as any)?.data?.data ?? [];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions', routerId],
    queryFn: () => api.sessions.active(routerId),
    refetchInterval: 10_000,
  });

  const sessions: Session[] = (data as any)?.data?.data ?? (data as any)?.data ?? [];

  const terminateMutation = useMutation({
    mutationFn: (session: Session) => api.sessions.terminate(session.routerId, session.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['router-live'] });
    },
    onSettled: () => setTerminatingId(null),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions actives</h1>
          <p className="text-muted-foreground text-sm mt-1">{sessions.length} client{sessions.length !== 1 ? 's' : ''} connecté{sessions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={routerId ?? ''}
            onChange={e => setRouterId(e.target.value || undefined)}
            className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les routeurs</option>
            {routers.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted transition-colors text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
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
                  <td className="px-5 py-3.5 font-mono text-xs">{s.uptime}</td>
                  <td className="px-5 py-3.5 text-emerald-400 font-medium">{formatBytes(s.bytesIn)}</td>
                  <td className="px-5 py-3.5 text-blue-400 font-medium">{formatBytes(s.bytesOut)}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => { setTerminatingId(s.id); terminateMutation.mutate(s); }}
                      disabled={terminateMutation.isPending}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" />
                      {terminatingId === s.id ? 'Coupure...' : 'Couper'}
                    </button>
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
