import { clsx } from 'clsx';

interface CustomerStatusBadgeProps {
  isBlocked: boolean;
  className?: string;
}

export function CustomerStatusBadge({ isBlocked, className }: CustomerStatusBadgeProps) {
  if (!isBlocked) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
        'bg-destructive/10 text-destructive',
        className,
      )}
      aria-label="Client bloqué"
    >
      Bloqué
    </span>
  );
}
