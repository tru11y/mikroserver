import { clsx } from 'clsx';

interface RouterUsageBarProps {
  active: number;
  total: number;
  max: number | null;
}

export function RouterUsageBar({ active, total, max }: RouterUsageBarProps) {
  const pct = max ? (total / max) * 100 : 0;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <span className="tabular-nums">
        <span className="font-medium">{active}</span>
        <span className="text-muted-foreground">/{total}</span>
        {max !== null && (
          <span className="text-muted-foreground"> (max {max})</span>
        )}
      </span>
      {max !== null && (
        <div
          className="h-1 w-14 overflow-hidden rounded-full bg-muted"
          title={`${total} / ${max} routeurs`}
          role="progressbar"
          aria-valuenow={total}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              pct >= 90
                ? 'bg-[hsl(var(--destructive))]'
                : pct >= 70
                ? 'bg-[hsl(var(--warning))]'
                : 'bg-[hsl(var(--success))]',
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}
