import { Shield } from 'lucide-react';
import { clsx } from 'clsx';

interface AuditActorInput {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'text-warning',
  ADMIN: 'text-primary',
  VIEWER: 'text-muted-foreground',
};

interface AuditActorChipProps {
  actor: AuditActorInput | null;
  className?: string;
}

export function AuditActorChip({ actor, className }: AuditActorChipProps) {
  if (!actor) {
    return (
      <span className={clsx('text-xs italic text-muted-foreground/50', className)}>
        Système
      </span>
    );
  }

  const roleColor = ROLE_COLORS[actor.role] ?? 'text-muted-foreground';

  return (
    <span
      className={clsx('inline-flex min-w-0 items-center gap-1', className)}
      title={`${actor.email} — ${actor.role}`}
    >
      <Shield className={clsx('h-3 w-3 flex-shrink-0', roleColor)} aria-hidden="true" />
      <span className="max-w-[100px] truncate text-xs">{actor.name}</span>
    </span>
  );
}
