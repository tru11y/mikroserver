import { z } from "zod";

// =============================================================================
// Environment Configuration with strict Zod validation
// Fails loudly at startup if any required variable is missing or invalid
// =============================================================================

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalMinText = (min: number) =>
  z.preprocess(emptyToUndefined, z.string().min(min).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const urlWithDefault = (defaultUrl: string) =>
  z.preprocess(emptyToUndefined, z.string().url().default(defaultUrl));

const envSchema = z
  .object({
    // --- App ---
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.string().default("3000").transform(Number),
    API_PREFIX: z.string().default("api/v1"),
    APP_NAME: z.string().default("MikroServer"),
    CORS_ORIGINS: z.string().default("http://localhost:3001"),

    // --- Database ---
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MIN: z.string().default("2").transform(Number),
    DATABASE_POOL_MAX: z.string().default("10").transform(Number),

    // --- Redis ---
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.string().default("6379").transform(Number),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.string().default("0").transform(Number),
    REDIS_TLS: z
      .string()
      .optional()
      .transform((v) => v === "true"),

    // --- JWT ---
    JWT_ACCESS_SECRET: z.string().min(64),
    JWT_ACCESS_EXPIRY: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string().min(64),
    JWT_REFRESH_EXPIRY: z.string().default("30d"),

    // --- Wave Payment ---
    WAVE_API_URL: urlWithDefault("https://api.wave.com/v1"),
    WAVE_API_KEY: optionalMinText(10),
    WAVE_WEBHOOK_SECRET: optionalMinText(32),
    WAVE_CURRENCY: z.string().default("XOF"),
    WAVE_CHECKOUT_URL: z.string().url().default("https://pay.wave.com"),
    WAVE_SUCCESS_URL: optionalUrl,
    WAVE_ERROR_URL: optionalUrl,
    WAVE_ALLOWED_IPS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((ip) => ip.trim())
          .filter(Boolean),
      ),

    // --- CinetPay Payment ---
    CINETPAY_API_URL: urlWithDefault("https://api-checkout.cinetpay.com"),
    CINETPAY_SITE_ID: optionalText,
    CINETPAY_API_KEY: optionalText,
    CINETPAY_WEBHOOK_SECRET: optionalText,
    CINETPAY_CURRENCY: z.string().default("XOF"),
    CINETPAY_DEFAULT_CHANNEL: optionalText,
    CINETPAY_NOTIFY_URL: optionalUrl,
    CINETPAY_RETURN_URL: optionalUrl,
    CINETPAY_ALLOWED_IPS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((ip) => ip.trim())
          .filter(Boolean),
      ),

    // --- MikroTik / RouterOS ---
    MIKROTIK_API_TIMEOUT_MS: z.string().default("10000").transform(Number),
    MIKROTIK_API_HEALTH_TIMEOUT_MS: z
      .string()
      .default("10000")
      .transform(Number),
    MIKROTIK_API_LIVE_TIMEOUT_MS: z.string().default("20000").transform(Number),
    MIKROTIK_API_HEAVY_READ_TIMEOUT_MS: z
      .string()
      .default("30000")
      .transform(Number),
    MIKROTIK_API_WRITE_TIMEOUT_MS: z
      .string()
      .default("15000")
      .transform(Number),
    MIKROTIK_DEFAULT_PROFILE: z.string().default("default"),
    MIKROTIK_VOUCHER_PREFIX: z.string().default("MS"),

    // --- Queue ---
    QUEUE_VOUCHER_DELIVERY_ATTEMPTS: z.string().default("5").transform(Number),
    QUEUE_VOUCHER_DELIVERY_BACKOFF_MS: z
      .string()
      .default("5000")
      .transform(Number),
    QUEUE_CONCURRENCY: z.string().default("5").transform(Number),

    // --- Circuit Breaker ---
    CIRCUIT_BREAKER_TIMEOUT_MS: z.string().default("10000").transform(Number),
    CIRCUIT_BREAKER_RESET_MS: z.string().default("30000").transform(Number),
    CIRCUIT_BREAKER_THRESHOLD: z.string().default("50").transform(Number),

    // --- Encryption (router credentials) ---
    ENCRYPTION_KEY: z.string().min(64),

    // --- VPS public IP (used for port-mapping URLs) ---
    VPS_PUBLIC_IP: z.string().default("127.0.0.1"),
    PORT_MAP_RANGE_START: z.string().default("19000").transform(Number),
    PORT_MAP_RANGE_END: z.string().default("19999").transform(Number),

    // --- Security ---
    RATE_LIMIT_TTL_MS: z.string().default("60000").transform(Number),
    RATE_LIMIT_MAX: z.string().default("100").transform(Number),
    WEBHOOK_RATE_LIMIT_MAX: z.string().default("200").transform(Number),
    BCRYPT_ROUNDS: z.string().default("12").transform(Number),
    ARGON2_MEMORY: z.string().default("65536").transform(Number),
    ARGON2_ITERATIONS: z.string().default("3").transform(Number),
    ARGON2_PARALLELISM: z.string().default("4").transform(Number),

    // --- Logging ---
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    LOG_PRETTY: z
      .string()
      .default("false")
      .transform((v) => v === "true"),

    // --- Metrics ---
    METRICS_ENABLED: z
      .string()
      .default("true")
      .transform((v) => v === "true"),
    SNAPSHOT_CRON: z.string().default("0 0 * * *"), // Daily at midnight

    // --- Transaction ---
    TRANSACTION_EXPIRY_MINUTES: z.string().default("30").transform(Number),
  })
  .superRefine((cfg, ctx) => {
    const waveEnabled = Boolean(
      cfg.WAVE_API_KEY ||
      cfg.WAVE_WEBHOOK_SECRET ||
      cfg.WAVE_SUCCESS_URL ||
      cfg.WAVE_ERROR_URL,
    );

    if (waveEnabled) {
      if (!cfg.WAVE_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WAVE_API_KEY"],
          message: "WAVE_API_KEY is required when Wave is enabled",
        });
      }
      if (!cfg.WAVE_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WAVE_WEBHOOK_SECRET"],
          message: "WAVE_WEBHOOK_SECRET is required when Wave is enabled",
        });
      }
      if (!cfg.WAVE_SUCCESS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WAVE_SUCCESS_URL"],
          message: "WAVE_SUCCESS_URL is required when Wave is enabled",
        });
      }
      if (!cfg.WAVE_ERROR_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WAVE_ERROR_URL"],
          message: "WAVE_ERROR_URL is required when Wave is enabled",
        });
      }
    }

    const cinetpayEnabled = Boolean(
      cfg.CINETPAY_SITE_ID ||
      cfg.CINETPAY_API_KEY ||
      cfg.CINETPAY_WEBHOOK_SECRET ||
      cfg.CINETPAY_NOTIFY_URL ||
      cfg.CINETPAY_RETURN_URL,
    );

    if (cinetpayEnabled) {
      if (!cfg.CINETPAY_SITE_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CINETPAY_SITE_ID"],
          message: "CINETPAY_SITE_ID is required when CinetPay is enabled",
        });
      }
      if (!cfg.CINETPAY_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CINETPAY_API_KEY"],
          message: "CINETPAY_API_KEY is required when CinetPay is enabled",
        });
      }
      if (!cfg.CINETPAY_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CINETPAY_WEBHOOK_SECRET"],
          message:
            "CINETPAY_WEBHOOK_SECRET is required when CinetPay is enabled",
        });
      }
      if (!cfg.CINETPAY_NOTIFY_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CINETPAY_NOTIFY_URL"],
          message: "CINETPAY_NOTIFY_URL is required when CinetPay is enabled",
        });
      }
      if (!cfg.CINETPAY_RETURN_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CINETPAY_RETURN_URL"],
          message: "CINETPAY_RETURN_URL is required when CinetPay is enabled",
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | undefined;

export function loadAndValidateConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");

    throw new Error(
      `\n━━━ Configuration Validation Failed ━━━\n${formatted}\n` +
        "Please check your .env file.",
    );
  }

  _config = result.data;
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error(
      "Configuration not loaded. Call loadAndValidateConfig() first.",
    );
  }
  return _config;
}

// For use with NestJS @nestjs/config useFactory
export const configuration = () => loadAndValidateConfig();
