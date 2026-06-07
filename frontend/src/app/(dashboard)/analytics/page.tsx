'use client';

import { BarChart3 } from 'lucide-react';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { AnalyticsRevenueChartsSection } from '@/components/charts/lazy';
import { AnalyticsOverviewSection } from './analytics-overview-section';
import { AnalyticsRecommendationsSection } from './analytics-recommendations-section';
import { AnalyticsSubscriptionsSection } from './analytics-subscriptions-section';
import { AnalyticsTicketReportSection } from './analytics-ticket-report-section';
import { useAnalyticsData } from './use-analytics-data';

function PageLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center" role="alert">
      <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">Accès limité</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ton profil ne permet pas de consulter les rapports.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const a = useAnalyticsData();

  if (a.isMeLoading) return <PageLoading />;
  if (!a.canViewReports) return <AccessDenied />;

  return (
    <main className="space-y-5">
      <AnalyticsOverviewSection
        metrics={a.metrics}
        revenueGrowth={a.revenueGrowth}
        isLoading={a.isKpisLoading}
        canExportReports={a.canExportReports}
        isExporting={a.isExporting}
        onExport={a.handleExport}
      />

      <AnalyticsSubscriptionsSection
        subscriptionsToday={a.subscriptionsToday}
        subscriptionsExpiringToday={a.subscriptionsExpiringToday}
        topRecurringClients={a.topRecurringClients}
        topRecurringPlans={a.topRecurringPlans}
        isLoading={a.isSubscriptionsLoading}
      />

      <AnalyticsRecommendationsSection
        recommendations={a.dailyRecommendations}
        generatedAt={a.recommendationsGeneratedAt}
      />

      <AnalyticsTicketReportSection
        startDate={a.startDate}
        endDate={a.endDate}
        operatorId={a.operatorId}
        planId={a.planId}
        users={a.users}
        plans={a.plans}
        report={a.report}
        isReportLoading={a.isReportLoading}
        isFetching={a.isReportFetching}
        reportError={a.reportError}
        isDateRangeValid={a.isDateRangeValid}
        onStartDateChange={a.setStartDate}
        onEndDateChange={a.setEndDate}
        onOperatorChange={a.setOperatorId}
        onPlanChange={a.setPlanId}
        onRetry={a.handleRetry}
      />

      <AnalyticsRevenueChartsSection
        points={a.formattedRevenuePoints}
        rawPoints={a.rawRevenuePoints}
        isLoading={a.isChartsLoading}
        periodKey={a.chartPeriod.key}
        periodDays={a.chartPeriod.days}
        onPeriodChange={a.setChartPeriod}
      />
    </main>
  );
}
