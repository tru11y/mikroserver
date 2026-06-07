/**
 * Lazy-loaded chart components via Next.js dynamic()
 *
 * Recharts uses browser APIs (ResizeObserver, SVG) that cause SSR errors and
 * inflate the initial bundle. All chart components are wrapped with
 * dynamic({ ssr: false }) so they only load client-side, on demand.
 */
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/ui/skeleton';

export const RevenueChart = dynamic(
  () => import('./revenue-chart').then((m) => ({ default: m.RevenueChart })),
  { ssr: false, loading: () => <ChartSkeleton rows={10} /> },
);

export const TopRoutersChart = dynamic(
  () => import('./top-routers-chart').then((m) => ({ default: m.TopRoutersChart })),
  { ssr: false, loading: () => <ChartSkeleton rows={9} /> },
);

export const AnalyticsRevenueChartsSection = dynamic(
  () =>
    import(
      '@/app/(dashboard)/analytics/analytics-revenue-charts-section'
    ).then((m) => ({ default: m.AnalyticsRevenueChartsSection })),
  { ssr: false, loading: () => <div className="grid gap-4 xl:grid-cols-2"><ChartSkeleton rows={12} /><ChartSkeleton rows={12} /></div> },
);

export const AccountingPeriodBarChart = dynamic(
  () =>
    import('./accounting-period-bar-chart').then((m) => ({
      default: m.AccountingPeriodBarChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton rows={6} /> },
);
