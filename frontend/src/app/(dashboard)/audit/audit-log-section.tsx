'use client';

import { History } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { AuditTableSkeleton } from '@/components/ui/skeleton';
import { AuditRowCard } from './audit-row-card';
import { AuditTableRow } from './audit-table-row';
import type { AuditItem, AuditPagination, AuditSummary } from './audit.types';

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

const BTN_BASE =
  'rounded-lg border border-border/60 px-3 py-1.5 text-xs transition-all duration-200 ease-out active:scale-[0.98] hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface AuditLogSectionProps {
  items: AuditItem[];
  pagination: AuditPagination;
  summary: AuditSummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

export function AuditLogSection({
  items,
  pagination,
  summary,
  isLoading,
  isError,
  onRetry,
  onPageChange,
}: AuditLogSectionProps) {
  const pageNumbers = generatePageNumbers(pagination.page, pagination.totalPages);

  return (
    <section
      aria-labelledby="audit-log-heading"
      className="rounded-xl border border-border/60 bg-card/80"
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
        <div>
          <h2 id="audit-log-heading" className="font-semibold">
            Événements tracés
          </h2>
          {!isLoading && !isError && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pagination.total.toLocaleString('fr-FR')} résultat
              {pagination.total !== 1 ? 's' : ''} — page {pagination.page}/{pagination.totalPages}
            </p>
          )}
        </div>
        {!isLoading && !isError && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-success">{summary.create}</span> créations
            </span>
            <span>
              <span className="font-medium text-info">{summary.update}</span> mises à jour
            </span>
            <span>
              <span className="font-medium text-destructive">{summary.delete}</span> suppressions
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-5">
        {isLoading ? (
          <AuditTableSkeleton />
        ) : isError ? (
          <ErrorState
            title="Impossible de charger les logs d'audit"
            message="Une erreur est survenue lors de la récupération des données."
            onRetry={onRetry}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Aucun événement trouvé"
            description="Modifiez les filtres pour affiner votre recherche."
          />
        ) : (
          <>
            {/* Mobile : cards */}
            <div className="space-y-3 lg:hidden">
              {items.map((item) => (
                <AuditRowCard key={item.id} item={item} />
              ))}
            </div>

            {/* Desktop : table dense */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Journal d&apos;audit — liste des événements</caption>
                <thead>
                  <tr className="border-b border-border/60">
                    {['Horodatage', 'Acteur', 'Action', 'Entité', 'IP', 'Routeur'].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <AuditTableRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-t border-border/40 px-5 py-3">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className={BTN_BASE}
            aria-label="Page précédente"
          >
            ←
          </button>

          {pageNumbers.map((p, i) =>
            p === '...' ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1.5 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p as number)}
                aria-label={`Page ${p}`}
                aria-current={p === pagination.page ? 'page' : undefined}
                className={
                  p === pagination.page
                    ? 'rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                    : BTN_BASE
                }
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className={BTN_BASE}
            aria-label="Page suivante"
          >
            →
          </button>
        </div>
      )}
    </section>
  );
}
