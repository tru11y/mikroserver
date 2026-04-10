'use client';

import { BarChart3 } from 'lucide-react';
import { AnalyticsOverviewSection } from './analytics-overview-section';
import { AnalyticsRecommendationsSection } from './analytics-recommendations-section';
import { AnalyticsRevenueChartsSection } from './analytics-revenue-charts-section';
import { AnalyticsSubscriptionsSection } from './analytics-subscriptions-section';
import { AnalyticsTicketReportSection } from './analytics-ticket-report-section';
import { useAnalyticsData } from './use-analytics-data';

function AnalyticsPageLoading() {
  return (
    <div className="space-y-4">
      <div className="h-36 animate-pulse rounded-2xl border bg-card/70" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-xl border bg-card/70" />
        ))}
      </div>
    </div>
  );
}

function AnalyticsAccessDenied() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ton profil ne permet pas de consulter les rapports.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const analytics = useAnalyticsData();

  if (analytics.isMeLoading) {
    return <AnalyticsPageLoading />;
  }

  if (!analytics.canViewReports) {
    return <AnalyticsAccessDenied />;
  }

  return (
    <div className="space-y-6">
      <AnalyticsOverviewSection
        metrics={analytics.metrics}
        canExportReports={analytics.canExportReports}
        isExporting={analytics.isExporting}
        onExport={analytics.handleExport}
      />

      <AnalyticsSubscriptionsSection
        subscriptionsToday={analytics.subscriptionsToday}
        subscriptionsExpiringToday={analytics.subscriptionsExpiringToday}
        topRecurringClients={analytics.topRecurringClients}
        topRecurringPlans={analytics.topRecurringPlans}
      />

      <AnalyticsRecommendationsSection
        recommendations={analytics.dailyRecommendations}
        generatedAt={analytics.recommendationsGeneratedAt}
      />

      <AnalyticsTicketReportSection
        startDate={analytics.startDate}
        endDate={analytics.endDate}
        operatorId={analytics.operatorId}
        planId={analytics.planId}
        users={analytics.users}
        plans={analytics.plans}
        report={analytics.report}
        isReportLoading={analytics.isReportLoading}
        reportError={analytics.reportError}
        isDateRangeValid={analytics.isDateRangeValid}
        onStartDateChange={analytics.setStartDate}
        onEndDateChange={analytics.setEndDate}
        onOperatorChange={analytics.setOperatorId}
        onPlanChange={analytics.setPlanId}
      />

      <AnalyticsRevenueChartsSection points={analytics.formattedRevenuePoints} />
    </div>
  );
}
