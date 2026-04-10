'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react';

interface Router {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
}

/**
 * RouterAlertMonitor
 *
 * Invisible component — polls router list every 30s and fires a toast
 * whenever a router transitions to OFFLINE or back to ONLINE.
 * Mount this once inside the dashboard layout.
 */
export function RouterAlertMonitor() {
  const prevStatuses = useRef<Record<string, string>>({});
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['routers', 'list'],
    queryFn: () => api.routers.list(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const routers = useMemo<Router[]>(
    () => ((data?.data?.data as Router[]) ?? []),
    [data],
  );

  useEffect(() => {
    if (!routers.length) return;

    routers.forEach((router) => {
      const prev = prevStatuses.current[router.id];

      if (prev === undefined) {
        // First load — just record status, no alert
        prevStatuses.current[router.id] = router.status;
        return;
      }

      if (prev !== 'OFFLINE' && router.status === 'OFFLINE') {
        // Router went offline → red toast
        toast.error(`${router.name} est hors ligne !`, {
          description: 'Le routeur ne répond plus. Vérifiez le tunnel WireGuard.',
          duration: 10_000,
          icon: <WifiOff className="h-4 w-4" />,
        });
      } else if ((prev === 'OFFLINE' || prev === 'DEGRADED') && router.status === 'ONLINE') {
        // Router came back fully online → green toast
        toast.success(`${router.name} est de retour en ligne`, {
          description: 'Le routeur répond normalement.',
          duration: 6_000,
          icon: <Wifi className="h-4 w-4" />,
        });
      } else if (prev === 'ONLINE' && router.status === 'DEGRADED') {
        // Router degraded (sync failures / circuit breaker) → warning toast
        toast.warning(`${router.name} est dégradé`, {
          description: 'Des erreurs ont été détectées. Le routeur reste joignable.',
          duration: 8_000,
          icon: <AlertTriangle className="h-4 w-4" />,
        });
      }

      prevStatuses.current[router.id] = router.status;
    });
  }, [routers]);

  return null; // This component renders nothing
}
