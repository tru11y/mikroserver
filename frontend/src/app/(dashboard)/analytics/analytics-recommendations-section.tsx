'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { DailyRecommendation } from './analytics.types';
import { getRecommendationPriorityClass } from './analytics.utils';

export function AnalyticsRecommendationsSection({
  recommendations,
  generatedAt,
}: {
  recommendations: DailyRecommendation[];
  generatedAt: string | null;
}) {
  return (
    <section id="recommendations" className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Recommandations IA</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Feed actionnable genere depuis incidents, abonnements et historique ventes.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
          {recommendations.length} recommandation(s)
        </span>
      </div>

      {generatedAt && (
        <p className="text-xs text-muted-foreground">
          Genere le {new Date(generatedAt).toLocaleString('fr-FR')}
        </p>
      )}

      {recommendations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          Aucune recommandation pour l&apos;instant.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {recommendations.slice(0, 8).map((item) => (
            <article key={item.id} className="rounded-lg border bg-muted/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                </div>
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full border px-2.5 py-1 ${getRecommendationPriorityClass(item.priority)}`}
                >
                  {item.priority}
                </span>
                <span className="rounded-full border px-2.5 py-1 text-muted-foreground">
                  {item.category}
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confiance</span>
                  <span>{Math.round(item.confidence * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(item.confidence * 100)}%` }}
                  />
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {item.reasons.slice(0, 3).map((reason, index) => (
                  <li key={`${item.id}-reason-${index}`}>- {reason}</li>
                ))}
              </ul>

              <div className="mt-4">
                <Link
                  href={item.actionPath || '/analytics'}
                  className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
