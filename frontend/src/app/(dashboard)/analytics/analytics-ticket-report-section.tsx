'use client';

import type { ComponentType } from 'react';
import {
  AlertTriangle,
  BarChart3,
  FileWarning,
  Loader2,
  Router,
  Ticket,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import type { PlanItem, TicketReportResponse, UserItem } from './analytics.types';
import { AnalyticsBreakdownTable } from './analytics-breakdown-table';
import { AnalyticsTicketReportFilters } from './analytics-ticket-report-filters';
import { formatCurrency } from './analytics.utils';

const SECTION_ID = 'analytics-tickets-heading';

function ReportCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">
        {isLoading ? <Skeleton className="h-9 w-16" /> : value}
      </p>
    </div>
  );
}

interface Props {
  startDate: string;
  endDate: string;
  operatorId: string;
  planId: string;
  users: UserItem[];
  plans: PlanItem[];
  report: TicketReportResponse;
  isReportLoading: boolean;
  isFetching: boolean;
  reportError: unknown;
  isDateRangeValid: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onOperatorChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onRetry: () => void;
}

export function AnalyticsTicketReportSection({
  startDate,
  endDate,
  operatorId,
  planId,
  users,
  plans,
  report,
  isReportLoading,
  isFetching,
  reportError,
  isDateRangeValid,
  onStartDateChange,
  onEndDateChange,
  onOperatorChange,
  onPlanChange,
  onRetry,
}: Props) {
  const reportCards: Array<{
    label: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { label: 'Tickets créés',    value: report.summary.created,       icon: Ticket        },
    { label: 'Tickets activés',  value: report.summary.activated,     icon: TrendingUp    },
    { label: 'Tickets terminés', value: report.summary.completed,     icon: BarChart3     },
    { label: 'Tickets supprimés',value: report.summary.deleted,       icon: AlertTriangle },
    { label: 'Delivery KO',      value: report.summary.deliveryFailed,icon: FileWarning   },
    { label: 'Routeurs touchés', value: report.summary.routersTouched,icon: Router        },
  ];

  return (
    <section
      aria-labelledby={SECTION_ID}
      className={`space-y-6 transition-opacity duration-200 ${isFetching && !isReportLoading ? 'opacity-60' : ''}`}
    >
      <div className="rounded-xl border bg-card p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={SECTION_ID} className="font-semibold flex items-center gap-2">
              Rapport d&apos;exploitation tickets
              {isFetching && !isReportLoading && (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                  aria-label="Mise à jour en cours"
                />
              )}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Création, activation, fin de service, suppressions et incidents de delivery.
            </p>
          </div>
        </div>

        {/* Filters */}
        <AnalyticsTicketReportFilters
          startDate={startDate}
          endDate={endDate}
          operatorId={operatorId}
          planId={planId}
          users={users}
          plans={plans}
          isDateRangeValid={isDateRangeValid}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onOperatorChange={onOperatorChange}
          onPlanChange={onPlanChange}
        />

        {/* Error */}
        {reportError && (
          <ErrorState
            variant="inline"
            message="Impossible de charger le rapport pour cette combinaison de filtres."
            onRetry={onRetry}
          />
        )}

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reportCards.map(({ label, value, icon }) => (
            <ReportCard
              key={label}
              label={label}
              value={value}
              icon={icon}
              isLoading={isReportLoading}
            />
          ))}
        </div>

        {/* Revenue total + delivery failures */}
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border bg-gradient-to-br from-primary/8 via-transparent to-sky-500/8 p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Total tickets activés
            </p>
            {isReportLoading ? (
              <Skeleton className="mt-2 h-9 w-40" />
            ) : (
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {formatCurrency(report.summary.totalActivatedAmountXof)}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Opérateurs : {report.summary.operatorsTouched} &middot; Forfaits :{' '}
              {report.summary.plansTouched}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileWarning className="h-4 w-4 text-warning" aria-hidden="true" />
              <h3 className="font-semibold text-sm">Derniers échecs de delivery</h3>
            </div>
            {isReportLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : report.recentDeliveryFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
                Aucun échec de delivery sur la période choisie.
              </p>
            ) : (
              <div className="space-y-2">
                {report.recentDeliveryFailures.slice(0, 5).map((failure) => (
                  <div
                    key={`${failure.code}-${failure.updatedAt}`}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm">{failure.code}</span>
                      <time
                        dateTime={failure.updatedAt}
                        className="text-xs text-muted-foreground"
                      >
                        {new Date(failure.updatedAt).toLocaleString('fr-FR')}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {failure.routerName ?? 'Sans routeur'} &middot;{' '}
                      {failure.operatorName ?? 'Système / paiement'}
                    </p>
                    {failure.error && (
                      <p className="mt-1.5 text-xs text-warning/90">{failure.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown tables */}
      <div className="grid gap-6 xl:grid-cols-2">
        <AnalyticsBreakdownTable
          title="Performance par routeur"
          subtitle="Comparaison des activations et revenus par point d'accès."
          rows={report.breakdowns.routers}
          icon={Router}
          isLoading={isReportLoading}
        />
        <AnalyticsBreakdownTable
          title="Performance par opérateur"
          subtitle="Suivi par caissier, superviseur ou revendeur."
          rows={report.breakdowns.operators}
          icon={UserRound}
          isLoading={isReportLoading}
        />
      </div>

      <AnalyticsBreakdownTable
        title="Performance par forfait"
        subtitle="Lecture produit et montée en puissance commerciale."
        rows={report.breakdowns.plans}
        icon={Ticket}
        isLoading={isReportLoading}
      />
    </section>
  );
}
