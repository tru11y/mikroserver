import { Skeleton } from '@/components/ui/skeleton';

export function NotificationsSkeletonRow() {
  return (
    <div className="flex gap-3 px-4 py-3" aria-hidden="true">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
        <Skeleton className="h-3 w-full max-w-xs" />
        <Skeleton className="h-4 w-20 rounded" />
      </div>
    </div>
  );
}
