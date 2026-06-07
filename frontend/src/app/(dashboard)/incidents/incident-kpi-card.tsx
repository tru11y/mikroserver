import { clsx } from 'clsx';

type Tone = 'destructive' | 'warning' | 'info' | 'primary' | 'muted';

interface IncidentKpiCardProps {
  label: string;
  value: number;
  tone: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning:     'border-warning/30 bg-warning/10 text-warning',
  info:        'border-info/30 bg-info/10 text-info',
  primary:     'border-primary/30 bg-primary/10 text-primary',
  muted:       'border-border bg-muted/20 text-muted-foreground',
};

export function IncidentKpiCard({ label, value, tone }: IncidentKpiCardProps) {
  return (
    <div className={clsx('rounded-xl border p-4', TONE_CLASSES[tone])}>
      <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
