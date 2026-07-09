import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../queue.constants";
import { VoucherService } from "../../vouchers/voucher.service";

export interface BatchGenerateJobData {
  batchId: string;
}

@Injectable()
export class BatchGenerateWorker {
  private readonly logger = new Logger(BatchGenerateWorker.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(forwardRef(() => VoucherService))
    private readonly voucherService: VoucherService,
  ) {}

  initialize(redisConnection: {
    host: string;
    port: number;
    password?: string;
  }): void {
    this.worker = new Worker(
      QUEUE_NAMES.BATCH_GENERATE,
      async (job: Job<BatchGenerateJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 1,
        autorun: true,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.log(
        `Batch generation completed: batchId=${job.data.batchId}`,
      );
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(
        `Batch generation failed: batchId=${job?.data.batchId} err=${err.message}`,
      );
    });
  }

  private async processJob(job: Job<BatchGenerateJobData>): Promise<void> {
    const { batchId } = job.data;
    await this.voucherService.executeBatchGeneration(batchId);
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
