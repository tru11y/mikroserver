import type {
  DailyRecommendationPriority,
  FormattedRevenuePoint,
  RevenueChartPoint,
  SubscriptionDailyList,
  TicketReportResponse,
} from './analytics.types';

export function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatCurrency(value: number): string {
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function getActivationRate(row: TicketReportResponse['breakdowns']['routers'][number]): string {
  if (row.created === 0) {
    return '0%';
  }

  return `${Math.round((row.activated / row.created) * 100)}%`;
}

export function getRecommendationPriorityClass(priority: DailyRecommendationPriority): string {
  if (priority === 'HIGH') {
    return 'border-red-400/40 bg-red-500/10 text-red-200';
  }
  if (priority === 'MEDIUM') {
    return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  }
  return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
}

export function createEmptySubscriptionDailyList(date: string): SubscriptionDailyList {
  return {
    date,
    count: 0,
    uniqueCustomers: 0,
    totalRevenueXof: 0,
    items: [],
  };
}

export function createEmptyTicketReport(): TicketReportResponse {
  return {
    summary: {
      created: 0,
      activated: 0,
      completed: 0,
      deleted: 0,
      deliveryFailed: 0,
      totalActivatedAmountXof: 0,
      routersTouched: 0,
      operatorsTouched: 0,
      plansTouched: 0,
    },
    breakdowns: {
      routers: [],
      operators: [],
      plans: [],
    },
    recentDeliveryFailures: [],
  };
}

export function formatRevenuePoints(points: RevenueChartPoint[]): FormattedRevenuePoint[] {
  return points.map((point) => ({
    date: new Date(point.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    }),
    revenus: point.revenueXof ?? 0,
    transactions: point.transactions ?? 0,
  }));
}
