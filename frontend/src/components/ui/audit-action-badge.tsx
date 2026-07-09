import { clsx } from 'clsx';
import {
  Activity,
  FilePlus2,
  LogIn,
  LogOut,
  Pencil,
  ShieldAlert,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

interface ActionConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const ACTION_CFG: Record<string, ActionConfig> = {
  CREATE: {
    label: 'Création',
    icon: FilePlus2,
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
  },
  UPDATE: {
    label: 'Mise à jour',
    icon: Pencil,
    color: 'text-info',
    bg: 'bg-info/10 border-info/20',
  },
  DELETE: {
    label: 'Suppression',
    icon: Trash2,
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
  },
  LOGIN: {
    label: 'Connexion',
    icon: LogIn,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/20',
  },
  LOGOUT: {
    label: 'Déconnexion',
    icon: LogOut,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 border-border/60',
  },
  SECURITY_ALERT: {
    label: 'Alerte sécurité',
    icon: ShieldAlert,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
  },
};

const FALLBACK: ActionConfig = {
  label: 'Inconnu',
  icon: Activity,
  color: 'text-muted-foreground',
  bg: 'bg-muted/20 border-border/40',
};

export function getAuditActionCfg(action: string): ActionConfig {
  return ACTION_CFG[action] ?? FALLBACK;
}

interface AuditActionBadgeProps {
  action: string;
  className?: string;
}

export function AuditActionBadge({ action, className }: AuditActionBadgeProps) {
  const cfg = getAuditActionCfg(action);
  const Icon = cfg.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wider',
        cfg.bg,
        cfg.color,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
