import { clsx } from 'clsx';

/** Base shimmer skeleton — use inside loading states instead of spinners */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-shimmer rounded-md bg-muted',
        'bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%]',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** Full KPI card skeleton — matches KpiCard layout */
export function KpiCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/80 p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
      </div>
      <Skeleton className="h-9 w-32 mb-2.5" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/** Table row skeleton */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border/40">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Pre-mapped bar heights as Tailwind fraction classes (static strings required for purge)
const BAR_HEIGHTS = [
  'h-[60%]', 'h-[80%]', 'h-[45%]', 'h-[90%]',
  'h-[70%]', 'h-[55%]', 'h-[85%]', 'h-[65%]',
  'h-[75%]', 'h-[50%]', 'h-[88%]', 'h-[72%]',
];

/** Chart area skeleton */
export function ChartSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-60 items-end gap-2">
        {BAR_HEIGHTS.slice(0, rows).map((h, i) => (
          <div key={i} className={clsx('flex-1', h)}>
            <Skeleton className="h-full rounded-sm" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-10" />
        ))}
      </div>
    </div>
  );
}
