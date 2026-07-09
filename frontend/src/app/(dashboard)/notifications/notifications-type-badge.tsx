import {
  Wifi,
  WifiOff,
  CreditCard,
  AlertTriangle,
  ShieldAlert,
  Clock,
  UserCheck,
  Info,
  Ticket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NotificationType } from '@/lib/api/notifications';

interface TypeConfig {
  icon: LucideIcon;
  label: string;
  iconClass: string;
  bgClass: string;
  badgeClass: string;
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  NEW_CONNECTION:        { icon: UserCheck,     label: 'Nouvelle connexion',  iconClass: 'text-info',              bgClass: 'bg-info/10',        badgeClass: 'bg-info/10 text-info' },
  SESSION_EXPIRED:       { icon: Clock,         label: 'Session expirée',     iconClass: 'text-muted-foreground',  bgClass: 'bg-muted',          badgeClass: 'bg-muted text-muted-foreground' },
  PAYMENT_RECEIVED:      { icon: CreditCard,    label: 'Paiement reçu',       iconClass: 'text-success',           bgClass: 'bg-success/10',     badgeClass: 'bg-success/10 text-success' },
  ROUTER_OFFLINE:        { icon: WifiOff,       label: 'Routeur hors ligne',  iconClass: 'text-destructive',       bgClass: 'bg-destructive/10', badgeClass: 'bg-destructive/10 text-destructive' },
  ROUTER_ONLINE:         { icon: Wifi,          label: 'Routeur en ligne',    iconClass: 'text-success',           bgClass: 'bg-success/10',     badgeClass: 'bg-success/10 text-success' },
  VOUCHER_EXPIRING:      { icon: Ticket,        label: 'Ticket expirant',     iconClass: 'text-warning',           bgClass: 'bg-warning/10',     badgeClass: 'bg-warning/10 text-warning' },
  SUBSCRIPTION_EXPIRING: { icon: AlertTriangle, label: 'Abonnement expirant', iconClass: 'text-warning',           bgClass: 'bg-warning/10',     badgeClass: 'bg-warning/10 text-warning' },
  SECURITY_ALERT:        { icon: ShieldAlert,   label: 'Alerte sécurité',     iconClass: 'text-destructive',       bgClass: 'bg-destructive/10', badgeClass: 'bg-destructive/10 text-destructive' },
  SYSTEM:                { icon: Info,          label: 'Système',             iconClass: 'text-primary',           bgClass: 'bg-primary/10',     badgeClass: 'bg-primary/10 text-primary' },
};

interface Props {
  type: NotificationType;
}

export function NotificationsTypeAvatar({ type }: Props) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bgClass}`}
      aria-hidden="true"
    >
      <Icon className={`h-4 w-4 ${cfg.iconClass}`} />
    </div>
  );
}

export function NotificationsTypeLabel({ type }: Props) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}
