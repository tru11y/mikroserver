import { Router } from 'lucide-react';
import { clsx } from 'clsx';
import { AuditActionBadge } from '@/components/ui/audit-action-badge';
import { AuditEntityBadge } from '@/components/ui/audit-entity-badge';
import { AuditTimestamp } from '@/components/ui/audit-timestamp';
import { AuditActorChip } from '@/components/ui/audit-actor-chip';
import { CopyableRef } from '@/components/ui/copyable-ref';
import { AuditDiffPanel } from './audit-diff-panel';
import type { AuditItem } from './audit.types';

interface AuditTableRowProps {
  item: AuditItem;
}

export function AuditTableRow({ item }: AuditTableRowProps) {
  const isAlert = item.action === 'SECURITY_ALERT';
  const hasDiff = !!(item.oldValues || item.newValues);
  const entityLabel = item.description ??
    `${item.entityType} ${item.entityLabel ?? item.entityId ?? ''}`.trim();

  return (
    <>
      <tr
        className={clsx(
          'border-b border-border/40 transition-colors hover:bg-muted/20',
          isAlert && 'bg-warning/5',
        )}
      >
        <td className="px-4 py-2.5 align-top">
          <AuditTimestamp iso={item.createdAt} />
        </td>
        <td className="px-4 py-2.5 align-top">
          <AuditActorChip actor={item.actor} />
        </td>
        <td className="px-4 py-2.5 align-top">
          <AuditActionBadge action={item.action} />
        </td>
        <td className="max-w-[240px] px-4 py-2.5 align-top">
          <p className="truncate text-sm" title={entityLabel}>
            {entityLabel}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <AuditEntityBadge entityType={item.entityType} />
            {item.changeKeys.length > 0 && (
              <span className="inline-flex items-center rounded-md border border-border/40 bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {item.changeKeys.length} champ{item.changeKeys.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5 align-top">
          {item.ipAddress ? (
            <CopyableRef value={item.ipAddress} truncate={16} />
          ) : (
            <span className="text-xs text-muted-foreground/40" aria-hidden="true">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 align-top">
          {item.router ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Router className="h-3 w-3" aria-hidden="true" />
              {item.router.name}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40" aria-hidden="true">—</span>
          )}
        </td>
      </tr>
      {hasDiff && (
        <tr className={clsx('border-b border-border/40', isAlert && 'bg-warning/5')}>
          <td colSpan={6} className="px-4 pb-3 pt-0">
            <AuditDiffPanel
              oldValues={item.oldValues}
              newValues={item.newValues}
              changeKeys={item.changeKeys}
            />
          </td>
        </tr>
      )}
    </>
  );
}
