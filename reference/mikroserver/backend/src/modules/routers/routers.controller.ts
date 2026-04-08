import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoutersService } from './routers.service';
import { CreateRouterDto, UpdateRouterDto } from './dto/router.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('routers')
@Controller({ path: 'routers', version: '1' })
@ApiBearerAuth()
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'List all routers' })
  findAll() {
    return this.routersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get router details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.routersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add new router' })
  create(
    @Body() dto: CreateRouterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update router' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete router (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.routersService.remove(id, user.sub);
  }

  @Post(':id/health-check')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger router health check' })
  healthCheck(@Param('id', ParseUUIDPipe) id: string) {
    return this.routersService.healthCheck(id);
  }

  @Get(':id/live-stats')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get live stats from MikroTik (active clients + bandwidth)' })
  liveStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.routersService.getLiveStats(id);
  }

  @Get(':id/wireguard-config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate WireGuard config for this router' })
  wireguardConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.routersService.getWireguardConfig(id);
  }
}
