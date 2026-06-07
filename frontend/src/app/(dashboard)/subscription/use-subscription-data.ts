'use client';

import { useQuery } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/api/client';

export interface SaasTier {
  id: string;
  name: string;
  slug: string;
  maxRouters: number | null;
  maxResellers: number | null;
  features: string[];
  isFree: boolean;
}

export interface OperatorSubscription {
  id: string;
  tierId: string;
  status: string;
  billingCycle: string;
  endDate: string;
  trialEndsAt: string | null;
  tier: SaasTier;
}

export interface UsageMeterData {
  current: number;
  limit: number | null;
}

export interface SaasUsage {
  routers: UsageMeterData;
  resellers: UsageMeterData;
  monthlyTx: UsageMeterData;
}

export interface StatusConfig {
  label: string;
  cls: string;
}

export const STATUS_CFG: Record<string, StatusConfig> = {
  ACTIVE:    { label: 'Actif',       cls: 'text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.2)]' },
  TRIALING:  { label: 'Essai',       cls: 'text-[hsl(var(--info))] bg-[hsl(var(--info)/0.1)] border-[hsl(var(--info)/0.2)]' },
  EXPIRED:   { label: 'Expiré',      cls: 'text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.1)] border-[hsl(var(--destructive)/0.2)]' },
  CANCELLED: { label: 'Annulé',      cls: 'text-muted-foreground bg-muted border-border' },
  PENDING:   { label: 'En attente',  cls: 'text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.2)]' },
} satisfies Record<string, StatusConfig>;

export type UsageLevel = 'low' | 'medium' | 'high' | 'critical';

function computeUsageLevel(usage: SaasUsage | undefined): UsageLevel {
  if (!usage) return 'low';
  const meters = [usage.routers, usage.resellers];
  const maxPct = Math.max(
    ...meters.map((m) => (m.limit ? Math.min(100, (m.current / m.limit) * 100) : 0)),
  );
  if (maxPct >= 90) return 'critical';
  if (maxPct >= 80) return 'high';
  if (maxPct >= 60) return 'medium';
  return 'low';
}

export function useSubscriptionData() {
  const subQuery = useQuery({
    queryKey: ['operator-subscription'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/subscription');
      return (res.data as { data: OperatorSubscription | null }).data;
    },
  });

  const usageQuery = useQuery({
    queryKey: ['saas-usage'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/usage');
      return (res.data as { data: SaasUsage }).data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const sub = subQuery.data;
  const usage = usageQuery.data;

  const isTrialing = sub?.trialEndsAt ? new Date(sub.trialEndsAt) > new Date() : false;
  const statusKey = (isTrialing ? 'TRIALING' : sub?.status) ?? 'PENDING';
  const statusCfg: StatusConfig = STATUS_CFG[statusKey] ?? STATUS_CFG['PENDING']!;
  const daysUntilExpiry = sub?.endDate
    ? differenceInDays(new Date(sub.endDate), new Date())
    : null;
  const usageLevel = computeUsageLevel(usage);

  return {
    subscription: sub ?? null,
    usage: usage ?? null,
    isTrialing,
    statusCfg,
    daysUntilExpiry,
    usageLevel,
    isSubLoading: subQuery.isLoading,
    isSubError: subQuery.isError,
    refetchSub: subQuery.refetch,
    isUsageLoading: usageQuery.isLoading,
    isUsageError: usageQuery.isError,
    refetchUsage: usageQuery.refetch,
  };
}
