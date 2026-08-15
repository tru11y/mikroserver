import { INestApplication, ValidationPipe } from "@nestjs/common";
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

/**
 * Covers the exact path that broke in production on 2026-08-14: signup must
 * create a working session, and that session must be usable immediately
 * against every screen that calls /auth/me (dashboard header, account, etc).
 */
describeE2E("Auth E2E — signup, login, me (Testcontainers)", () => {
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
    app.enableVersioning({ type: 1 } as never);
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await stopEnvironment?.();
  });

  it("signs up, receives usable tokens, and /auth/me works with the access token", async () => {
    const server = app.getHttpServer();
    const email = `e2e-${Date.now()}@mikrolan.net`;

    const signupRes = await request(server)
      .post("/api/v1/auth/signup")
      .send({
        tenantName: "E2E Test Tenant",
        email,
        password: "TestPassword123!",
      })
      .expect(201);

    const accessToken = signupRes.body?.data?.accessToken;
    expect(typeof accessToken).toBe("string");
    expect(accessToken.length).toBeGreaterThan(20);

    const meRes = await request(server)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body?.data?.user?.email).toBe(email);
  });

  it("rejects login with wrong password", async () => {
    const server = app.getHttpServer();
    const email = `e2e-wrongpass-${Date.now()}@mikrolan.net`;

    await request(server)
      .post("/api/v1/auth/signup")
      .send({ tenantName: "E2E Test", email, password: "TestPassword123!" })
      .expect(201);

    await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password: "WrongPassword!" })
      .expect(401);
  });

  it("blocks an unauthenticated request to a protected route", async () => {
    const server = app.getHttpServer();
    await request(server).get("/api/v1/auth/me").expect(401);
  });
});
