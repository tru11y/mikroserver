import { Clock, Star, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import { PlanStatusBadge } from '@/components/ui/plan-status-badge';
import { PlanTicketBlock } from './plan-ticket-block';
import { PlanActionBar } from './plan-action-bar';
import { formatDuration, formatSpeed, formatDataLimit } from './plans.utils';
import type { Plan } from './plans.types';

interface PlanCardProps {
  plan: Plan;
  canManage: boolean;
  onEdit: (plan: Plan) => void;
  onDuplicate: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
}

export function PlanCard({
  plan,
  canManage,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onRestore,
  isDuplicating,
  isDeleting,
  isArchiving,
  isRestoring,
}: PlanCardProps) {
  const isArchived = plan.status === 'ARCHIVED';

  return (
    <article
      className={clsx(
        'relative flex flex-col overflow-hidden rounded-xl border bg-card',
        'transition-all duration-200 ease-out',
        isArchived
          ? 'border-dashed opacity-60 hover:opacity-80'
          : 'hover:border-[hsl(var(--primary)/0.3)] hover:shadow-[var(--shadow-md)]',
      )}
      aria-label={`Forfait ${plan.name}`}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 p-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{plan.name}</h3>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
              {plan.slug}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {plan.isPopular && (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning)/0.1)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--warning))]"
                aria-label="Forfait populaire"
              >
                <Star className="h-2.5 w-2.5" aria-hidden="true" />
                Populaire
              </span>
            )}
            <PlanStatusBadge status={plan.status} />
          </div>
        </header>

        {/* Price — dominant visual element */}
        <div>
          <p className="text-3xl font-bold tabular-nums leading-none">
            {new Intl.NumberFormat('fr-CI', {
              style: 'currency',
              currency: 'XOF',
              maximumFractionDigits: 0,
            }).format(plan.priceXof)}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {formatDuration(plan.durationMinutes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wifi className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>↓&nbsp;{formatSpeed(plan.downloadKbps)}</span>
              <span className="text-border" aria-hidden="true">|</span>
              <span>↑&nbsp;{formatSpeed(plan.uploadKbps)}</span>
            </span>
          </div>
        </div>

        {/* Ticket settings */}
        <PlanTicketBlock
          settings={plan.ticketSettings}
          userProfile={plan.userProfile}
          dataLimitMb={plan.dataLimitMb}
          formatDataLimit={formatDataLimit}
        />

        {/* Actions */}
        {canManage && (
          <PlanActionBar
            plan={plan}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onArchive={onArchive}
            onRestore={onRestore}
            isDuplicating={isDuplicating}
            isDeleting={isDeleting}
            isArchiving={isArchiving}
            isRestoring={isRestoring}
          />
        )}
      </div>
    </article>
  );
}
