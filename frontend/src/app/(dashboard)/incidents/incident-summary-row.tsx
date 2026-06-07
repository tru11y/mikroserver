import { clsx } from 'clsx';

interface IncidentSummaryRowProps {
  label: string;
  value: number;
  highlight?: boolean;
}

export function IncidentSummaryRow({ label, value, highlight = false }: IncidentSummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={clsx(
          'tabular-nums font-medium',
          highlight && value > 0 && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  );
}
