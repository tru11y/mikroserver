import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { endOfDay, startOfDay, subMinutes } from "date-fns";
import type {
  OperationalQueueStats,
  QueueHealthSnapshot,
} from "../queue/queue.service";

type SubscriptionWithRelationsLike = {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  auto_renew: boolean;
  price_xof: number;
  start_date: Date;
  end_date: Date;
  created_at: Date;
  users_subscriptions_user_idTousers?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  plans?: {
    id: string;
    name: string;
  } | null;
};

type SubscriptionTimelineEntryLike = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  priceXof: number;
  startDate: string;
  endDate: string;
  createdAt: string;
};

type SubscriptionDailyListLike = {
  date: string;
  count: number;
  uniqueCustomers: number;
  totalRevenueXof: number;
  items: SubscriptionTimelineEntryLike[];
};

type TicketReportBreakdownField =
  | "created"
  | "activated"
  | "completed"
  | "deliveryFailed";

type TicketReportBreakdownRowLike = {
  id: string;
  name: string;
  secondaryLabel?: string | null;
  created: number;
  activated: number;
  completed: number;
  deliveryFailed: number;
  activatedAmountXof: number;
};

type VoucherBreakdownInput = {
  routerId: string | null;
  createdById: string | null;
  planId: string;
  router: { id: string; name: string; status: string } | null;
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    email: string;
  } | null;
  plan: { id: string; name: string; priceXof: number };
};

type TicketReportBreakdownsLike = {
  routers: TicketReportBreakdownRowLike[];
  operators: TicketReportBreakdownRowLike[];
  plans: TicketReportBreakdownRowLike[];
};

type OperationalIncidentSeverityLike = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type OperationalIncidentTypeLike =
  | "ROUTER_OFFLINE"
  | "ROUTER_DEGRADED"
  | "ROUTER_SYNC_ERROR"
  | "UNMATCHED_USERS"
  | "DELIVERY_FAILURES"
  | "QUEUE_BACKLOG"
  | "OVERDUE_SESSIONS"
  | "LOW_VOUCHER_STOCK";

type OperationalIncidentLike = {
  id: string;
  severity: OperationalIncidentSeverityLike;
  type: OperationalIncidentTypeLike;
  title: string;
  description: string;
  detectedAt: string;
  entityType: "router" | "voucher" | "queue" | "system";
  entityId?: string;
  routerId?: string;
  routerName?: string;
  metadata?: Record<string, unknown>;
};

type RouterIncidentInput = {
  id: string;
  name: string;
  status: string;
  lastSeenAt: Date | null;
  lastHeartbeatAt: Date | null;
  metadata: Prisma.JsonValue | null;
};

type RouterOperationalIncidentBuildResult = {
  incidents: OperationalIncidentLike[];
  offlineRouters: number;
  degradedRouters: number;
  routersWithSyncErrors: number;
  routersWithUnmatchedUsers: number;
};

export function buildDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string,
): string {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || fallback;
}

export function mapSubscriptionTimelineEntry(
  subscription: SubscriptionWithRelationsLike,
): SubscriptionTimelineEntryLike {
  const user = subscription.users_subscriptions_user_idTousers;
  const customerName = buildDisplayName(
    user?.firstName ?? null,
    user?.lastName ?? null,
    user?.email ?? subscription.user_id,
  );

  return {
    id: subscription.id,
    userId: subscription.user_id,
    customerName,
    customerEmail: user?.email ?? "",
    planId: subscription.plan_id,
    planName: subscription.plans?.name ?? subscription.plan_id,
    status: subscription.status,
    autoRenew: subscription.auto_renew,
    priceXof: subscription.price_xof,
    startDate: subscription.start_date.toISOString(),
    endDate: subscription.end_date.toISOString(),
    createdAt: subscription.created_at.toISOString(),
  };
}

export function buildSubscriptionDailyList(
  dayStart: Date,
  rows: SubscriptionWithRelationsLike[],
): SubscriptionDailyListLike {
  const items = rows.map((subscription) =>
    mapSubscriptionTimelineEntry(subscription),
  );

  const uniqueCustomers = new Set(
    rows.map((subscription) => subscription.user_id),
  );
  const totalRevenueXof = rows.reduce(
    (sum, subscription) => sum + subscription.price_xof,
    0,
  );

  return {
    date: dayStart.toISOString().slice(0, 10),
    count: rows.length,
    uniqueCustomers: uniqueCustomers.size,
    totalRevenueXof,
    items,
  };
}

export function parseDateBoundary(
  value: string | undefined,
  boundary: "start" | "end",
): Date {
  const parsed = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return boundary === "start" ? startOfDay(safeDate) : endOfDay(safeDate);
}

export function getOperatorLabel(
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null,
): string | null {
  if (!user) {
    return null;
  }

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fullName || user.email;
}

export function buildTicketReportBreakdowns(rows: {
  createdRows: VoucherBreakdownInput[];
  activatedRows: VoucherBreakdownInput[];
  completedRows: VoucherBreakdownInput[];
  deliveryFailedRows: VoucherBreakdownInput[];
}): TicketReportBreakdownsLike {
  const routerMap = new Map<string, TicketReportBreakdownRowLike>();
  const operatorMap = new Map<string, TicketReportBreakdownRowLike>();
  const planMap = new Map<string, TicketReportBreakdownRowLike>();

  const applyVoucher = (
    voucher: VoucherBreakdownInput,
    field: TicketReportBreakdownField,
    amountXof = 0,
  ) => {
    const routerId = voucher.router?.id ?? voucher.routerId ?? "router:none";
    const routerName = voucher.router?.name ?? "Sans routeur";
    const routerStatus = voucher.router?.status ?? null;

    const operatorId =
      voucher.createdBy?.id ?? voucher.createdById ?? "operator:system";
    const operatorName =
      getOperatorLabel(voucher.createdBy) ?? "Systeme / paiement";
    const operatorRole = voucher.createdBy?.role ?? "SYSTEM";

    bumpBreakdownRow(routerMap, {
      id: routerId,
      name: routerName,
      secondaryLabel: routerStatus,
      field,
      amountXof,
    });
    bumpBreakdownRow(operatorMap, {
      id: operatorId,
      name: operatorName,
      secondaryLabel: operatorRole,
      field,
      amountXof,
    });
    bumpBreakdownRow(planMap, {
      id: voucher.plan.id ?? voucher.planId,
      name: voucher.plan.name,
      secondaryLabel: null,
      field,
      amountXof,
    });
  };

  for (const voucher of rows.createdRows) {
    applyVoucher(voucher, "created");
  }

  for (const voucher of rows.activatedRows) {
    applyVoucher(voucher, "activated", voucher.plan.priceXof);
  }

  for (const voucher of rows.completedRows) {
    applyVoucher(voucher, "completed");
  }

  for (const voucher of rows.deliveryFailedRows) {
    applyVoucher(voucher, "deliveryFailed");
  }

  return {
    routers: sortBreakdownRows(routerMap),
    operators: sortBreakdownRows(operatorMap),
    plans: sortBreakdownRows(planMap),
  };
}

function bumpBreakdownRow(
  map: Map<string, TicketReportBreakdownRowLike>,
  input: {
    id: string;
    name: string;
    secondaryLabel?: string | null;
    field: TicketReportBreakdownField;
    amountXof?: number;
  },
) {
  const current = map.get(input.id) ?? {
    id: input.id,
    name: input.name,
    secondaryLabel: input.secondaryLabel ?? null,
    created: 0,
    activated: 0,
    completed: 0,
    deliveryFailed: 0,
    activatedAmountXof: 0,
  };

  current[input.field] += 1;
  current.activatedAmountXof += input.amountXof ?? 0;
  if (!current.secondaryLabel && input.secondaryLabel) {
    current.secondaryLabel = input.secondaryLabel;
  }

  map.set(input.id, current);
}

function sortBreakdownRows(
  map: Map<string, TicketReportBreakdownRowLike>,
): TicketReportBreakdownRowLike[] {
  return Array.from(map.values()).sort((left, right) => {
    if (right.activatedAmountXof !== left.activatedAmountXof) {
      return right.activatedAmountXof - left.activatedAmountXof;
    }

    if (right.activated !== left.activated) {
      return right.activated - left.activated;
    }

    if (right.created !== left.created) {
      return right.created - left.created;
    }

    return left.name.localeCompare(right.name);
  });
}

export function appendBreakdownCsv(
  lines: string[],
  section: string,
  rows: TicketReportBreakdownRowLike[],
) {
  lines.push(
    `${section},Nom,Secondaire,Crees,Actives,Termines,Echecs delivery,Montant active XOF`,
  );
  for (const row of rows) {
    lines.push(
      [
        section,
        row.name,
        row.secondaryLabel ?? "",
        String(row.created),
        String(row.activated),
        String(row.completed),
        String(row.deliveryFailed),
        String(row.activatedAmountXof),
      ]
        .map((value) => escapeCsv(value))
        .join(","),
    );
  }
}

export function escapeCsv(value: string | number): string {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function buildRouterOperationalIncidents(
  routers: RouterIncidentInput[],
  options: {
    routerOfflineThresholdMinutes: number;
    unmatchedUsersHighThreshold: number;
  },
): RouterOperationalIncidentBuildResult {
  const incidents: OperationalIncidentLike[] = [];
  let offlineRouters = 0;
  let degradedRouters = 0;
  let routersWithSyncErrors = 0;
  let routersWithUnmatchedUsers = 0;
  const now = new Date();

  for (const router of routers) {
    const metadata = asObject(router.metadata);
    const lastSyncError = readString(metadata, "lastSyncError");
    const lastHealthCheckError = readString(metadata, "lastHealthCheckError");
    const unmatchedUsers = readStringArray(metadata, "lastUnmatchedUsers");
    const lastSyncAt = readDate(metadata, "lastSyncAt");
    const lastHealthCheckAt = readDate(metadata, "lastHealthCheckAt");
    const lastSeenAt =
      router.lastSeenAt ?? router.lastHeartbeatAt ?? lastHealthCheckAt;

    if (router.status === "OFFLINE") {
      offlineRouters += 1;
      incidents.push({
        id: `router-offline-${router.id}`,
        severity: "CRITICAL",
        type: "ROUTER_OFFLINE",
        title: `${router.name} est hors ligne`,
        description:
          lastHealthCheckError ||
          "Le routeur ne repond plus via WireGuard ou RouterOS API.",
        detectedAt: (lastSeenAt ?? now).toISOString(),
        entityType: "router",
        entityId: router.id,
        routerId: router.id,
        routerName: router.name,
        metadata: {
          status: router.status,
          lastSeenAt: lastSeenAt?.toISOString() ?? null,
          lastHealthCheckError,
        },
      });
    } else if (router.status === "DEGRADED") {
      degradedRouters += 1;
      incidents.push({
        id: `router-degraded-${router.id}`,
        severity: "HIGH",
        type: "ROUTER_DEGRADED",
        title: `${router.name} est en mode degrade`,
        description:
          lastHealthCheckError ||
          "Le routeur repond partiellement ou la supervision a detecte une degradation.",
        detectedAt: (lastHealthCheckAt ?? lastSeenAt ?? now).toISOString(),
        entityType: "router",
        entityId: router.id,
        routerId: router.id,
        routerName: router.name,
        metadata: {
          status: router.status,
          lastHealthCheckAt: lastHealthCheckAt?.toISOString() ?? null,
          lastHealthCheckError,
        },
      });
    } else if (
      lastSeenAt &&
      lastSeenAt < subMinutes(now, options.routerOfflineThresholdMinutes)
    ) {
      incidents.push({
        id: `router-stale-${router.id}`,
        severity: "MEDIUM",
        type: "ROUTER_DEGRADED",
        title: `${router.name} n'a pas ete vu recemment`,
        description: `Le routeur n'a pas ete vu depuis plus de ${options.routerOfflineThresholdMinutes} minutes.`,
        detectedAt: lastSeenAt.toISOString(),
        entityType: "router",
        entityId: router.id,
        routerId: router.id,
        routerName: router.name,
        metadata: {
          status: router.status,
          lastSeenAt: lastSeenAt.toISOString(),
        },
      });
    }

    if (lastSyncError) {
      routersWithSyncErrors += 1;
      incidents.push({
        id: `router-sync-error-${router.id}`,
        severity: "HIGH",
        type: "ROUTER_SYNC_ERROR",
        title: `${router.name} a une erreur de synchronisation`,
        description: lastSyncError,
        detectedAt: (lastSyncAt ?? now).toISOString(),
        entityType: "router",
        entityId: router.id,
        routerId: router.id,
        routerName: router.name,
        metadata: {
          lastSyncAt: lastSyncAt?.toISOString() ?? null,
        },
      });
    }

    if (unmatchedUsers.length > 0) {
      routersWithUnmatchedUsers += 1;
      incidents.push({
        id: `router-unmatched-users-${router.id}`,
        severity:
          unmatchedUsers.length >= options.unmatchedUsersHighThreshold
            ? "HIGH"
            : "MEDIUM",
        type: "UNMATCHED_USERS",
        title: `${router.name} a ${unmatchedUsers.length} utilisateur(s) non apparies`,
        description:
          "Des utilisateurs connectes sur le hotspot ne correspondent a aucun ticket connu par la plateforme.",
        detectedAt: (lastSyncAt ?? now).toISOString(),
        entityType: "router",
        entityId: router.id,
        routerId: router.id,
        routerName: router.name,
        metadata: {
          count: unmatchedUsers.length,
          usernames: unmatchedUsers.slice(0, 10),
        },
      });
    }
  }

  return {
    incidents,
    offlineRouters,
    degradedRouters,
    routersWithSyncErrors,
    routersWithUnmatchedUsers,
  };
}

export function buildQueueIncidents(
  queueStats: OperationalQueueStats,
  thresholds: {
    mediumThreshold: number;
    highThreshold: number;
  },
): OperationalIncidentLike[] {
  const incidents: OperationalIncidentLike[] = [];

  incidents.push(
    ...createQueueIncident(
      "voucher-delivery",
      "Voucher delivery",
      queueStats.voucherDelivery,
      thresholds,
    ),
    ...createQueueIncident(
      "payment-webhook",
      "Payment webhook",
      queueStats.paymentWebhook,
      thresholds,
    ),
  );

  return incidents;
}

function createQueueIncident(
  queueKey: string,
  label: string,
  snapshot: QueueHealthSnapshot,
  thresholds: {
    mediumThreshold: number;
    highThreshold: number;
  },
): OperationalIncidentLike[] {
  const incidents: OperationalIncidentLike[] = [];
  const backlog = snapshot.waiting + snapshot.delayed;

  if (snapshot.failed > 0) {
    incidents.push({
      id: `queue-failed-${queueKey}`,
      severity:
        snapshot.failed >= thresholds.mediumThreshold ? "HIGH" : "MEDIUM",
      type: "QUEUE_BACKLOG",
      title: `${label}: jobs en erreur`,
      description: `${snapshot.failed} job(s) ont echoue dans cette file.`,
      detectedAt: new Date().toISOString(),
      entityType: "queue",
      entityId: queueKey,
      metadata: {
        queue: queueKey,
        ...snapshot,
      },
    });
  }

  if (backlog >= thresholds.mediumThreshold) {
    incidents.push({
      id: `queue-backlog-${queueKey}`,
      severity: backlog >= thresholds.highThreshold ? "HIGH" : "MEDIUM",
      type: "QUEUE_BACKLOG",
      title: `${label}: backlog a traiter`,
      description: `${backlog} job(s) attendent encore traitement ou reprise.`,
      detectedAt: new Date().toISOString(),
      entityType: "queue",
      entityId: queueKey,
      metadata: {
        queue: queueKey,
        ...snapshot,
      },
    });
  }

  return incidents;
}

export function sortOperationalIncidents(
  incidents: OperationalIncidentLike[],
): OperationalIncidentLike[] {
  return [...incidents].sort((left, right) => {
    const severityRank =
      getSeverityRank(right.severity) - getSeverityRank(left.severity);
    if (severityRank !== 0) {
      return severityRank;
    }

    return (
      new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime()
    );
  });
}

export function getSeverityRank(
  severity: OperationalIncidentSeverityLike,
): number {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
    default:
      return 1;
  }
}

export function getRecommendationPriorityRank(
  priority: "HIGH" | "MEDIUM" | "LOW",
): number {
  switch (priority) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
    default:
      return 1;
  }
}

export function clampConfidence(value: number): number {
  return Math.max(0.05, Math.min(0.99, Number(value.toFixed(2))));
}

export function asObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function readString(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function readStringArray(
  source: Record<string, unknown>,
  key: string,
): string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function readDate(
  source: Record<string, unknown>,
  key: string,
): Date | null {
  const value = readString(source, key);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
