import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('sessions')
@Controller({ path: 'sessions', version: '1' })
@ApiBearerAuth()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('active')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get active hotspot sessions' })
  getActive(@Query('routerId') routerId?: string) {
    return this.sessionsService.findActive(routerId);
  }

  @Post('terminate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Terminate a session' })
  @ApiBody({
    schema: {
      properties: {
        routerId: { type: 'string', format: 'uuid' },
        mikrotikId: { type: 'string' },
      },
      required: ['routerId', 'mikrotikId'],
    },
  })
  terminate(
    @Body() body: { routerId: string; mikrotikId: string },
  ) {
    return this.sessionsService.terminate(body.routerId, body.mikrotikId);
  }
}
