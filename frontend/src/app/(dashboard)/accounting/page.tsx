'use client';

import { useState } from 'react';
import { FileText, Router, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { apiError } from '@/lib/api';
import { useAccountingData } from './use-accounting-data';
import { AccountingHeroSection } from './accounting-hero-section';
import { AccountingRevenuePeriodSection } from './accounting-revenue-period-section';
import { AccountingRevenueRouterSection } from './accounting-revenue-router-section';
import { AccountingInvoicesSection } from './accounting-invoices-section';

type Tab = 'revenue-period' | 'revenue-router' | 'invoices';

const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: 'revenue-period', label: 'Tendance mensuelle', icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> },
  { key: 'revenue-router', label: 'Par routeur', icon: <Router className="h-3.5 w-3.5" aria-hidden="true" /> },
  { key: 'invoices', label: 'Factures', icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" /> },
];

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('revenue-period');
  const [isExporting, setIsExporting] = useState(false);

  const {
    kpis,
    isInvoicesLoading,
    isInvoicesError,
    refetchInvoices,
    invoices,
    invoiceTotal,
    routerData,
    isRouterLoading,
    isRouterError,
    refetchRouter,
  } = useAccountingData();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiClient.get('/accounting/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'comptabilite.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé avec succès');
    } catch (err) {
      toast.error(apiError(err, "Erreur lors de l'export CSV"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="p-4 md:p-6 space-y-4 md:space-y-6">
      <AccountingHeroSection
        kpis={kpis}
        isLoading={isInvoicesLoading}
        isError={isInvoicesError}
        isExporting={isExporting}
        onRetry={refetchInvoices}
        onExport={handleExport}
      />

      <div
        className="flex overflow-x-auto gap-1 bg-muted/30 rounded-lg p-1 w-fit"
        role="tablist"
        aria-label="Navigation comptabilité"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium',
              'transition-all duration-200 ease-out active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              tab === t.key
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'revenue-period' && <AccountingRevenuePeriodSection />}
      {tab === 'revenue-router' && (
        <AccountingRevenueRouterSection
          data={routerData}
          isLoading={isRouterLoading}
          isError={isRouterError}
          onRetry={refetchRouter}
        />
      )}
      {tab === 'invoices' && (
        <AccountingInvoicesSection
          invoices={invoices}
          total={invoiceTotal}
          isLoading={isInvoicesLoading}
          isError={isInvoicesError}
          onRetry={refetchInvoices}
        />
      )}
    </main>
  );
}
