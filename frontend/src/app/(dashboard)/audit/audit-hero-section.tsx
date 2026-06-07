import { Clock3, FileSearch, ShieldAlert, Trash2 } from 'lucide-react';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import type { AuditSummary } from './audit.types';
import type { ElementType } from 'react';

interface KpiCardProps {
  label: string;
  value: number;
  Icon: ElementType;
  colorClass: string;
  bgClass: string;
}

function KpiCard({ label, value, Icon, colorClass, bgClass }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/80 p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${bgClass}`}
        >
          <Icon className={`h-4 w-4 ${colorClass}`} aria-hidden="true" />
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums">{value.toLocaleString('fr-FR')}</p>
    </div>
  );
}

interface AuditHeroSectionProps {
  summary: AuditSummary;
  isLoading: boolean;
}

export function AuditHeroSection({ summary, isLoading }: AuditHeroSectionProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Chargement des statistiques"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards: KpiCardProps[] = [
    {
      label: 'Total',
      value: summary.total,
      Icon: FileSearch,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: "Aujourd'hui",
      value: summary.today,
      Icon: Clock3,
      colorClass: 'text-info',
      bgClass: 'bg-info/10',
    },
    {
      label: 'Suppressions',
      value: summary.delete,
      Icon: Trash2,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
    },
    {
      label: 'Alertes sécurité',
      value: summary.security,
      Icon: ShieldAlert,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
