import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../queue/decorators/inject-redis.decorator';
import { Redis } from 'ioredis';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  @Public()
  @Get()
  @ApiOperation({ summary: 'System health check' })
  async check() {
    let databaseStatus = 'up';
    let redisStatus = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'down';
    }

    try {
      await this.redis.ping();
    } catch {
      redisStatus = 'down';
    }

    return {
      status: databaseStatus === 'up' && redisStatus === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      details: {
        database: { status: databaseStatus },
        redis: { status: redisStatus },
      },
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  ready() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
