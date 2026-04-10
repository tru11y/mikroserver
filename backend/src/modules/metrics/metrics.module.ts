import { Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { ExportService } from "./export.service";
import { ExportController } from "./export.controller";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [QueueModule],
  providers: [MetricsService, ExportService],
  controllers: [MetricsController, ExportController],
  exports: [MetricsService, ExportService],
})
export class MetricsModule {}
