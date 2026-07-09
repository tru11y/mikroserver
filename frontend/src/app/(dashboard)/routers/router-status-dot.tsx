import { StatusDot } from '@/components/ui/status-dot';
import type { RouterStatus } from './routers.types';

const STATUS_DOT_VARIANT: Record<RouterStatus, 'online' | 'offline' | 'warning' | 'maintenance'> = {
  ONLINE:      'online',
  DEGRADED:    'warning',
  OFFLINE:     'offline',
  MAINTENANCE: 'maintenance',
};

export function RouterStatusDot({ status }: { status: RouterStatus }) {
  return <StatusDot variant={STATUS_DOT_VARIANT[status]} size="sm" />;
}
