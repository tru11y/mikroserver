import { Module } from '@nestjs/common';
import { RoutersService } from './routers.service';
import { RoutersController } from './routers.controller';
import { RouterApiService } from './router-api.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [RoutersService, RouterApiService],
  controllers: [RoutersController],
  exports: [RoutersService, RouterApiService],
})
export class RoutersModule {}
