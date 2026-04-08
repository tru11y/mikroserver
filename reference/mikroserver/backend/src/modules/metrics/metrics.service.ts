import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus, RouterStatus } from '@prisma/client';
import { startOfDay, subDays, startOfMonth, endOfDay } from 'date-fns';

export interface DashboardKpis {
  revenue: {
    today: number;
    thisMonth: number;
    last30Days: number;
    total: number;
  };
  transactions: {
    today: number;
    thisMonth: number;
    successRate: number; // percentage
    pending: number;
  };
  vouchers: {
    activeToday: number;
    deliveryFailures: number;
  };
  routers: {
    online: number;
    offline: number;
    total: number;
  };
  customers: {
    uniqueToday: number;
    uniqueThisMonth: number;
  };
}

export interface RevenueChartPoint {
  date: string;
  revenueXof: number;
  transactions: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Dashboard KPIs — optimized with parallel queries
  // ---------------------------------------------------------------------------

  async getDashboardKpis(): Promise<DashboardKpis> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const thirtyDaysAgo = subDays(now, 30);

    // Execute all queries in parallel
    const [
      revenueToday,
      revenueMonth,
      revenueLast30,
      revenueTotal,
      txToday,
      txMonth,
      txSuccess30d,
      txTotal30d,
      txPending,
      activeVouchers,
      failedDeliveries,
      routerCounts,
      customersToday,
      customersMonth,
    ] = await Promise.all([
      // Revenue today
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: todayStart } },
        _sum: { amountXof: true },
      }),

      // Revenue this month
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: monthStart } },
        _sum: { amountXof: true },
      }),

      // Revenue last 30 days
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: thirtyDaysAgo } },
        _sum: { amountXof: true },
      }),

      // Revenue total
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED },
        _sum: { amountXof: true },
      }),

      // Transactions today
      this.prisma.transaction.count({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: todayStart } },
      }),

      // Transactions this month
      this.prisma.transaction.count({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: monthStart } },
      }),

      // Success rate (last 30 days)
      this.prisma.transaction.count({
        where: { status: TransactionStatus.COMPLETED, createdAt: { gte: thirtyDaysAgo } },
      }),

      this.prisma.transaction.count({
        where: {
          status: { in: [TransactionStatus.COMPLETED, TransactionStatus.FAILED] },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Pending transactions
      this.prisma.transaction.count({
        where: { status: TransactionStatus.PENDING },
      }),

      // Active vouchers today
      this.prisma.voucher.count({
        where: { status: 'DELIVERED', deliveredAt: { gte: todayStart } },
      }),

      // Failed deliveries
      this.prisma.voucher.count({
        where: { status: 'DELIVERY_FAILED' },
      }),

      // Router status
      this.prisma.router.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),

      // Unique customers today
      this.prisma.transaction.findMany({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: todayStart } },
        distinct: ['customerPhone'],
        select: { customerPhone: true },
      }),

      // Unique customers this month
      this.prisma.transaction.findMany({
        where: { status: TransactionStatus.COMPLETED, paidAt: { gte: monthStart } },
        distinct: ['customerPhone'],
        select: { customerPhone: true },
      }),
    ]);

    const onlineRouters = routerCounts.find((r) => r.status === RouterStatus.ONLINE)?._count ?? 0;
    const totalRouters = routerCounts.reduce((sum, r) => sum + r._count, 0);

    return {
      revenue: {
        today: revenueToday._sum.amountXof ?? 0,
        thisMonth: revenueMonth._sum.amountXof ?? 0,
        last30Days: revenueLast30._sum.amountXof ?? 0,
        total: revenueTotal._sum.amountXof ?? 0,
      },
      transactions: {
        today: txToday,
        thisMonth: txMonth,
        successRate: txTotal30d > 0 ? Math.round((txSuccess30d / txTotal30d) * 100) : 0,
        pending: txPending,
      },
      vouchers: {
        activeToday: activeVouchers,
        deliveryFailures: failedDeliveries,
      },
      routers: {
        online: onlineRouters,
        offline: totalRouters - onlineRouters,
        total: totalRouters,
      },
      customers: {
        uniqueToday: customersToday.length,
        uniqueThisMonth: customersMonth.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Revenue chart data (last N days)
  // ---------------------------------------------------------------------------

  async getRevenueChart(days = 30): Promise<RevenueChartPoint[]> {
    const from = subDays(new Date(), days);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.COMPLETED,
        paidAt: { gte: from },
      },
      select: { paidAt: true, amountXof: true },
      orderBy: { paidAt: 'asc' },
    });

    // Group by day
    const dailyMap = new Map<string, { revenue: number; count: number }>();

    for (const tx of transactions) {
      if (!tx.paidAt) continue;
      const day = tx.paidAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(day) ?? { revenue: 0, count: 0 };
      dailyMap.set(day, {
        revenue: existing.revenue + tx.amountXof,
        count: existing.count + 1,
      });
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      revenueXof: data.revenue,
      transactions: data.count,
    }));
  }

  // ---------------------------------------------------------------------------
  // Daily snapshot generation (called by cron)
  // ---------------------------------------------------------------------------

  async generateDailySnapshot(date: Date): Promise<void> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const [completed, failed, revenue, uniqueCustomers] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.FAILED,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amountXof: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
        distinct: ['customerPhone'],
        select: { customerPhone: true },
      }),
    ]);

    const totalRevenue = revenue._sum.amountXof ?? 0;

    await this.prisma.revenueSnapshot.upsert({
      where: { date: dayStart },
      create: {
        date: dayStart,
        successfulTransactions: completed,
        failedTransactions: failed,
        totalTransactions: completed + failed,
        grossRevenueXof: totalRevenue,
        netRevenueXof: totalRevenue,
        uniqueCustomers: uniqueCustomers.length,
      },
      update: {
        successfulTransactions: completed,
        failedTransactions: failed,
        totalTransactions: completed + failed,
        grossRevenueXof: totalRevenue,
        netRevenueXof: totalRevenue,
        uniqueCustomers: uniqueCustomers.length,
      },
    });

    this.logger.log(`Daily snapshot generated for ${dayStart.toISOString().slice(0, 10)}`);
  }
}
