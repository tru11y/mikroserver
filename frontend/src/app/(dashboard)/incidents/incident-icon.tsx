import { AlertTriangle, ServerCrash, Siren, Workflow, WifiOff } from 'lucide-react';
import type { IncidentSeverity } from './incidents.types';

interface IncidentIconProps {
  type: string;
  severity: IncidentSeverity;
  className?: string;
}

export function IncidentIcon({ type, severity, className }: IncidentIconProps) {
  const cls = className ?? 'h-4 w-4';

  if (type === 'QUEUE_BACKLOG') {
    return <Workflow className={cls} aria-hidden="true" />;
  }
  if (type === 'ROUTER_OFFLINE') {
    return <WifiOff className={cls} aria-hidden="true" />;
  }
  if (type === 'DELIVERY_FAILURE') {
    return <ServerCrash className={cls} aria-hidden="true" />;
  }
  if (severity === 'CRITICAL') {
    return <Siren className={cls} aria-hidden="true" />;
  }
  return <AlertTriangle className={cls} aria-hidden="true" />;
}
