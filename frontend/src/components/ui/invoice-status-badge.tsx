import { AlertCircle, CheckCircle, Clock, FileText, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { InvoiceStatus } from '@/lib/api/accounting';

const CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: React.ReactNode }> = {
  DRAFT: {
    label: 'Brouillon',
    className: 'bg-muted/50 text-muted-foreground',
    icon: <FileText className="h-3 w-3" aria-hidden="true" />,
  },
  SENT: {
    label: 'Envoyée',
    className: 'bg-info/10 text-info',
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
  },
  PAID: {
    label: 'Payée',
    className: 'bg-success/10 text-success',
    icon: <CheckCircle className="h-3 w-3" aria-hidden="true" />,
  },
  OVERDUE: {
    label: 'En retard',
    className: 'bg-destructive/10 text-destructive',
    icon: <AlertCircle className="h-3 w-3" aria-hidden="true" />,
  },
  CANCELLED: {
    label: 'Annulée',
    className: 'bg-muted/50 text-muted-foreground',
    icon: <X className="h-3 w-3" aria-hidden="true" />,
  },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const { label, className: tokenClass, icon } = CONFIG[status] ?? CONFIG.DRAFT;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        'transition-colors duration-150',
        tokenClass,
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}
