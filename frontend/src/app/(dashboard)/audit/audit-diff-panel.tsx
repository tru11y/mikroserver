'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

function formatJson(value: Record<string, unknown> | null): string {
  if (!value || Object.keys(value).length === 0) return '{}';
  return JSON.stringify(value, null, 2);
}

interface AuditDiffPanelProps {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changeKeys: string[];
}

export function AuditDiffPanel({ oldValues, newValues, changeKeys }: AuditDiffPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground',
          'transition-all duration-200 ease-out active:scale-[0.99] hover:text-foreground hover:bg-muted/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          open && 'border-b border-border/60',
        )}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        )}
        Détails techniques
        {changeKeys.length > 0 && (
          <span className="ml-1 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px]">
            {changeKeys.length} champ{changeKeys.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="grid gap-3 p-3 xl:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Avant
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted/20 p-3 text-xs leading-relaxed">
              {formatJson(oldValues)}
            </pre>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Après
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted/20 p-3 text-xs leading-relaxed">
              {formatJson(newValues)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
