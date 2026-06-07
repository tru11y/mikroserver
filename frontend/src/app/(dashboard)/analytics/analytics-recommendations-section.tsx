'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';
import type { DailyRecommendation } from './analytics.types';
import {
  getRecommendationCategoryLabel,
  getRecommendationPriorityClass,
  getRecommendationPriorityLabel,
} from './analytics.utils';

const SECTION_ID = 'analytics-recommendations-heading';

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Confiance</span>
        <span>{pct}%</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Confiance ${pct}%`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationCard({ item }: { item: DailyRecommendation }) {
  return (
    <article className="rounded-lg border bg-muted/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2.5 py-1 ${getRecommendationPriorityClass(item.priority)}`}>
          {getRecommendationPriorityLabel(item.priority)}
        </span>
        <span className="rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground">
          {getRecommendationCategoryLabel(item.category)}
        </span>
      </div>

      <ConfidenceBar confidence={item.confidence} />

      {item.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground list-none">
          {item.reasons.slice(0, 3).map((reason, index) => (
            <li key={`${item.id}-${index}`} className="flex items-start gap-1">
              <span className="mt-0.5 text-primary" aria-hidden="true">›</span>
              {reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Link
          href={item.actionPath || '/analytics'}
          className="inline-flex items-center rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          {item.actionLabel}
        </Link>
      </div>
    </article>
  );
}

export function AnalyticsRecommendationsSection({
  recommendations,
  generatedAt,
}: {
  recommendations: DailyRecommendation[];
  generatedAt: string | null;
}) {
  return (
    <section aria-labelledby={SECTION_ID} className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={SECTION_ID} className="font-semibold">
            Insights automatiques
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Actions prioritaires générées depuis incidents, abonnements et historique ventes.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
          {recommendations.length} insight{recommendations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {generatedAt && (
        <p className="text-xs text-muted-foreground">
          Généré le{' '}
          <time dateTime={generatedAt}>
            {format(parseISO(generatedAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
          </time>
        </p>
      )}

      {recommendations.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Aucun insight pour l'instant"
          description="Les recommandations apparaîtront dès que suffisamment de données seront disponibles."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {recommendations.slice(0, 8).map((item) => (
            <RecommendationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
