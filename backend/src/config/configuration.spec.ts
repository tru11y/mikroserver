import { loadAndValidateConfig } from "./configuration";

describe("loadAndValidateConfig", () => {
  const originalEnv = process.env;

  const buildBaseEnv = () => ({
    NODE_ENV: "production",
    PORT: "3000",
    API_PREFIX: "api/v1",
    APP_NAME: "MikroLan",
    CORS_ORIGINS: "http://localhost:3001",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/mikrolan",
    JWT_ACCESS_SECRET: "a".repeat(64),
    JWT_REFRESH_SECRET: "b".repeat(64),
    ENCRYPTION_KEY: "c".repeat(64),
  });

  beforeEach(() => {
    process.env = { ...buildBaseEnv() };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("allows startup without a payment aggregator configured", () => {
    const config = loadAndValidateConfig();

    expect(config.APP_NAME).toBe("MikroLan");
    expect(config.DATABASE_URL).toContain("mikrolan");
  });
});
