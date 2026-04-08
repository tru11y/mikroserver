import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('metrics')
@Controller({ path: 'metrics', version: '1' })
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('dashboard')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  getDashboard() {
    return this.metricsService.getDashboardKpis();
  }

  @Get('revenue-chart')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getRevenueChart(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.metricsService.getRevenueChart(Math.min(days, 365));
  }
}
