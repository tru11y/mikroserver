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

const currencyFormatter = new Intl.NumberFormat('fr-CI', {
  style: 'currency',
  currency: 'XOF',
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
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

const PRIORITY_CLASSES: Record<DailyRecommendationPriority, string> = {
  HIGH:   'border-destructive/40 bg-destructive/10 text-destructive',
  MEDIUM: 'border-warning/40 bg-warning/10 text-warning',
  LOW:    'border-success/40 bg-success/10 text-success',
};

export function getRecommendationPriorityClass(priority: DailyRecommendationPriority): string {
  return PRIORITY_CLASSES[priority];
}

const PRIORITY_LABELS: Record<DailyRecommendationPriority, string> = {
  HIGH:   'Urgent',
  MEDIUM: 'Moyen',
  LOW:    'Faible',
};

export function getRecommendationPriorityLabel(priority: DailyRecommendationPriority): string {
  return PRIORITY_LABELS[priority];
}

const CATEGORY_LABELS: Record<string, string> = {
  OPERATIONS: 'Opérations',
  RETENTION:  'Rétention',
  CATALOG:    'Catalogue',
};

export function getRecommendationCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
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
