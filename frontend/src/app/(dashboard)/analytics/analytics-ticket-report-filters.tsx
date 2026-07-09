'use client';

import { AlertTriangle } from 'lucide-react';
import type { PlanItem, UserItem } from './analytics.types';

interface Props {
  startDate: string;
  endDate: string;
  operatorId: string;
  planId: string;
  users: UserItem[];
  plans: PlanItem[];
  isDateRangeValid: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onOperatorChange: (value: string) => void;
  onPlanChange: (value: string) => void;
}

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background';

export function AnalyticsTicketReportFilters({
  startDate,
  endDate,
  operatorId,
  planId,
  users,
  plans,
  isDateRangeValid,
  onStartDateChange,
  onEndDateChange,
  onOperatorChange,
  onPlanChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="report-start" className="text-sm font-medium">
            Date début
          </label>
          <input
            id="report-start"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="report-end" className="text-sm font-medium">
            Date fin
          </label>
          <input
            id="report-end"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="report-operator" className="text-sm font-medium">
            Opérateur
          </label>
          <select
            id="report-operator"
            value={operatorId}
            onChange={(e) => onOperatorChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Tous</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {`${user.firstName} ${user.lastName}`.trim()} — {user.role}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="report-plan" className="text-sm font-medium">
            Forfait
          </label>
          <select
            id="report-plan"
            value={planId}
            onChange={(e) => onPlanChange(e.target.value)}
            className={inputClass}
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
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          La date de début doit être inférieure ou égale à la date de fin.
        </div>
      )}
    </div>
  );
}
