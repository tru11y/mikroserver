'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, Ticket } from 'lucide-react';
import { clsx } from 'clsx';
import { api, unwrap } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface InventoryTotals {
  ready: number;
  active: number;
  expired: number;
  issues: number;
}

interface VouchersKpiStripProps {
  canView: boolean;
}

export function VouchersKpiStrip({ canView }: VouchersKpiStripProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', 'inventory-summary'],
    queryFn: () => api.vouchers.inventorySummary(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: canView,
  });

  const summary = data ? unwrap<{ totals?: InventoryTotals }>(data) : null;
  const totals = summary?.totals ?? { ready: 0, active: 0, expired: 0, issues: 0 };

  const kpis = [
    { label: 'Prêts à vendre', value: totals.ready,   tone: 'default' as const, icon: Ticket       },
    { label: 'Actifs',         value: totals.active,  tone: 'success' as const, icon: CheckCircle2 },
    { label: 'Expirés',        value: totals.expired, tone: 'warning' as const, icon: Clock        },
    { label: 'En problème',    value: totals.issues,  tone: 'danger'  as const, icon: AlertCircle  },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const tone = TONE_CLS[kpi.tone];
        return (
          <div key={kpi.label} className="flex items-center gap-2.5 rounded-lg border bg-card p-3">
            <div className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', tone.icon)}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-10" />
              ) : (
                <p className={clsx('mt-0.5 text-lg font-bold tabular-nums leading-none', tone.value)}>
                  {kpi.value}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TONE_CLS = {
  default: { value: 'text-foreground',    icon: 'bg-muted text-foreground'               },
  success: { value: 'text-success',       icon: 'bg-success/10 text-success'             },
  warning: { value: 'text-warning',       icon: 'bg-warning/10 text-warning'             },
  danger:  { value: 'text-destructive',   icon: 'bg-destructive/10 text-destructive'     },
} as const;
