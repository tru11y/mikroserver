import { clsx } from 'clsx';

type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';

const STATUS_CFG: Record<SubscriptionStatus, { label: string; className: string }> = {
  ACTIVE:    { label: 'Actif',     className: 'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]' },
  TRIAL:     { label: 'Essai',     className: 'border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]' },
  CANCELLED: { label: 'Résilié',  className: 'border-border bg-muted/50 text-muted-foreground' },
  EXPIRED:   { label: 'Expiré',   className: 'border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]' },
  SUSPENDED: { label: 'Suspendu', className: 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]' },
};

export function SubscriptionStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const cfg = STATUS_CFG[status as SubscriptionStatus];
  if (!cfg) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}
