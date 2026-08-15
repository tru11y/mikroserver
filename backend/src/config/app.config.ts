import { registerAs } from "@nestjs/config";
import { getConfig } from "./configuration";

export const appConfig = registerAs("app", () => {
  const cfg = getConfig();
  return {
    nodeEnv: cfg.NODE_ENV,
    port: cfg.PORT,
    apiPrefix: cfg.API_PREFIX,
    name: cfg.APP_NAME,
    corsOrigins: cfg.CORS_ORIGINS.split(",").map((o) => o.trim()),
    isProduction: cfg.NODE_ENV === "production",
    isDevelopment: cfg.NODE_ENV === "development",
  };
});

export const dbConfig = registerAs("db", () => {
  const cfg = getConfig();
  return {
    url: cfg.DATABASE_URL,
    poolMin: cfg.DATABASE_POOL_MIN,
    poolMax: cfg.DATABASE_POOL_MAX,
  };
});

export const redisConfig = registerAs("redis", () => {
  const cfg = getConfig();
  return {
    host: cfg.REDIS_HOST,
    port: cfg.REDIS_PORT,
    password: cfg.REDIS_PASSWORD,
    db: cfg.REDIS_DB,
    tls: cfg.REDIS_TLS,
  };
});

export const jwtConfig = registerAs("jwt", () => {
  const cfg = getConfig();
  return {
    accessSecret: cfg.JWT_ACCESS_SECRET,
    accessExpiry: cfg.JWT_ACCESS_EXPIRY,
    refreshSecret: cfg.JWT_REFRESH_SECRET,
    refreshExpiry: cfg.JWT_REFRESH_EXPIRY,
  };
});

export const mikrotikConfig = registerAs("mikrotik", () => {
  const cfg = getConfig();
  return {
    apiTimeoutMs: cfg.MIKROTIK_API_TIMEOUT_MS,
    healthTimeoutMs: cfg.MIKROTIK_API_HEALTH_TIMEOUT_MS,
    liveTimeoutMs: cfg.MIKROTIK_API_LIVE_TIMEOUT_MS,
    heavyReadTimeoutMs: cfg.MIKROTIK_API_HEAVY_READ_TIMEOUT_MS,
    writeTimeoutMs: cfg.MIKROTIK_API_WRITE_TIMEOUT_MS,
    defaultProfile: cfg.MIKROTIK_DEFAULT_PROFILE,
    voucherPrefix: cfg.MIKROTIK_VOUCHER_PREFIX,
    circuitBreakerTimeoutMs: cfg.CIRCUIT_BREAKER_TIMEOUT_MS,
    circuitBreakerResetMs: cfg.CIRCUIT_BREAKER_RESET_MS,
    circuitBreakerThreshold: cfg.CIRCUIT_BREAKER_THRESHOLD,
  };
});

export const queueConfig = registerAs("queue", () => {
  const cfg = getConfig();
  return {
    voucherDeliveryAttempts: cfg.QUEUE_VOUCHER_DELIVERY_ATTEMPTS,
    voucherDeliveryBackoffMs: cfg.QUEUE_VOUCHER_DELIVERY_BACKOFF_MS,
    concurrency: cfg.QUEUE_CONCURRENCY,
  };
});

export const securityConfig = registerAs("security", () => {
  const cfg = getConfig();
  return {
    rateLimitTtlMs: cfg.RATE_LIMIT_TTL_MS,
    rateLimitMax: cfg.RATE_LIMIT_MAX,
    webhookRateLimitMax: cfg.WEBHOOK_RATE_LIMIT_MAX,
    bcryptRounds: cfg.BCRYPT_ROUNDS,
    argon2Memory: cfg.ARGON2_MEMORY,
    argon2Iterations: cfg.ARGON2_ITERATIONS,
    argon2Parallelism: cfg.ARGON2_PARALLELISM,
    transactionExpiryMinutes: cfg.TRANSACTION_EXPIRY_MINUTES,
  };
});
