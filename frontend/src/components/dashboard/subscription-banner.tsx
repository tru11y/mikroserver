'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Crown } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { differenceInDays } from 'date-fns';
import Link from 'next/link';

export function SubscriptionBanner() {
  const { data } = useQuery({
    queryKey: ['operator-subscription-banner'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/subscription');
      return (res.data as unknown as { data: { endDate: string; status: string; tier: { isFree: boolean; name: string } } | null }).data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.tier.isFree) return null;

  const daysLeft = differenceInDays(new Date(data.endDate), new Date());

  if (data.status === 'EXPIRED' || data.status === 'CANCELLED' || daysLeft < 0) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>Votre abonnement <strong>{data.tier.name}</strong> a expiré. Certaines fonctionnalités sont limitées.</span>
        </div>
        <Link href="/subscription" className="text-xs font-medium bg-destructive text-white px-3 py-1 rounded-lg hover:bg-destructive/90">
          Renouveler
        </Link>
      </div>
    );
  }

  if (daysLeft <= 7) {
    return (
      <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-orange-600 text-sm">
          <Crown className="h-4 w-4" />
          <span>Votre abonnement <strong>{data.tier.name}</strong> expire dans <strong>{daysLeft} jours</strong>.</span>
        </div>
        <Link href="/subscription" className="text-xs font-medium bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600">
          Renouveler
        </Link>
      </div>
    );
  }

  return null;
}
