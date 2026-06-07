import { clsx } from 'clsx';
import type { RouterItem } from './routers.types';

export function getRouterFleetCompliance(router: RouterItem): {
  status: 'ok' | 'warning' | 'critical';
  alertCount: number;
} {
  const alerts: Array<'warning' | 'critical'> = [];

  if (!router.wireguardIp) {
    alerts.push('critical');
  }

  const failures = router.metadata?.consecutiveHealthFailures ?? 0;
  if (failures >= 3) {
    alerts.push('critical');
  } else if (failures >= 1) {
    alerts.push('warning');
  }

  const criticalCount = alerts.filter((a) => a === 'critical').length;
  const warningCount = alerts.filter((a) => a === 'warning').length;
  return {
    status: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
    alertCount: alerts.length,
  };
}

interface RouterComplianceChipProps {
  router: RouterItem;
}

export function RouterComplianceChip({ router }: RouterComplianceChipProps) {
  const { status, alertCount } = getRouterFleetCompliance(router);

  if (status === 'ok') return null;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
        status === 'critical'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-warning/30 bg-warning/10 text-warning',
      )}
      aria-label={`${alertCount} alerte${alertCount > 1 ? 's' : ''} de conformité`}
    >
      {alertCount} alerte{alertCount > 1 ? 's' : ''}
    </span>
  );
}
