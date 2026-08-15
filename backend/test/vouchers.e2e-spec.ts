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

describeE2E(
  "Vouchers E2E — signup → router → plan → generate → verify",
  () => {
    let app: NestFastifyApplication & INestApplication;
    let stopEnvironment: (() => Promise<void>) | undefined;
    let accessToken: string;
    let routerId: string;
    let planId: string;

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
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      // Signup to get an ADMIN-level account
      const signupRes = await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({
          tenantName: "Voucher E2E Tenant",
          email: `voucher-e2e-${Date.now()}@mikrolan.net`,
          password: "TestPassword123!",
        })
        .expect(201);

      accessToken = signupRes.body.data.accessToken;
    }, 180_000);

    afterAll(async () => {
      await app?.close();
      await stopEnvironment?.();
    });

    it("creates a router", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/routers")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "E2E Test Router" })
        .expect(201);

      routerId = res.body.data?.id ?? res.body.id;
      expect(routerId).toBeDefined();
    });

    it("creates a plan", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/plans")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "1 Heure WiFi E2E",
          durationMinutes: 60,
          priceXof: 500,
        })
        .expect(201);

      planId = res.body.data?.id ?? res.body.id;
      expect(planId).toBeDefined();
    });

    it("generates a batch of vouchers", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/vouchers/generate/bulk")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          planId,
          routerId,
          count: 3,
        })
        .expect(201);

      const vouchers = res.body.data?.vouchers ?? res.body.vouchers;
      expect(vouchers).toHaveLength(3);
      expect(vouchers[0].code).toBeDefined();
      expect(vouchers[0].status).toBe("GENERATED");
    });

    it("lists vouchers and finds the generated ones", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/vouchers")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.items;
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it("verifies a voucher by code and returns session info", async () => {
      // First get a voucher code
      const listRes = await request(app.getHttpServer())
        .get("/api/v1/vouchers")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const items = listRes.body.data?.items ?? listRes.body.items;
      const voucher = items[0];

      const res = await request(app.getHttpServer())
        .post("/api/v1/vouchers/verify")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ ticket: voucher.code, routerId })
        .expect(200);

      const result = res.body.data ?? res.body;
      expect(result.source).toBe("SAAS");
      expect(result.code).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.planName).toBe("1 Heure WiFi E2E");
      expect(result.durationMinutes).toBe(60);
      expect(result.priceXof).toBe(500);
      expect(result.routerName).toBe("E2E Test Router");
      // No session yet (voucher not activated)
      expect(result.session).toBeNull();
      expect(result.message).toBeDefined();
    });

    it("returns 401 for an unknown voucher code", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/vouchers/verify")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ ticket: "TOTALLY-FAKE-CODE-12345" })
        .expect(401);
    });

    it("revokes a voucher and verify reflects the new status", async () => {
      const listRes = await request(app.getHttpServer())
        .get("/api/v1/vouchers")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const items = listRes.body.data?.items ?? listRes.body.items;
      const voucher = items[0];

      await request(app.getHttpServer())
        .post(`/api/v1/vouchers/${voucher.id}/revoke`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const verifyRes = await request(app.getHttpServer())
        .post("/api/v1/vouchers/verify")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ ticket: voucher.code, routerId })
        .expect(200);

      const result = verifyRes.body.data ?? verifyRes.body;
      expect(result.status).toBe("REVOKED");
      expect(result.canLogin).toBe(false);
    });
  },
);
