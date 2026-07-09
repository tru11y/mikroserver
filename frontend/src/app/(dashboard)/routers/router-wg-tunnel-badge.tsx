import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { RouterStatus } from './routers.types';

interface Props {
  wireguardIp: string | null;
  status: RouterStatus;
}

const STATUS_CLASS: Record<RouterStatus, string> = {
  ONLINE:      'text-success',
  DEGRADED:    'text-warning',
  OFFLINE:     'text-destructive',
  MAINTENANCE: 'text-info',
};

const STATUS_SR_LABEL: Record<RouterStatus, string> = {
  ONLINE:      'Tunnel actif',
  DEGRADED:    'Tunnel dégradé',
  OFFLINE:     'Tunnel hors ligne',
  MAINTENANCE: 'Tunnel en maintenance',
};

export function RouterWgTunnelBadge({ wireguardIp, status }: Props) {
  if (!wireguardIp) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <ShieldOff className="h-3 w-3" aria-hidden="true" />
        <span>Non configuré</span>
      </span>
    );
  }

  return (
    <span
      className={clsx('inline-flex items-center gap-1 font-mono text-[10px]', STATUS_CLASS[status])}
      title={STATUS_SR_LABEL[status]}
    >
      {status === 'ONLINE'
        ? <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        : <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      }
      <span>{wireguardIp}</span>
      <span className="sr-only">({STATUS_SR_LABEL[status]})</span>
    </span>
  );
}
