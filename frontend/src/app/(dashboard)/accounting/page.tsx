'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, TrendingUp, Router, Calendar, FileText, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import { accountingApi, Invoice } from '@/lib/api/accounting';
import { apiClient } from '@/lib/api/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatXof(n: number) {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-muted text-muted-foreground', icon: <FileText className="h-3 w-3" /> },
  SENT: { label: 'Envoyée', className: 'bg-blue-500/10 text-blue-600', icon: <Clock className="h-3 w-3" /> },
  PAID: { label: 'Payée', className: 'bg-green-500/10 text-green-600', icon: <CheckCircle className="h-3 w-3" /> },
  OVERDUE: { label: 'En retard', className: 'bg-destructive/10 text-destructive', icon: <AlertCircle className="h-3 w-3" /> },
  CANCELLED: { label: 'Annulée', className: 'bg-muted text-muted-foreground', icon: <FileText className="h-3 w-3" /> },
};

export default function AccountingPage() {
  const [tab, setTab] = useState<'invoices' | 'revenue-router' | 'revenue-period'>('revenue-period');

  const { data: periodData, isLoading: isPeriodLoading } = useQuery({
    queryKey: ['revenue-period'],
    queryFn: async () => {
      const res = await accountingApi.getRevenueByPeriod({ months: 6 });
      return (res.data as unknown as { data: Array<{ month: string; year: number; monthNum: number; totalXof: number; transactionCount: number }> }).data;
    },
  });

  const { data: routerData, isLoading: isRouterLoading } = useQuery({
    queryKey: ['revenue-router'],
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
      const to = now.toISOString();
      const res = await accountingApi.getRevenueByRouter({ from, to });
      return (res.data as unknown as { data: Array<{ routerName: string; routerId: string; totalXof: number; transactionCount: number }> }).data;
    },
  });

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await accountingApi.getInvoices({ limit: 20 });
      return (res.data as unknown as { data: { items: Invoice[]; total: number } }).data;
    },
  });

  const handleExport = async () => {
    const res = await apiClient.get('/accounting/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'comptabilite.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Comptabilité
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Revenus, factures et analyses financières</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Transactions CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
        {([
          { key: 'revenue-period', label: 'Tendance mensuelle', icon: <TrendingUp className="h-4 w-4" /> },
          { key: 'revenue-router', label: 'Par routeur', icon: <Router className="h-4 w-4" /> },
          { key: 'invoices', label: 'Factures', icon: <FileText className="h-4 w-4" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              tab === t.key ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Revenue by period */}
      {tab === 'revenue-period' && (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Revenus des 6 derniers mois
            </h2>
          </div>
          {isPeriodLoading ? (
            <div className="divide-y animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-32" />
                    <div className="h-4 bg-muted rounded w-20" />
                  </div>
                  <div className="h-4 bg-muted rounded w-24" />
                </div>
              ))}
            </div>
          ) : (
          <div className="divide-y">
            {!periodData?.length && (
              <div className="py-8 text-center text-muted-foreground text-sm">Aucune donnée</div>
            )}
            {periodData?.map((row) => (
              <div key={`${row.year}-${row.monthNum}`} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium capitalize">{row.month} {row.year}</p>
                  <p className="text-xs text-muted-foreground">{row.transactionCount} transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatXof(row.totalXof)}</p>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Revenue by router */}
      {tab === 'revenue-router' && (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Router className="h-4 w-4" /> Revenus par routeur
            </h2>
          </div>
          {isRouterLoading ? (
            <table className="w-full text-sm animate-pulse">
              <thead className="border-b bg-muted/30">
                <tr>
                  {['Routeur', 'Transactions', 'Revenus bruts'].map((h) => (
                    <th key={h} className="px-6 py-3"><div className="h-4 bg-muted rounded w-20 ml-auto first:ml-0" /></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-24 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Routeur</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Transactions</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Revenus bruts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!routerData?.length && (
                <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Aucune donnée</td></tr>
              )}
              {routerData?.map((row) => (
                <tr key={row.routerId} className="hover:bg-muted/20">
                  <td className="px-6 py-3 font-medium">{row.routerName}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground">{row.transactionCount}</td>
                  <td className="px-6 py-3 text-right font-bold">{formatXof(row.totalXof)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* Invoices */}
      {tab === 'invoices' && (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Factures ({invoicesData?.total ?? 0})
            </h2>
          </div>
          {isInvoicesLoading ? (
            <table className="w-full text-sm animate-pulse">
              <thead className="border-b bg-muted/30">
                <tr>
                  {['N°', 'Type', 'Période', 'Montant TTC', 'Statut', 'PDF'].map((h) => (
                    <th key={h} className="px-6 py-3"><div className="h-4 bg-muted rounded w-16" /></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-24 ml-auto" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">N°</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Période</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Montant TTC</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!invoicesData?.items?.length && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucune facture</td></tr>
              )}
              {invoicesData?.items?.map((inv) => {
                const sc = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG['DRAFT'];
                return (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="px-6 py-3 font-mono text-xs">{inv.number}</td>
                    <td className="px-6 py-3">{inv.type === 'PLATFORM_FEE' ? 'Abonnement plateforme' : inv.type}</td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">
                      {inv.periodStart ? format(new Date(inv.periodStart), 'MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-bold">{formatXof(inv.totalXof)}</td>
                    <td className="px-6 py-3">
                      <span className={`flex items-center gap-1 w-fit text-xs px-2 py-0.5 rounded-full ${sc.className}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <a
                        href={`/proxy/api/v1/accounting/invoices/${inv.id}/pdf`}
                        download={`facture-${inv.number}.pdf`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Télécharger
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      )}
    </div>
  );
}
