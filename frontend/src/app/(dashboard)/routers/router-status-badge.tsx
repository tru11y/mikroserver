import { clsx } from 'clsx';
import type { RouterStatus } from './routers.types';
import { getStatusClasses, getStatusLabel } from './routers.utils';

export function RouterStatusBadge({ status }: { status: RouterStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 transition-colors duration-150',
        getStatusClasses(status),
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
