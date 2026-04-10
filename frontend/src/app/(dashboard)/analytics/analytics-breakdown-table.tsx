'use client';

import type { ComponentType } from 'react';
import type { TicketReportBreakdownRow } from './analytics.types';
import { formatCurrency, getActivationRate } from './analytics.utils';

export function AnalyticsBreakdownTable({
  title,
  subtitle,
  rows,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  rows: TicketReportBreakdownRow[];
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-muted p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune donnee disponible pour cette vue.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-3 font-medium">Nom</th>
                <th className="pb-3 pr-3 font-medium">Crees</th>
                <th className="pb-3 pr-3 font-medium">Actives</th>
                <th className="pb-3 pr-3 font-medium">Taux</th>
                <th className="pb-3 pr-3 font-medium">Termines</th>
                <th className="pb-3 pr-3 font-medium">Delivery KO</th>
                <th className="pb-3 text-right font-medium">Montant active</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-3 align-top">
                    <div className="font-medium">{row.name}</div>
                    {row.secondaryLabel && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {row.secondaryLabel}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">{row.created}</td>
                  <td className="py-3 pr-3 tabular-nums">{row.activated}</td>
                  <td className="py-3 pr-3 tabular-nums">{getActivationRate(row)}</td>
                  <td className="py-3 pr-3 tabular-nums">{row.completed}</td>
                  <td className="py-3 pr-3 tabular-nums">{row.deliveryFailed}</td>
                  <td className="py-3 text-right tabular-nums">
                    {formatCurrency(row.activatedAmountXof)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
