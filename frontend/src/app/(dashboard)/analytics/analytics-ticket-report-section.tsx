'use client';

import type { ComponentType } from 'react';
import { AlertTriangle, BarChart3, FileWarning, Router, Ticket, TrendingUp, UserRound } from 'lucide-react';
import type { PlanItem, TicketReportResponse, UserItem } from './analytics.types';
import { AnalyticsBreakdownTable } from './analytics-breakdown-table';
import { formatCurrency } from './analytics.utils';

export function AnalyticsTicketReportSection({
  startDate,
  endDate,
  operatorId,
  planId,
  users,
  plans,
  report,
  isReportLoading,
  reportError,
  isDateRangeValid,
  onStartDateChange,
  onEndDateChange,
  onOperatorChange,
  onPlanChange,
}: {
  startDate: string;
  endDate: string;
  operatorId: string;
  planId: string;
  users: UserItem[];
  plans: PlanItem[];
  report: TicketReportResponse;
  isReportLoading: boolean;
  reportError: unknown;
  isDateRangeValid: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onOperatorChange: (value: string) => void;
  onPlanChange: (value: string) => void;
}) {
  const reportCards: Array<{
    label: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { label: 'Tickets crees', value: report.summary.created, icon: Ticket },
    { label: 'Tickets actives', value: report.summary.activated, icon: TrendingUp },
    { label: 'Tickets termines', value: report.summary.completed, icon: BarChart3 },
    { label: 'Tickets supprimes', value: report.summary.deleted, icon: AlertTriangle },
    { label: 'Delivery KO', value: report.summary.deliveryFailed, icon: FileWarning },
    { label: 'Routeurs touches', value: report.summary.routersTouched, icon: Router },
  ];

  return (
    <section id="tickets" className="space-y-6">
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <div>
          <h2 className="font-semibold">Rapport d&apos;exploitation tickets</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lecture orientee terrain: creation, activation, fin de service, suppressions
            et incidents de delivery.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date debut</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Operateur</label>
            <select
              value={operatorId}
              onChange={(event) => onOperatorChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tous</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.firstName} ${user.lastName}`.trim()} - {user.role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Forfait</label>
            <select
              value={planId}
              onChange={(event) => onPlanChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tous les forfaits</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isDateRangeValid && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            La date de debut doit etre inferieure ou egale a la date de fin.
          </div>
        )}

        {reportError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Impossible de charger le rapport pour cette combinaison de filtres.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">
                {isReportLoading ? '...' : value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border bg-[linear-gradient(135deg,rgba(236,72,153,0.08),rgba(59,130,246,0.08))] p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Total des tickets actives
            </p>
            <p className="mt-2 text-3xl font-bold">
              {formatCurrency(report.summary.totalActivatedAmountXof)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Operateurs touches: {report.summary.operatorsTouched} | Forfaits touches:{' '}
              {report.summary.plansTouched}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-300" />
              <h3 className="font-semibold">Derniers echecs de delivery</h3>
            </div>
            {report.recentDeliveryFailures.length > 0 ? (
              <div className="mt-4 space-y-3">
                {report.recentDeliveryFailures.slice(0, 5).map((failure) => (
                  <div
                    key={`${failure.code}-${failure.updatedAt}`}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{failure.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(failure.updatedAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {failure.routerName ?? 'Sans routeur'} |{' '}
                      {failure.operatorName ?? 'Systeme / paiement'}
                    </p>
                    <p className="mt-2 text-sm text-amber-200/90">
                      {failure.error ?? 'Erreur de livraison non detaillee'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Aucun echec de delivery sur la periode choisie.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AnalyticsBreakdownTable
          title="Performance par routeur"
          subtitle="Comparaison des activations et revenus par point d'acces."
          rows={report.breakdowns.routers}
          icon={Router}
        />
        <AnalyticsBreakdownTable
          title="Performance par operateur"
          subtitle="Suivi par caissier, superviseur ou revendeur."
          rows={report.breakdowns.operators}
          icon={UserRound}
        />
      </div>

      <AnalyticsBreakdownTable
        title="Performance par forfait"
        subtitle="Lecture produit et montee en puissance commerciale."
        rows={report.breakdowns.plans}
        icon={Ticket}
      />
    </section>
  );
}
