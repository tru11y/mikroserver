import Link from 'next/link';
import { PriorityBadge, type Priority } from '@/components/ui/priority-badge';
import { Sparkles } from 'lucide-react';

interface DailyRecommendation {
  id:          string;
  title:       string;
  summary:     string;
  actionLabel: string;
  actionPath:  string;
  priority:    Priority;
}

interface DashboardInsightsSectionProps {
  recommendations: DailyRecommendation[];
}

export function DashboardInsightsSection({ recommendations }: DashboardInsightsSectionProps) {
  if (recommendations.length === 0) return null;

  return (
    <section aria-labelledby="insights-heading" className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <h2 id="insights-heading" className="font-semibold text-sm">Insights automatiques</h2>
        </div>
        <Link
          href="/analytics"
          className="text-xs text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
        >
          Tout voir →
        </Link>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {recommendations.slice(0, 3).map((rec) => (
          <Link
            key={rec.id}
            href={rec.actionPath || '/analytics'}
            className="rounded-md border bg-muted/20 p-3 hover:border-primary/40 hover:bg-card/80 active:scale-[0.98] transition-all duration-200 ease-out block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-xs font-semibold">{rec.title}</p>
              <PriorityBadge priority={rec.priority} />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{rec.summary}</p>
            <p className="mt-2 text-[11px] font-semibold text-primary">{rec.actionLabel} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
