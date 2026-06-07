import {
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export interface TransactionStatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  dot: string;
  pulse: boolean;
}

export const TRANSACTION_STATUS_CFG: Record<TransactionStatus, TransactionStatusConfig> = {
  PENDING: {
    label: 'En attente',
    icon: Clock,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
    dot: 'bg-warning',
    pulse: false,
  },
  PROCESSING: {
    label: 'Traitement',
    icon: Loader2,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/20',
    dot: 'bg-primary',
    pulse: true,
  },
  COMPLETED: {
    label: 'Complété',
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
    dot: 'bg-success',
    pulse: false,
  },
  FAILED: {
    label: 'Échoué',
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
    dot: 'bg-destructive',
    pulse: false,
  },
  REFUNDED: {
    label: 'Remboursé',
    icon: RotateCcw,
    color: 'text-info',
    bg: 'bg-info/10 border-info/20',
    dot: 'bg-info',
    pulse: false,
  },
};

export function getTransactionStatusCfg(status: string): TransactionStatusConfig {
  return (
    TRANSACTION_STATUS_CFG[status as TransactionStatus] ??
    TRANSACTION_STATUS_CFG.PENDING
  );
}
