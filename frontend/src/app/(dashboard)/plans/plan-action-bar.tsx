'use client';

import { Archive, Copy, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Plan } from './plans.types';

interface PlanActionBarProps {
  plan: Plan;
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

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function PlanActionBar({
  plan,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onRestore,
  isDuplicating,
  isDeleting,
  isArchiving,
  isRestoring,
}: PlanActionBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap border-t border-border/40 pt-3">
      {plan.status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => onEdit(plan)}
          aria-label={`Modifier le forfait ${plan.name}`}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary)/0.25)]',
            'bg-[hsl(var(--primary)/0.08)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary))]',
            'transition-all duration-200 ease-out',
            'hover:bg-[hsl(var(--primary)/0.15)] hover:shadow-[var(--shadow-glow)]',
            'active:scale-[0.98]',
            focusRing,
          )}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          Modifier
        </button>
      )}

      <button
        type="button"
        onClick={() => onDuplicate(plan)}
        disabled={isDuplicating}
        aria-label={`Dupliquer le forfait ${plan.name}`}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
          'transition-all duration-200 ease-out',
          'hover:bg-muted',
          'active:scale-[0.98]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          focusRing,
        )}
      >
        {isDuplicating ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3" aria-hidden="true" />
        )}
        Dupliquer
      </button>

      {plan.status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => onArchive(plan.id)}
          disabled={isArchiving}
          aria-label={`Archiver le forfait ${plan.name}`}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20',
            'px-3 py-1.5 text-xs font-medium text-amber-500',
            'transition-all duration-200 ease-out',
            'hover:bg-amber-500/08',
            'active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            focusRing,
          )}
        >
          {isArchiving ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Archive className="h-3 w-3" aria-hidden="true" />
          )}
          Archiver
        </button>
      )}

      {plan.status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => onDelete(plan.id)}
          disabled={isDeleting}
          aria-label={`Supprimer le forfait ${plan.name}`}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--destructive)/0.2)]',
            'px-3 py-1.5 text-xs font-medium text-[hsl(var(--destructive))]',
            'transition-all duration-200 ease-out',
            'hover:bg-[hsl(var(--destructive)/0.08)]',
            'active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            focusRing,
          )}
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          )}
          Supprimer
        </button>
      )}

      {plan.status === 'ARCHIVED' && (
        <button
          type="button"
          onClick={() => onRestore(plan.id)}
          disabled={isRestoring}
          aria-label={`Désarchiver le forfait ${plan.name}`}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--success)/0.2)]',
            'px-3 py-1.5 text-xs font-medium text-[hsl(var(--success))]',
            'transition-all duration-200 ease-out',
            'hover:bg-[hsl(var(--success)/0.08)]',
            'active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            focusRing,
          )}
        >
          {isRestoring ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
          )}
          Désarchiver
        </button>
      )}
    </div>
  );
}
