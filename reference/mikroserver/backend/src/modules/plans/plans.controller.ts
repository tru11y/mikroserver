import {
  Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe, Query, ParseBoolPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('plans')
@Controller({ path: 'plans', version: '1' })
@ApiBearerAuth()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'List all plans' })
  findAll(@Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived: boolean) {
    return this.plansService.findAll(includeArchived);
  }

  @Get(':id')
  @Roles(UserRole.VIEWER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: JwtPayload) {
    return this.plansService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: JwtPayload) {
    return this.plansService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.plansService.archive(id, user.sub);
  }
}
