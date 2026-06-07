import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export interface SessionStatTileProps {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'info' | 'warning';
}

const TONE_CLASS: Record<NonNullable<SessionStatTileProps['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
};

export function SessionStatTile({ label, value, icon, tone = 'default' }: SessionStatTileProps) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <p className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={clsx('mt-0.5 truncate font-mono text-xs font-bold tabular-nums leading-tight', TONE_CLASS[tone])}>
        {value}
      </p>
    </div>
  );
}
