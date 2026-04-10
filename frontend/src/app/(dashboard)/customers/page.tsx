'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Shield, ShieldOff, Wifi, Clock, Database, Download } from 'lucide-react';
import { customersApi, CustomerProfile } from '@/lib/api/customers';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatBytes(bytes: string | number) {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: statsData } = useQuery({
    queryKey: ['customers-stats'],
    queryFn: async () => {
      const res = await customersApi.getStats();
      return (res.data as unknown as { data: { total: number; newThisWeek: number; activeThisWeek: number } }).data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: async () => {
      const res = await customersApi.findAll({ page, limit: 25, search: search || undefined });
      return (res.data as unknown as { data: { items: CustomerProfile[]; total: number } }).data;
    },
    placeholderData: (prev) => prev,
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      customersApi.block(id, isBlocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Profils Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Clients WiFi identifiés par adresse MAC</p>
        </div>
        <a
          href="/proxy/api/v1/export/customers"
          download
          className="flex items-center gap-1.5 text-sm border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </a>
      </div>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <p className="text-2xl font-bold">{statsData.total}</p>
            <p className="text-xs text-muted-foreground">Total clients</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <p className="text-2xl font-bold text-green-500">+{statsData.newThisWeek}</p>
            <p className="text-xs text-muted-foreground">Nouveaux cette semaine</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-500">{statsData.activeThisWeek}</p>
            <p className="text-xs text-muted-foreground">Actifs cette semaine</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Rechercher par MAC, nom, téléphone..."
          className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Routeur</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Première connexion</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Dernière vue</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sessions</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Data</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Chargement...</td></tr>
            )}
            {!isLoading && !data?.items?.length && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucun client</td></tr>
            )}
            {data?.items?.map((c) => (
              <tr key={c.id} className={`hover:bg-muted/20 transition-colors ${c.isBlocked ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="group">
                    <p className="font-medium font-mono text-xs group-hover:text-primary transition-colors">{c.macAddress}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.firstName ? `${c.firstName} ${c.lastName ?? ''}` : c.lastUsername ?? '—'}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs">
                    <Wifi className="h-3 w-3 text-primary" /> {c.router.name}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(c.firstSeenAt), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.lastSeenAt), { addSuffix: true, locale: fr })}
                </td>
                <td className="px-4 py-3 text-right font-mono">{c.totalSessions}</td>
                <td className="px-4 py-3 text-right text-xs hidden lg:table-cell">
                  <span className="flex items-center justify-end gap-1">
                    <Database className="h-3 w-3" /> {formatBytes(c.totalDataBytes)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => blockMutation.mutate({ id: c.id, isBlocked: !c.isBlocked })}
                    className={`p-1.5 rounded hover:bg-muted transition-colors ${c.isBlocked ? 'text-green-500' : 'text-destructive'}`}
                    title={c.isBlocked ? 'Débloquer' : 'Bloquer'}
                  >
                    {c.isBlocked ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted">Précédent</button>
          <span className="text-sm text-muted-foreground">Page {page} sur {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted">Suivant</button>
        </div>
      )}
    </div>
  );
}
