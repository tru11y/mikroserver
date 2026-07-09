import { Clock, MapPin, Server, ShieldCheck } from 'lucide-react';
import { RouterStatusBadge } from '@/components/ui/router-status-badge';
import type { RouterDetail } from './router-detail.types';
import { formatRelative } from './router-detail.utils';

interface RouterHeaderIdentityProps {
  routerInfo?: RouterDetail;
}

export function RouterHeaderIdentity({ routerInfo }: RouterHeaderIdentityProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
          {routerInfo?.name ?? '…'}
        </h1>
        {routerInfo && <RouterStatusBadge status={routerInfo.status} />}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {routerInfo?.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {routerInfo.location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Server className="h-3 w-3" aria-hidden="true" />
          {routerInfo?.wireguardIp ?? '—'}:{routerInfo?.apiPort}
        </span>
        {routerInfo?.lastSeenAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Vu {formatRelative(routerInfo.lastSeenAt)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Hotspot {routerInfo?.hotspotServer ?? '—'} · profil {routerInfo?.hotspotProfile ?? '—'}
        </span>
      </div>
    </div>
  );
}
