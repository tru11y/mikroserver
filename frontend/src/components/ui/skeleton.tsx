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

/** Plan card skeleton — matches PlanCard layout */
export function PlanCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex gap-3 border-t pt-4">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** Subscription usage section skeleton — matches 3 UsageMeter rows */
export function SubscriptionUsageSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <Skeleton className="h-3 w-24" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Subscription plan card skeleton */
export function SubscriptionPlanCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
      <div className="pt-3 border-t space-y-1.5">
        <Skeleton className="h-2.5 w-32" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Audit log skeleton — table on desktop, cards on mobile */
export function AuditTableSkeleton() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse" aria-hidden="true">
          <thead>
            <tr className="border-b border-border/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <td key={i} className="px-4 py-2.5">
                  <Skeleton className="h-3 w-16" />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={6} />
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="space-y-3 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-3 border-t border-border/40 pt-2.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

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
