'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  AlertTriangle,
  Archive,
  Box,
  CheckCircle2,
  Layers3,
  Router,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { VouchersTabs } from '../vouchers-tabs';
import { RouterStatusBadge } from '@/components/ui/router-status-badge';
import { PriceLabel } from '@/components/ui/price-label';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';

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

const TONE_CLS = {
  default:     { value: 'text-foreground',  icon: 'bg-muted text-foreground'           },
  success:     { value: 'text-success',     icon: 'bg-success/10 text-success'         },
  warning:     { value: 'text-warning',     icon: 'bg-warning/10 text-warning'         },
  destructive: { value: 'text-destructive', icon: 'bg-destructive/10 text-destructive' },
} as const;

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: keyof typeof TONE_CLS;
}) {
  const cls = TONE_CLS[tone];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', cls.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={clsx('mt-3 text-3xl font-bold tabular-nums', cls.value)}>{value}</p>
    </div>
  );
}

export default function VoucherStockPage() {
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canView = hasPermission(currentUser, 'tickets.view');
  const canCreate = hasPermission(currentUser, 'tickets.create');
  const canVerify = hasPermission(currentUser, 'tickets.verify');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vouchers', 'inventory-summary'],
    queryFn: () => api.vouchers.inventorySummary(),
    refetchInterval: 30_000,
    enabled: canView,
  });

  const summary = (data ? unwrap<{
    totals?: InventoryTotals;
    byPlan?: InventoryPlanRow[];
    byRouter?: InventoryRouterRow[];
    byReseller?: InventoryResellerRow[];
  }>(data) : null) ?? {};

  const totals: InventoryTotals = summary.totals ?? {
    total: 0, printable: 0, ready: 0, pendingProvisioning: 0,
    active: 0, used: 0, expired: 0, issues: 0, revoked: 0,
  };
  const byPlan: InventoryPlanRow[] = summary.byPlan ?? [];
  const byRouter: InventoryRouterRow[] = summary.byRouter ?? [];
  const byReseller: InventoryResellerRow[] = summary.byReseller ?? [];

  if (isMeLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-4">
        <VouchersTabs permissions={{ canView: false, canCreate, canVerify }} />
        <div className="rounded-lg border bg-card p-8 text-center">
          <Box className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h1 className="mt-3 text-base font-semibold">Accès limité</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Votre profil ne permet pas de consulter le stock des tickets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VouchersTabs
        permissions={{ canView, canCreate, canVerify }}
        badges={{ issues: totals.issues > 0 ? totals.issues : undefined }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Stock</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Inventaire des tickets disponibles et anomalies à traiter.
          </p>
        </div>
        <Link
          href="/vouchers?usageState=UNUSED"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out hover:bg-muted/50 hover:border-primary/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Voir les jamais utilisés →
        </Link>
      </div>

      {isError ? (
        <ErrorState
          title="Impossible de charger l'inventaire"
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Stock total"     value={totals.total}    icon={Box}           tone="default"     />
            <KpiCard label="Imprimables"     value={totals.printable} icon={Archive}      tone="default"     />
            <KpiCard label="Prêts à vendre"  value={totals.ready}    icon={CheckCircle2}  tone="success"     />
            <KpiCard label="En problème"     value={totals.issues}   icon={AlertTriangle} tone="destructive" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/vouchers?usageState=READY" className="cursor-pointer rounded-xl border bg-card p-4 transition-all duration-200 ease-out hover:bg-muted/20 hover:border-primary/30 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Prêts à vendre</p>
              <p className="mt-2 text-2xl font-bold text-success tabular-nums">{totals.ready}</p>
              <p className="mt-1 text-xs text-muted-foreground">Tickets livrés sur routeur mais jamais utilisés</p>
            </Link>
            <Link href="/vouchers?usageState=UNUSED" className="cursor-pointer rounded-xl border bg-card p-4 transition-all duration-200 ease-out hover:bg-muted/20 hover:border-primary/30 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">En attente routeur</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{totals.pendingProvisioning}</p>
              <p className="mt-1 text-xs text-muted-foreground">Tickets générés mais pas encore délivrés</p>
            </Link>
            <Link href="/vouchers?usageState=USED" className="cursor-pointer rounded-xl border bg-card p-4 transition-all duration-200 ease-out hover:bg-muted/20 hover:border-primary/30 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Déjà consommés</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{totals.used}</p>
              <p className="mt-1 text-xs text-muted-foreground">Tickets déjà activés ou arrivés à expiration</p>
            </Link>
          </div>

          <div className="space-y-6">
            <InventorySection
              icon={<Layers3 className="h-4 w-4 text-muted-foreground" />}
              title="Stock par forfait"
              isEmpty={byPlan.length === 0}
              isLoading={isLoading}
              emptyLabel="Aucun forfait dans l'inventaire"
              colCount={6}
              thead={
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Forfait</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Prêts</th>
                  <th className="px-4 py-3">Actifs</th>
                  <th className="px-4 py-3">Problèmes</th>
                </tr>
              }
            >
              {byPlan.map((row) => (
                <tr key={row.planId} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.planName}</p>
                    <p className="text-xs text-muted-foreground">{row.durationMinutes} min</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <PriceLabel amount={row.priceXof} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.printable}</td>
                  <td className="px-4 py-3 tabular-nums text-success">{row.ready}</td>
                  <td className="px-4 py-3 tabular-nums">{row.active}</td>
                  <td className={clsx('px-4 py-3 tabular-nums', row.issues > 0 && 'text-destructive font-semibold')}>
                    {row.issues}
                  </td>
                </tr>
              ))}
            </InventorySection>

            <InventorySection
              icon={<Router className="h-4 w-4 text-muted-foreground" />}
              title="Stock par routeur"
              isEmpty={byRouter.length === 0}
              isLoading={isLoading}
              emptyLabel="Aucun routeur dans l'inventaire"
              colCount={6}
              thead={
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Routeur</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Imprimables</th>
                  <th className="px-4 py-3">Prêts</th>
                  <th className="px-4 py-3">Actifs</th>
                  <th className="px-4 py-3">Problèmes</th>
                </tr>
              }
            >
              {byRouter.map((row) => (
                <tr key={row.routerId ?? 'unassigned'} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{row.routerName}</td>
                  <td className="px-4 py-3">
                    <RouterStatusBadge status={row.routerStatus ?? undefined} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.printable}</td>
                  <td className="px-4 py-3 tabular-nums text-success">{row.ready}</td>
                  <td className="px-4 py-3 tabular-nums">{row.active}</td>
                  <td className={clsx('px-4 py-3 tabular-nums', row.issues > 0 && 'text-destructive font-semibold')}>
                    {row.issues}
                  </td>
                </tr>
              ))}
            </InventorySection>

            {byReseller.length > 0 && (
              <InventorySection
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                title="Stock par revendeur"
                isEmpty={false}
                isLoading={isLoading}
                emptyLabel=""
                colCount={6}
                thead={
                  <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Revendeur</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Prêts</th>
                    <th className="px-4 py-3">Actifs</th>
                    <th className="px-4 py-3">Expirés</th>
                    <th className="px-4 py-3">Problèmes</th>
                  </tr>
                }
              >
                {byReseller.map((row) => (
                  <tr key={row.resellerId ?? 'system'} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.resellerName}</p>
                      <p className="text-xs text-muted-foreground">{row.email ?? 'Sans email'}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.printable}</td>
                    <td className="px-4 py-3 tabular-nums text-success">{row.ready}</td>
                    <td className="px-4 py-3 tabular-nums">{row.active}</td>
                    <td className="px-4 py-3 tabular-nums text-warning">{row.expired}</td>
                    <td className={clsx('px-4 py-3 tabular-nums', row.issues > 0 && 'text-destructive font-semibold')}>
                      {row.issues}
                    </td>
                  </tr>
                ))}
              </InventorySection>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InventorySection({
  icon,
  title,
  isEmpty,
  isLoading,
  emptyLabel,
  colCount,
  thead,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  isEmpty: boolean;
  isLoading: boolean;
  emptyLabel: string;
  colCount: number;
  thead: React.ReactNode;
  children: React.ReactNode;
}) {
  const headingId = `inventory-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="overflow-x-auto rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {icon}
        <h2 id={headingId} className="font-semibold">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead>{thead}</thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={colCount} />)
          ) : isEmpty ? (
            <tr>
              <td colSpan={colCount}>
                <EmptyState title={emptyLabel} className="py-8 border-none" />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </section>
  );
}
