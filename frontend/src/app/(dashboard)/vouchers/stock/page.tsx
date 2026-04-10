'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { Archive, AlertTriangle, Box, CheckCircle2, Layers3, Router, Users } from 'lucide-react';

interface InventoryTotals {
  total: number;
  printable: number;
  ready: number;
  pendingProvisioning: number;
  active: number;
  used: number;
  expired: number;
  issues: number;
  revoked: number;
}

interface InventoryPlanRow {
  planId: string;
  planName: string;
  durationMinutes: number;
  priceXof: number;
  total: number;
  printable: number;
  ready: number;
  active: number;
  expired: number;
  issues: number;
}

interface InventoryRouterRow {
  routerId: string | null;
  routerName: string;
  routerStatus: string | null;
  total: number;
  printable: number;
  ready: number;
  active: number;
  expired: number;
  issues: number;
}

interface InventoryResellerRow {
  resellerId: string | null;
  resellerName: string;
  email: string | null;
  total: number;
  printable: number;
  ready: number;
  active: number;
  expired: number;
  issues: number;
}

export default function VoucherStockPage() {
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewTickets = hasPermission(currentUser, 'tickets.view');

  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', 'inventory-summary'],
    queryFn: () => api.vouchers.inventorySummary(),
    refetchInterval: 30_000,
    enabled: canViewTickets,
  });

  const summary = (data ? unwrap<{
    totals?: InventoryTotals;
    byPlan?: InventoryPlanRow[];
    byRouter?: InventoryRouterRow[];
    byReseller?: InventoryResellerRow[];
  }>(data) : null) ?? {};
  const totals: InventoryTotals = summary.totals ?? {
    total: 0,
    printable: 0,
    ready: 0,
    pendingProvisioning: 0,
    active: 0,
    used: 0,
    expired: 0,
    issues: 0,
    revoked: 0,
  };
  const byPlan: InventoryPlanRow[] = summary.byPlan ?? [];
  const byRouter: InventoryRouterRow[] = summary.byRouter ?? [];
  const byReseller: InventoryResellerRow[] = summary.byReseller ?? [];

  if (isMeLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewTickets) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Box className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter le stock des tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue terrain des tickets disponibles, des tickets prêts à vendre, et des anomalies à traiter.
          </p>
        </div>
        <Link
          href="/vouchers?usageState=UNUSED"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Voir les tickets jamais utilisés
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Stock total', value: totals.total, icon: Box },
          { label: 'Imprimables', value: totals.printable, icon: Archive },
          { label: 'Prêts à vendre', value: totals.ready, icon: CheckCircle2 },
          { label: 'En problème', value: totals.issues, icon: AlertTriangle },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-3 text-3xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/vouchers?usageState=READY" className="rounded-xl border bg-card p-4 hover:bg-muted/20 transition-colors">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Prêts à vendre</p>
          <p className="mt-2 text-2xl font-bold">{totals.ready}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tickets livrés sur routeur mais jamais utilisés</p>
        </Link>
        <Link href="/vouchers?usageState=UNUSED" className="rounded-xl border bg-card p-4 hover:bg-muted/20 transition-colors">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">En attente routeur</p>
          <p className="mt-2 text-2xl font-bold">{totals.pendingProvisioning}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tickets générés mais pas encore délivrés</p>
        </Link>
        <Link href="/vouchers?usageState=USED" className="rounded-xl border bg-card p-4 hover:bg-muted/20 transition-colors">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Déjà consommés</p>
          <p className="mt-2 text-2xl font-bold">{totals.used}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tickets déjà activés ou arrivés à expiration</p>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border bg-card py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border bg-card overflow-x-auto">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Layers3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Stock par forfait</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Forfait</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Prêts</th>
                  <th className="px-4 py-3">Actifs</th>
                  <th className="px-4 py-3">Problèmes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byPlan.map((row) => (
                  <tr key={row.planId}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.planName}</p>
                      <p className="text-xs text-muted-foreground">{row.durationMinutes} min</p>
                    </td>
                    <td className="px-4 py-3">{row.priceXof.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3">{row.printable}</td>
                    <td className="px-4 py-3">{row.ready}</td>
                    <td className="px-4 py-3">{row.active}</td>
                    <td className="px-4 py-3">{row.issues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-card overflow-x-auto">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Router className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Stock par routeur</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Routeur</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Imprimables</th>
                  <th className="px-4 py-3">Prêts</th>
                  <th className="px-4 py-3">Actifs</th>
                  <th className="px-4 py-3">Problèmes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byRouter.map((row) => (
                  <tr key={row.routerId ?? 'unassigned'}>
                    <td className="px-4 py-3">{row.routerName}</td>
                    <td className="px-4 py-3">{row.routerStatus ?? '—'}</td>
                    <td className="px-4 py-3">{row.printable}</td>
                    <td className="px-4 py-3">{row.ready}</td>
                    <td className="px-4 py-3">{row.active}</td>
                    <td className="px-4 py-3">{row.issues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-card overflow-x-auto">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Stock par revendeur</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Revendeur</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Prêts</th>
                  <th className="px-4 py-3">Actifs</th>
                  <th className="px-4 py-3">Expirés</th>
                  <th className="px-4 py-3">Problèmes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byReseller.map((row) => (
                  <tr key={row.resellerId ?? 'system'}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.resellerName}</p>
                      <p className="text-xs text-muted-foreground">{row.email ?? 'Sans email'}</p>
                    </td>
                    <td className="px-4 py-3">{row.printable}</td>
                    <td className="px-4 py-3">{row.ready}</td>
                    <td className="px-4 py-3">{row.active}</td>
                    <td className="px-4 py-3">{row.expired}</td>
                    <td className="px-4 py-3">{row.issues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
