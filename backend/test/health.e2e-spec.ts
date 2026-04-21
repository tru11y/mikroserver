import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupE2EEnvironment } from "./testcontainers.environment";

const runE2E = process.env.RUN_TESTCONTAINERS_E2E === "true";
const describeE2E = runE2E ? describe : describe.skip;

describeE2E("Health E2E (Testcontainers)", () => {
  let app: NestFastifyApplication & INestApplication;
  let stopEnvironment: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const env = await setupE2EEnvironment();
    stopEnvironment = env.stop;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await stopEnvironment?.();
  });

  it("returns liveness payload", async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .get("/api/v1/health/live")
      .expect(200);
    expect(response.body.status).toBe("alive");
  });
});
