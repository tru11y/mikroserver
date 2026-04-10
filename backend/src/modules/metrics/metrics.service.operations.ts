import { AuditAction, Prisma, VoucherStatus } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { QueueService } from "../queue/queue.service";
import {
  appendBreakdownCsv,
  buildQueueIncidents,
  buildRouterOperationalIncidents,
  buildTicketReportBreakdowns,
  escapeCsv,
  getOperatorLabel,
  parseDateBoundary,
  sortOperationalIncidents,
} from "./metrics.service.helpers";
import type {
  IncidentCenter,
  OperationalIncident,
  TicketReport,
} from "./metrics.service";

export interface TicketReportFilters {
  startDate?: string;
  endDate?: string;
  operatorId?: string;
  planId?: string;
}

export interface MetricsOperationalThresholds {
  routerOfflineThresholdMinutes: number;
  unmatchedUsersHighThreshold: number;
  queueBacklogMediumThreshold: number;
  queueBacklogHighThreshold: number;
}

type MetricsPrismaReportsPort = Pick<
  PrismaService,
  "auditLog" | "router" | "voucher" | "session" | "transaction" | "plan"
>;
type MetricsQueuePort = Pick<QueueService, "getOperationalStats">;

export async function getTicketReportOperation(
  prisma: MetricsPrismaReportsPort,
  filters: TicketReportFilters,
): Promise<TicketReport> {
  const startDate = parseDateBoundary(filters.startDate, "start");
  const endDate = parseDateBoundary(filters.endDate, "end");
  const operatorId = filters.operatorId?.trim() || undefined;
  const planId = filters.planId?.trim() || undefined;

  const voucherScope = {
    ...(operatorId ? { createdById: operatorId } : {}),
    ...(planId ? { planId } : {}),
  };

  const deletedWhere: Prisma.AuditLogWhereInput = {
    entityType: "Voucher",
    action: AuditAction.DELETE,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    ...(operatorId ? { userId: operatorId } : {}),
  };

  if (planId) {
    deletedWhere.oldValues = {
      path: ["planId"],
      equals: planId,
    };
  }

  const voucherSelect = {
    id: true,
    code: true,
    updatedAt: true,
    lastDeliveryError: true,
    routerId: true,
    createdById: true,
    planId: true,
    router: {
      select: {
        id: true,
        name: true,
        status: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
      },
    },
    plan: {
      select: {
        id: true,
        name: true,
        priceXof: true,
      },
    },
  } as const;

  const [
    createdRows,
    activatedRows,
    completedRows,
    deliveryFailedRows,
    deleted,
  ] = await Promise.all([
    prisma.voucher.findMany({
      where: {
        ...voucherScope,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: voucherSelect,
    }),
    prisma.voucher.findMany({
      where: {
        ...voucherScope,
        activatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: voucherSelect,
    }),
    prisma.voucher.findMany({
      where: {
        ...voucherScope,
        status: VoucherStatus.EXPIRED,
        expiresAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: voucherSelect,
    }),
    prisma.voucher.findMany({
      where: {
        ...voucherScope,
        status: VoucherStatus.DELIVERY_FAILED,
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: voucherSelect,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.auditLog.count({
      where: deletedWhere,
    }),
  ]);

  const breakdowns = buildTicketReportBreakdowns({
    createdRows,
    activatedRows,
    completedRows,
    deliveryFailedRows,
  });

  const totalActivatedAmountXof = activatedRows.reduce(
    (sum, voucher) => sum + voucher.plan.priceXof,
    0,
  );

  return {
    filters: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      operatorId,
      planId,
    },
    summary: {
      created: createdRows.length,
      activated: activatedRows.length,
      completed: completedRows.length,
      deleted,
      deliveryFailed: deliveryFailedRows.length,
      totalActivatedAmountXof,
      routersTouched: breakdowns.routers.length,
      operatorsTouched: breakdowns.operators.length,
      plansTouched: breakdowns.plans.length,
    },
    breakdowns,
    recentDeliveryFailures: deliveryFailedRows.slice(0, 10).map((voucher) => ({
      code: voucher.code,
      routerName: voucher.router?.name ?? null,
      operatorName: getOperatorLabel(voucher.createdBy),
      error: voucher.lastDeliveryError,
      updatedAt: voucher.updatedAt.toISOString(),
    })),
  };
}

export async function exportTicketReportCsvOperation(
  prisma: MetricsPrismaReportsPort,
  filters: TicketReportFilters,
): Promise<string> {
  const report = await getTicketReportOperation(prisma, filters);
  const lines: string[] = [];

  lines.push("Section,Champ,Valeur");
  lines.push(`Resume,Date debut,${escapeCsv(report.filters.startDate)}`);
  lines.push(`Resume,Date fin,${escapeCsv(report.filters.endDate)}`);
  lines.push(
    `Resume,Operateur filtre,${escapeCsv(report.filters.operatorId ?? "Tous")}`,
  );
  lines.push(
    `Resume,Forfait filtre,${escapeCsv(report.filters.planId ?? "Tous")}`,
  );
  lines.push(`Resume,Tickets crees,${report.summary.created}`);
  lines.push(`Resume,Tickets actives,${report.summary.activated}`);
  lines.push(`Resume,Tickets termines,${report.summary.completed}`);
  lines.push(`Resume,Tickets supprimes,${report.summary.deleted}`);
  lines.push(`Resume,Echecs delivery,${report.summary.deliveryFailed}`);
  lines.push(
    `Resume,Montant active XOF,${report.summary.totalActivatedAmountXof}`,
  );
  lines.push(`Resume,Routeurs touches,${report.summary.routersTouched}`);
  lines.push(`Resume,Operateurs touches,${report.summary.operatorsTouched}`);
  lines.push(`Resume,Forfaits touches,${report.summary.plansTouched}`);
  lines.push("");

  appendBreakdownCsv(lines, "Routeurs", report.breakdowns.routers);
  lines.push("");
  appendBreakdownCsv(lines, "Operateurs", report.breakdowns.operators);
  lines.push("");
  appendBreakdownCsv(lines, "Forfaits", report.breakdowns.plans);
  lines.push("");

  lines.push(
    "Echecs delivery,Ticket,Routeur,Operateur,Erreur,Derniere mise a jour",
  );
  for (const failure of report.recentDeliveryFailures) {
    lines.push(
      [
        "Echecs delivery",
        failure.code,
        failure.routerName ?? "",
        failure.operatorName ?? "",
        failure.error ?? "",
        failure.updatedAt,
      ]
        .map((value) => escapeCsv(value))
        .join(","),
    );
  }

  return lines.join("\n");
}

export async function getIncidentCenterOperation(
  prisma: MetricsPrismaReportsPort,
  queueService: MetricsQueuePort,
  thresholds: MetricsOperationalThresholds,
): Promise<IncidentCenter> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    routers,
    deliveryFailureCount,
    recentDeliveryFailures,
    queueStats,
    overdueSessionCount,
    lowStockPlans,
  ] = await Promise.all([
    prisma.router.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        lastSeenAt: true,
        lastHeartbeatAt: true,
        metadata: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.voucher.count({
      where: { status: VoucherStatus.DELIVERY_FAILED },
    }),
    prisma.voucher.findMany({
      where: { status: VoucherStatus.DELIVERY_FAILED },
      select: {
        code: true,
        updatedAt: true,
        lastDeliveryError: true,
        router: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    queueService.getOperationalStats(),
    // Sessions with expired vouchers still marked ACTIVE in DB
    prisma.session.count({
      where: {
        status: "ACTIVE",
        voucher: { expiresAt: { lte: now } },
      },
    }),
    // Plans with recent sales but critically low GENERATED stock
    prisma.plan.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            vouchers: {
              where: { status: "GENERATED" },
            },
          },
        },
        transactions: {
          where: { status: "COMPLETED", paidAt: { gte: thirtyDaysAgo } },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  const routerIncidentState = buildRouterOperationalIncidents(routers, {
    routerOfflineThresholdMinutes: thresholds.routerOfflineThresholdMinutes,
    unmatchedUsersHighThreshold: thresholds.unmatchedUsersHighThreshold,
  });
  const incidents: OperationalIncident[] = [...routerIncidentState.incidents];

  if (deliveryFailureCount > 0) {
    incidents.push({
      id: "delivery-failures",
      severity: deliveryFailureCount >= 5 ? "HIGH" : "MEDIUM",
      type: "DELIVERY_FAILURES",
      title: `${deliveryFailureCount} ticket(s) en echec de livraison`,
      description:
        "Au moins un ticket n’a pas pu etre pousse correctement vers MikroTik.",
      detectedAt:
        recentDeliveryFailures[0]?.updatedAt.toISOString() ??
        new Date().toISOString(),
      entityType: "voucher",
      metadata: {
        recentFailures: recentDeliveryFailures.map((voucher) => ({
          code: voucher.code,
          routerId: voucher.router?.id ?? null,
          routerName: voucher.router?.name ?? null,
          updatedAt: voucher.updatedAt.toISOString(),
          error: voucher.lastDeliveryError,
        })),
      },
    });
  }

  incidents.push(
    ...buildQueueIncidents(queueStats, {
      mediumThreshold: thresholds.queueBacklogMediumThreshold,
      highThreshold: thresholds.queueBacklogHighThreshold,
    }),
  );

  // Overdue sessions: ACTIVE in DB but voucher expired — clients still connected
  if (overdueSessionCount > 0) {
    incidents.push({
      id: "overdue-sessions",
      severity: overdueSessionCount >= 5 ? "HIGH" : "MEDIUM",
      type: "OVERDUE_SESSIONS",
      title: `${overdueSessionCount} client(s) connecté(s) avec ticket expiré`,
      description:
        `${overdueSessionCount} session(s) actives dans la base ont un ticket expiré. ` +
        "Le sync automatique (toutes les 10 min) les déconnectera au prochain cycle. " +
        'Utilisez "Purger expirés" sur la page routeur pour forcer immédiatement.',
      detectedAt: now.toISOString(),
      entityType: "system",
      metadata: { count: overdueSessionCount },
    });
  }

  // Low stock: plans with recent transactions but < 5 GENERATED vouchers left
  const criticallyLowPlans = lowStockPlans.filter(
    (p) => p.transactions.length > 0 && p._count.vouchers < 5,
  );
  if (criticallyLowPlans.length > 0) {
    incidents.push({
      id: "low-voucher-stock",
      severity: criticallyLowPlans.some((p) => p._count.vouchers === 0)
        ? "HIGH"
        : "MEDIUM",
      type: "LOW_VOUCHER_STOCK",
      title: `Stock faible: ${criticallyLowPlans.length} forfait(s) actif(s) bientôt épuisé(s)`,
      description:
        `${criticallyLowPlans.map((p) => `${p.name} (${p._count.vouchers} tickets)`).join(", ")}. ` +
        "Générez de nouveaux tickets pour maintenir la disponibilité.",
      detectedAt: now.toISOString(),
      entityType: "voucher",
      metadata: {
        plans: criticallyLowPlans.map((p) => ({
          id: p.id,
          name: p.name,
          stock: p._count.vouchers,
        })),
      },
    });
  }

  const severityCounts = incidents.reduce(
    (acc, incident) => {
      const key = incident.severity.toLowerCase() as keyof typeof acc;
      acc[key] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  const sortedIncidents = sortOperationalIncidents(incidents);

  return {
    summary: {
      total: sortedIncidents.length,
      critical: severityCounts.critical,
      high: severityCounts.high,
      medium: severityCounts.medium,
      low: severityCounts.low,
      offlineRouters: routerIncidentState.offlineRouters,
      degradedRouters: routerIncidentState.degradedRouters,
      routersWithSyncErrors: routerIncidentState.routersWithSyncErrors,
      routersWithUnmatchedUsers: routerIncidentState.routersWithUnmatchedUsers,
      deliveryFailures: deliveryFailureCount,
      voucherQueueBacklog:
        queueStats.voucherDelivery.waiting + queueStats.voucherDelivery.delayed,
      webhookQueueBacklog:
        queueStats.paymentWebhook.waiting + queueStats.paymentWebhook.delayed,
    },
    incidents: sortedIncidents,
    generatedAt: new Date().toISOString(),
  };
}
