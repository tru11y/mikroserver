export interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface PlanItem {
  id: string;
  name: string;
}

export interface TicketReportBreakdownRow {
  id: string;
  name: string;
  secondaryLabel?: string | null;
  created: number;
  activated: number;
  completed: number;
  deliveryFailed: number;
  activatedAmountXof: number;
}

export interface TicketReportFailureRow {
  code: string;
  routerName?: string | null;
  operatorName?: string | null;
  error?: string | null;
  updatedAt: string;
}

export interface TicketReportResponse {
  summary: {
    created: number;
    activated: number;
    completed: number;
    deleted: number;
    deliveryFailed: number;
    totalActivatedAmountXof: number;
    routersTouched: number;
    operatorsTouched: number;
    plansTouched: number;
  };
  breakdowns: {
    routers: TicketReportBreakdownRow[];
    operators: TicketReportBreakdownRow[];
    plans: TicketReportBreakdownRow[];
  };
  recentDeliveryFailures: TicketReportFailureRow[];
}

export interface SubscriptionTimelineEntry {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  status: string;
  autoRenew: boolean;
  priceXof: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface SubscriptionDailyList {
  date: string;
  count: number;
  uniqueCustomers: number;
  totalRevenueXof: number;
  items: SubscriptionTimelineEntry[];
}

export interface TopRecurringClient {
  userId: string;
  customerName: string;
  customerEmail: string;
  subscriptionsCount: number;
  totalSpentXof: number;
  lastSubscriptionAt: string | null;
}

export interface TopRecurringPlan {
  planId: string;
  planName: string;
  subscriptionsCount: number;
  totalRevenueXof: number;
  lastSubscriptionAt: string | null;
}

export type DailyRecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type DailyRecommendationCategory = 'OPERATIONS' | 'RETENTION' | 'CATALOG';

export interface DailyRecommendation {
  id: string;
  title: string;
  summary: string;
  category: DailyRecommendationCategory;
  priority: DailyRecommendationPriority;
  confidence: number;
  reasons: string[];
  actionLabel: string;
  actionPath: string;
  generatedAt: string;
}

export interface AnalyticsKpiResponse {
  revenue?: {
    today?: number;
    thisMonth?: number;
    last30Days?: number;
    total?: number;
  };
  transactions?: {
    today?: number;
    thisMonth?: number;
    successRate?: number;
    pending?: number;
  };
  vouchers?: {
    activeToday?: number;
    deliveryFailures?: number;
  };
  routers?: {
    online?: number;
    offline?: number;
    total?: number;
  };
  customers?: {
    uniqueToday?: number;
    uniqueThisMonth?: number;
  };
}

export interface RevenueChartPoint {
  date: string;
  revenueXof: number;
  transactions: number;
}

export interface FormattedRevenuePoint {
  date: string;
  revenus: number;
  transactions: number;
}

export interface AnalyticsCurrentUser {
  role?: string;
  permissions?: string[];
}
