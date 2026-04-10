import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { MetricsService } from "./metrics.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { UserRole } from "@prisma/client";
import type { Response } from "express";

@ApiTags("metrics")
@Controller({ path: "metrics", version: "1" })
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get("dashboard")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({ summary: "Get dashboard KPIs (tenant-scoped)" })
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.metricsService.getDashboardKpis({
      sub: user.sub,
      role: user.role,
    });
  }

  @Get("dashboard/stats")
  @Roles(UserRole.VIEWER)
  @ApiOperation({
    summary:
      "Get combined dashboard stats: sessions, revenue, top routers, recent sessions",
  })
  getDashboardStats(@CurrentUser() user: JwtPayload) {
    return this.metricsService.getDashboardStats(user.sub, user.role);
  }

  @Get("revenue-chart")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({ summary: "Get revenue chart data (tenant-scoped)" })
  @ApiQuery({ name: "days", required: false, type: Number })
  getRevenueChart(
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.metricsService.getRevenueChart(Math.min(days, 365), {
      sub: user.sub,
      role: user.role,
    });
  }

  @Get("subscriptions/today")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({ summary: "Get subscriptions started today" })
  getSubscriptionsStartedToday() {
    return this.metricsService.getSubscriptionsStartedToday();
  }

  @Get("subscriptions/expiring-today")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({ summary: "Get subscriptions expiring today" })
  getSubscriptionsExpiringToday() {
    return this.metricsService.getSubscriptionsExpiringToday();
  }

  @Get("subscriptions/top-clients")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({ summary: "Get top recurring clients for subscriptions" })
  @ApiQuery({ name: "windowDays", required: false, type: Number, example: 30 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  getTopRecurringClients(
    @Query("windowDays", new DefaultValuePipe(30), ParseIntPipe)
    windowDays: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.metricsService.getTopRecurringClients(windowDays, limit);
  }

  @Get("subscriptions/top-plans")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({ summary: "Get top recurring plans for subscriptions" })
  @ApiQuery({ name: "windowDays", required: false, type: Number, example: 30 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  getTopRecurringPlans(
    @Query("windowDays", new DefaultValuePipe(30), ParseIntPipe)
    windowDays: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.metricsService.getTopRecurringPlans(windowDays, limit);
  }

  @Get("recommendations/daily")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({
    summary: "Get daily operational recommendations (AI-ready feed)",
  })
  getDailyRecommendations() {
    return this.metricsService.getDailyRecommendations();
  }

  @Get("ticket-report")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({
    summary:
      "Get operational ticket report with date, operator and plan filters",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    example: "2026-03-13",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    example: "2026-03-13",
  })
  @ApiQuery({ name: "operatorId", required: false, type: String })
  @ApiQuery({ name: "planId", required: false, type: String })
  getTicketReport(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("operatorId") operatorId?: string,
    @Query("planId") planId?: string,
  ) {
    return this.metricsService.getTicketReport({
      startDate,
      endDate,
      operatorId,
      planId,
    });
  }

  @Get("ticket-report/export")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.export")
  @ApiOperation({ summary: "Export operational ticket report as CSV" })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    example: "2026-03-13",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    example: "2026-03-13",
  })
  @ApiQuery({ name: "operatorId", required: false, type: String })
  @ApiQuery({ name: "planId", required: false, type: String })
  async exportTicketReport(
    @Query("startDate") startDate: string | undefined,
    @Query("endDate") endDate: string | undefined,
    @Query("operatorId") operatorId: string | undefined,
    @Query("planId") planId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const csv = await this.metricsService.exportTicketReportCsv({
      startDate,
      endDate,
      operatorId,
      planId,
    });
    const filename = `ticket-report-${new Date().toISOString().slice(0, 10)}.csv`;

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );

    return new StreamableFile(Buffer.from(csv, "utf-8"));
  }

  @Get("incidents")
  @Roles(UserRole.VIEWER)
  @Permissions("reports.view")
  @ApiOperation({
    summary: "Get operational incidents and supervision summary",
  })
  getIncidents() {
    return this.metricsService.getIncidentCenter();
  }
}
