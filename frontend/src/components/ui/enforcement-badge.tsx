import { clsx } from 'clsx';
import type { HotspotUserRow } from '@/app/(dashboard)/routers/[id]/router-detail.types';

interface EnforcementBadgeProps {
  status: HotspotUserRow['enforcementStatus'];
  className?: string;
}

const ENFORCEMENT_CONFIG: Record<
  HotspotUserRow['enforcementStatus'],
  { label: string; color: string; bg: string }
> = {
  ACTIVE_OK: {
    label: 'Conforme',
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
  },
  INACTIVE_OK: {
    label: 'Inactif OK',
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
  },
  EXPIRED_BUT_ACTIVE: {
    label: 'Expiré actif',
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
  },
  EXPIRED: {
    label: 'Expiré',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
  },
  UNMANAGED: {
    label: 'Non géré',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50 border-border',
  },
};

export function EnforcementBadge({ status, className }: EnforcementBadgeProps) {
  const cfg = ENFORCEMENT_CONFIG[status];
  return (
    <span
      className={clsx(
        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-150',
        cfg.bg,
        cfg.color,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
