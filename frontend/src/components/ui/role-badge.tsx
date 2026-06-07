import { clsx } from 'clsx';
import { Eye, Shield, ShieldCheck } from 'lucide-react';
import type { ElementType } from 'react';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER';

const ROLE_CFG: Record<Role, { label: string; Icon: ElementType; className: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    Icon: ShieldCheck,
    className:
      'border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]',
  },
  ADMIN: {
    label: 'Admin',
    Icon: Shield,
    className:
      'border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))]',
  },
  RESELLER: {
    label: 'Revendeur',
    Icon: Shield,
    className:
      'border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]',
  },
  VIEWER: {
    label: 'Lecteur',
    Icon: Eye,
    className: 'border-border bg-muted/50 text-muted-foreground',
  },
};

export function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CFG[role as Role];
  if (!cfg) return <span className="text-xs text-muted-foreground">{role}</span>;
  const { label, Icon, className } = cfg;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
