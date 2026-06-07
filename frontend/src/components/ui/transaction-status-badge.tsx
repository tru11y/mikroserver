import { clsx } from 'clsx';
import { getTransactionStatusCfg } from '@/lib/transaction-status';

interface TransactionStatusBadgeProps {
  status: string;
  className?: string;
}

export function TransactionStatusBadge({
  status,
  className,
}: TransactionStatusBadgeProps) {
  const cfg = getTransactionStatusCfg(status);
  const Icon = cfg.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        cfg.bg,
        cfg.color,
        className,
      )}
    >
      {cfg.pulse ? (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0" aria-hidden="true">
          <span
            className={clsx(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              cfg.dot,
            )}
          />
          <span
            className={clsx('relative inline-flex h-1.5 w-1.5 rounded-full', cfg.dot)}
          />
        </span>
      ) : (
        <Icon className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
      )}
      {cfg.label}
    </span>
  );
}
