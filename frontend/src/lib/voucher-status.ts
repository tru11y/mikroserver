import { AlertCircle, CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react';

export type VoucherStatus =
  | 'GENERATED'
  | 'DELIVERED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'DELIVERY_FAILED';

export interface VoucherStatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  dot: string;
  pulse: boolean;
}

export const VOUCHER_STATUS_CFG: Record<VoucherStatus, VoucherStatusConfig> = {
  GENERATED: {
    label: 'Généré',
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 border-border',
    dot: 'bg-muted-foreground',
    pulse: false,
  },
  DELIVERED: {
    label: 'Livré',
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
    dot: 'bg-success',
    pulse: false,
  },
  ACTIVE: {
    label: 'Actif',
    icon: CheckCircle2,
    color: 'text-info',
    bg: 'bg-info/10 border-info/20',
    dot: 'bg-info',
    pulse: true,
  },
  EXPIRED: {
    label: 'Expiré',
    icon: Clock,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
    dot: 'bg-warning',
    pulse: false,
  },
  REVOKED: {
    label: 'Révoqué',
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
    dot: 'bg-destructive',
    pulse: false,
  },
  DELIVERY_FAILED: {
    label: 'Échec livraison',
    icon: AlertCircle,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
    dot: 'bg-warning',
    pulse: false,
  },
};

export function getVoucherStatusCfg(status: string): VoucherStatusConfig {
  return VOUCHER_STATUS_CFG[status as VoucherStatus] ?? VOUCHER_STATUS_CFG.EXPIRED;
}
