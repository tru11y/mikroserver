'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { PeriodOption } from '@/components/ui/period-shortcut';
import { DEFAULT_PERIOD_OPTIONS } from '@/components/ui/period-shortcut';
import type {
  AnalyticsCurrentUser,
  AnalyticsKpiResponse,
  DailyRecommendation,
  PlanItem,
  RevenueChartPoint,
  SubscriptionDailyList,
  TicketReportResponse,
  TopRecurringClient,
  TopRecurringPlan,
  UserItem,
} from './analytics.types';
import {
  createEmptySubscriptionDailyList,
  createEmptyTicketReport,
  downloadBlob,
  formatDateInput,
  formatRevenuePoints,
} from './analytics.utils';

const EMPTY_METRICS: AnalyticsKpiResponse = {
  revenue:      { today: 0, thisMonth: 0, last30Days: 0, total: 0 },
  transactions: { today: 0, thisMonth: 0, successRate: 0, pending: 0 },
  vouchers:     { activeToday: 0, deliveryFailures: 0 },
  routers:      { online: 0, offline: 0, total: 0 },
  customers:    { uniqueToday: 0, uniqueThisMonth: 0 },
};

export function useAnalyticsData() {
  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );

  const [startDate,   setStartDate]   = useState(formatDateInput(monthStart));
  const [endDate,     setEndDate]     = useState(formatDateInput(today));
  const [operatorId,  setOperatorId]  = useState('');
  const [planId,      setPlanId]      = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<PeriodOption>(DEFAULT_PERIOD_OPTIONS[1]); // 30J

  const deferredStartDate   = useDeferredValue(startDate);
  const deferredEndDate     = useDeferredValue(endDate);
  const deferredOperatorId  = useDeferredValue(operatorId);
  const deferredPlanId      = useDeferredValue(planId);

  const reportFilters = useMemo(
    () => ({
      startDate,
      endDate,
      operatorId: operatorId || undefined,
      planId:     planId     || undefined,
    }),
    [endDate, operatorId, planId, startDate],
  );

  const deferredReportFilters = useMemo(
    () => ({
      startDate:  deferredStartDate,
      endDate:    deferredEndDate,
      operatorId: deferredOperatorId || undefined,
      planId:     deferredPlanId     || undefined,
    }),
    [deferredEndDate, deferredOperatorId, deferredPlanId, deferredStartDate],
  );

  const isDateRangeValid = useMemo(() => {
    const start = Date.parse(startDate);
    const end   = Date.parse(endDate);
    return Number.isFinite(start) && Number.isFinite(end) && start <= end;
  }, [endDate, startDate]);

  // ── Current user ──────────────────────────────────────────────────────────
  const meQuery = useQuery({
    queryKey: ['analytics-me'],
    queryFn: async () => {
      const response = await api.auth.me();
      return ((response.data as { data?: AnalyticsCurrentUser })?.data ?? null) as AnalyticsCurrentUser | null;
    },
  });

  const currentUser       = meQuery.data ?? null;
  const canViewReports    = hasPermission(currentUser, 'reports.view');
  const canViewPlans      = hasPermission(currentUser, 'plans.view');
  const canViewUsers      =
    hasPermission(currentUser, 'users.view') &&
    ['ADMIN', 'SUPER_ADMIN'].includes(currentUser?.role ?? '');
  const canExportReports  = hasPermission(currentUser, 'reports.export');

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const dashboardQuery = useQuery({
    queryKey: ['metrics-dashboard'],
    queryFn: async () => {
      const response = await api.metrics.dashboard();
      return ((response.data as { data?: AnalyticsKpiResponse })?.data ?? EMPTY_METRICS) as AnalyticsKpiResponse;
    },
    enabled: canViewReports,
  });

  // ── Revenue chart (period-driven) ─────────────────────────────────────────
  const revenueChartQuery = useQuery({
    queryKey: ['revenue-chart', chartPeriod.days],
    queryFn: async () => {
      const response = await api.metrics.revenueChart(chartPeriod.days);
      return ((response.data as { data?: RevenueChartPoint[] })?.data ?? []) as RevenueChartPoint[];
    },
    enabled: canViewReports,
  });

  // ── Subscriptions today / expiring ────────────────────────────────────────
  const subscriptionsTodayQuery = useQuery({
    queryKey: ['metrics-subscriptions-today'],
    queryFn: async () => {
      const response = await api.metrics.subscriptionsToday();
      return ((response.data as { data?: SubscriptionDailyList })?.data ??
        createEmptySubscriptionDailyList(formatDateInput(today))) as SubscriptionDailyList;
    },
    enabled: canViewReports,
  });

  const subscriptionsExpiringTodayQuery = useQuery({
    queryKey: ['metrics-subscriptions-expiring-today'],
    queryFn: async () => {
      const response = await api.metrics.subscriptionsExpiringToday();
      return ((response.data as { data?: SubscriptionDailyList })?.data ??
        createEmptySubscriptionDailyList(formatDateInput(today))) as SubscriptionDailyList;
    },
    enabled: canViewReports,
  });

  // ── Top recurring ─────────────────────────────────────────────────────────
  const recurringClientsQuery = useQuery({
    queryKey: ['metrics-top-recurring-clients'],
    queryFn: async () => {
      const response = await api.metrics.topRecurringClients(30, 8);
      return (((response.data as { data?: { items?: TopRecurringClient[] } })?.data?.items ?? []) as TopRecurringClient[]);
    },
    enabled: canViewReports,
  });

  const recurringPlansQuery = useQuery({
    queryKey: ['metrics-top-recurring-plans'],
    queryFn: async () => {
      const response = await api.metrics.topRecurringPlans(30, 8);
      return (((response.data as { data?: { items?: TopRecurringPlan[] } })?.data?.items ?? []) as TopRecurringPlan[]);
    },
    enabled: canViewReports,
  });

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendationsQuery = useQuery({
    queryKey: ['metrics-daily-recommendations'],
    queryFn: async () => {
      const response = await api.metrics.dailyRecommendations();
      const payload = (response.data as { data?: { generatedAt?: string; items?: DailyRecommendation[] } })?.data;
      return {
        generatedAt: payload?.generatedAt ?? null,
        items: (payload?.items ?? []) as DailyRecommendation[],
      };
    },
    enabled: canViewReports,
    staleTime: 60_000,
  });

  // ── Ticket report ─────────────────────────────────────────────────────────
  const reportQuery = useQuery({
    queryKey: [
      'ticket-report',
      deferredReportFilters.startDate,
      deferredReportFilters.endDate,
      deferredReportFilters.operatorId,
      deferredReportFilters.planId,
    ],
    queryFn: async () => {
      const response = await api.metrics.ticketReport(deferredReportFilters);
      return ((response.data as { data?: TicketReportResponse })?.data ?? createEmptyTicketReport()) as TicketReportResponse;
    },
    enabled: canViewReports && isDateRangeValid,
    placeholderData: (prev) => prev,
  });

  // ── Users / plans for filter dropdowns ───────────────────────────────────
  const usersQuery = useQuery({
    queryKey: ['report-users'],
    queryFn: async () => {
      const response = await api.users.list();
      return (((response.data as { data?: UserItem[] })?.data ?? []) as UserItem[]).filter(
        (user) => user.role !== 'VIEWER',
      );
    },
    enabled: canViewReports && canViewUsers,
  });

  const plansQuery = useQuery({
    queryKey: ['report-plans'],
    queryFn: async () => {
      const response = await api.plans.list();
      return (((response.data as { data?: PlanItem[] })?.data ?? []) as PlanItem[]);
    },
    enabled: canViewReports && canViewPlans,
  });

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!canExportReports || !isDateRangeValid) return;
    try {
      setIsExporting(true);
      const response = await api.metrics.exportTicketReport(reportFilters);
      downloadBlob(response.data as Blob, `ticket-report-${startDate}-${endDate}.csv`);
      toast.success('Export CSV généré');
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'exporter le rapport");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRetry = () => { reportQuery.refetch(); };

  // ── Revenue growth delta (thisMonth vs last30Days) ────────────────────────
  const revenueGrowth = useMemo(() => {
    const metrics = dashboardQuery.data;
    const thisMonth  = metrics?.revenue?.thisMonth  ?? 0;
    const last30Days = metrics?.revenue?.last30Days ?? 0;
    if (!last30Days) return null;
    return (thisMonth - last30Days) / last30Days;
  }, [dashboardQuery.data]);

  // ── Raw points with ISO date for chart labelFormatter ─────────────────────
  const rawRevenuePoints = useMemo(
    () =>
      (revenueChartQuery.data ?? []).map((p) => ({
        date:         p.date,
        revenus:      p.revenueXof   ?? 0,
        transactions: p.transactions ?? 0,
      })),
    [revenueChartQuery.data],
  );

  return {
    // permissions
    currentUser,
    canViewReports,
    canExportReports,
    // auth loading
    isMeLoading: meQuery.isLoading,
    // section-level loading flags
    isKpisLoading:          dashboardQuery.isLoading,
    isChartsLoading:        revenueChartQuery.isLoading,
    isSubscriptionsLoading: subscriptionsTodayQuery.isLoading || subscriptionsExpiringTodayQuery.isLoading,
    // filters
    startDate,
    endDate,
    operatorId,
    planId,
    setStartDate,
    setEndDate,
    setOperatorId,
    setPlanId,
    isExporting,
    isDateRangeValid,
    handleExport,
    handleRetry,
    // chart period
    chartPeriod,
    setChartPeriod,
    // data
    metrics:         dashboardQuery.data ?? EMPTY_METRICS,
    revenueGrowth,
    rawRevenuePoints,
    formattedRevenuePoints: formatRevenuePoints(revenueChartQuery.data ?? []),
    subscriptionsToday:
      subscriptionsTodayQuery.data ?? createEmptySubscriptionDailyList(formatDateInput(today)),
    subscriptionsExpiringToday:
      subscriptionsExpiringTodayQuery.data ?? createEmptySubscriptionDailyList(formatDateInput(today)),
    topRecurringClients: recurringClientsQuery.data ?? [],
    topRecurringPlans:   recurringPlansQuery.data   ?? [],
    dailyRecommendations:       recommendationsQuery.data?.items     ?? [],
    recommendationsGeneratedAt: recommendationsQuery.data?.generatedAt ?? null,
    report:          reportQuery.data ?? createEmptyTicketReport(),
    isReportLoading: reportQuery.isLoading,
    isReportFetching: reportQuery.isFetching,
    reportError:     reportQuery.error,
    users:  usersQuery.data ?? [],
    plans:  plansQuery.data ?? [],
  };
}
