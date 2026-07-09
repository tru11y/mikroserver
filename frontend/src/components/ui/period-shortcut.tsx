'use client';

import { clsx } from 'clsx';

export interface PeriodOption {
  key: string;
  label: string;
  days: number;
}

export const DEFAULT_PERIOD_OPTIONS: PeriodOption[] = [
  { key: '7j',    label: '7J',      days: 7  },
  { key: '30j',   label: '30J',     days: 30 },
  { key: '90j',   label: '90J',     days: 90 },
];

interface PeriodShortcutProps {
  options?: PeriodOption[];
  activeKey: string;
  onChange: (option: PeriodOption) => void;
}

export function PeriodShortcut({
  options = DEFAULT_PERIOD_OPTIONS,
  activeKey,
  onChange,
}: PeriodShortcutProps) {
  return (
    <div role="group" aria-label="Période" className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={activeKey === opt.key}
          className={clsx(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            activeKey === opt.key
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'border border-border/60 bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
