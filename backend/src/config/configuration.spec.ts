import { loadAndValidateConfig } from "./configuration";

describe("loadAndValidateConfig", () => {
  const originalEnv = process.env;

  const buildBaseEnv = () => ({
    NODE_ENV: "production",
    PORT: "3000",
    API_PREFIX: "api/v1",
    APP_NAME: "MikroServer",
    CORS_ORIGINS: "http://localhost:3001",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/mikroserver",
    JWT_ACCESS_SECRET: "a".repeat(64),
    JWT_REFRESH_SECRET: "b".repeat(64),
    WAVE_API_KEY: "",
    WAVE_WEBHOOK_SECRET: "",
    WAVE_SUCCESS_URL: "",
    WAVE_ERROR_URL: "",
    CINETPAY_SITE_ID: "",
    CINETPAY_API_KEY: "",
    CINETPAY_WEBHOOK_SECRET: "",
    CINETPAY_API_URL: "",
    CINETPAY_NOTIFY_URL: "",
    CINETPAY_RETURN_URL: "",
  });

  beforeEach(() => {
    process.env = { ...buildBaseEnv() };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("allows startup when external payment providers are not configured", () => {
    const config = loadAndValidateConfig();

    expect(config.WAVE_API_KEY).toBeUndefined();
    expect(config.WAVE_SUCCESS_URL).toBeUndefined();
    expect(config.CINETPAY_API_KEY).toBeUndefined();
    expect(config.CINETPAY_RETURN_URL).toBeUndefined();
  });

  it("fails when Wave is partially configured", () => {
    process.env = {
      ...buildBaseEnv(),
      WAVE_API_KEY: "wave-api-key",
    };

    expect(() => loadAndValidateConfig()).toThrow(/WAVE_WEBHOOK_SECRET/);
  });
});
