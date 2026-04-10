import { Injectable, Logger } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { SpeedBoostsService } from "../../speed-boosts/speed-boosts.service";
import { JOB_NAMES, QUEUE_NAMES } from "../queue.constants";
import { BoostRevertJobData } from "../queue.service";

@Injectable()
export class SpeedBoostWorker {
  private readonly logger = new Logger(SpeedBoostWorker.name);
  private worker: Worker | null = null;

  constructor(
    private readonly speedBoostsService: SpeedBoostsService,
    private readonly configService: ConfigService,
  ) {}

  initialize(redisConnection: {
    host: string;
    port: number;
    password?: string;
  }): void {
    this.worker = new Worker(
      QUEUE_NAMES.SPEED_BOOST,
      async (job: Job<BoostRevertJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 5,
        autorun: true,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.log(
        `Boost job completed: job=${job.id} boost=${job.data.boostId}`,
      );
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(
        `Boost job failed: job=${job?.id} boost=${job?.data.boostId} err=${err.message}`,
      );
    });

    this.logger.log("Speed boost worker initialized");
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<BoostRevertJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.REVERT_BOOST) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    await this.speedBoostsService.revertBoost(job.data.boostId);
  }
}
