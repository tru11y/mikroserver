import { Router } from 'lucide-react';
import { clsx } from 'clsx';
import { AuditActionBadge } from '@/components/ui/audit-action-badge';
import { AuditEntityBadge } from '@/components/ui/audit-entity-badge';
import { AuditTimestamp } from '@/components/ui/audit-timestamp';
import { AuditActorChip } from '@/components/ui/audit-actor-chip';
import { CopyableRef } from '@/components/ui/copyable-ref';
import { AuditDiffPanel } from './audit-diff-panel';
import type { AuditItem } from './audit.types';

interface AuditRowCardProps {
  item: AuditItem;
}

export function AuditRowCard({ item }: AuditRowCardProps) {
  const isAlert = item.action === 'SECURITY_ALERT';
  const hasDiff = !!(item.oldValues || item.newValues);
  const entityLabel = item.description ??
    `${item.entityType} ${item.entityLabel ?? item.entityId ?? ''}`.trim();

  return (
    <article
      className={clsx(
        'rounded-xl border p-4',
        isAlert
          ? 'border-warning/30 bg-warning/5 ring-1 ring-warning/20'
          : 'border-border/60 bg-card/60',
      )}
      aria-label={`Événement ${item.action} — ${item.entityType}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <AuditActionBadge action={item.action} />
          <AuditEntityBadge entityType={item.entityType} />
        </div>
        <AuditTimestamp iso={item.createdAt} className="shrink-0" />
      </div>

      <p className="mt-2 text-sm font-medium leading-snug">{entityLabel}</p>

      {item.entityLabel && item.description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{item.entityLabel}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/40 pt-2.5">
        <AuditActorChip actor={item.actor} />
        {item.router && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Router className="h-3 w-3" aria-hidden="true" />
            {item.router.name}
          </span>
        )}
        {item.ipAddress && <CopyableRef value={item.ipAddress} truncate={20} />}
        {item.requestId && (
          <CopyableRef value={item.requestId} truncate={12} />
        )}
      </div>

      {hasDiff && (
        <AuditDiffPanel
          oldValues={item.oldValues}
          newValues={item.newValues}
          changeKeys={item.changeKeys}
        />
      )}
    </article>
  );
}
