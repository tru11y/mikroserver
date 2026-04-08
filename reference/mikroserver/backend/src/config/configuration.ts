import { z } from 'zod';

// =============================================================================
// Environment Configuration with strict Zod validation
// Fails loudly at startup if any required variable is missing or invalid
// =============================================================================

const envSchema = z.object({
  // --- App ---
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  API_PREFIX: z.string().default('api/v1'),
  APP_NAME: z.string().default('MikroServer'),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),

  // --- Database ---
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.string().default('2').transform(Number),
  DATABASE_POOL_MAX: z.string().default('10').transform(Number),

  // --- Redis ---
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0').transform(Number),
  REDIS_TLS: z.string().optional().transform((v) => v === 'true'),

  // --- JWT ---
  JWT_ACCESS_SECRET: z.string().min(64),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(64),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // --- Wave Payment ---
  WAVE_API_URL: z.string().url().default('https://api.wave.com/v1'),
  WAVE_API_KEY: z.string().min(10),
  WAVE_WEBHOOK_SECRET: z.string().min(32),
  WAVE_CURRENCY: z.string().default('XOF'),
  WAVE_CHECKOUT_URL: z.string().url().default('https://pay.wave.com'),
  WAVE_SUCCESS_URL: z.string().url(),
  WAVE_ERROR_URL: z.string().url(),
  WAVE_ALLOWED_IPS: z.string().default('').transform((v) =>
    v.split(',').map((ip) => ip.trim()).filter(Boolean),
  ),

  // --- MikroTik / RouterOS ---
  MIKROTIK_API_TIMEOUT_MS: z.string().default('10000').transform(Number),
  MIKROTIK_CONNECTION_POOL_SIZE: z.string().default('3').transform(Number),
  MIKROTIK_DEFAULT_PROFILE: z.string().default('default'),
  MIKROTIK_VOUCHER_PREFIX: z.string().default('MS'),

  // --- Queue ---
  QUEUE_VOUCHER_DELIVERY_ATTEMPTS: z.string().default('5').transform(Number),
  QUEUE_VOUCHER_DELIVERY_BACKOFF_MS: z.string().default('5000').transform(Number),
  QUEUE_CONCURRENCY: z.string().default('5').transform(Number),

  // --- Circuit Breaker ---
  CIRCUIT_BREAKER_TIMEOUT_MS: z.string().default('10000').transform(Number),
  CIRCUIT_BREAKER_RESET_MS: z.string().default('30000').transform(Number),
  CIRCUIT_BREAKER_THRESHOLD: z.string().default('50').transform(Number),

  // --- Security ---
  RATE_LIMIT_TTL_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  WEBHOOK_RATE_LIMIT_MAX: z.string().default('200').transform(Number),
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  ARGON2_MEMORY: z.string().default('65536').transform(Number),
  ARGON2_ITERATIONS: z.string().default('3').transform(Number),
  ARGON2_PARALLELISM: z.string().default('4').transform(Number),

  // --- Logging ---
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().default('false').transform((v) => v === 'true'),

  // --- Metrics ---
  METRICS_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  SNAPSHOT_CRON: z.string().default('0 0 * * *'),  // Daily at midnight

  // --- Transaction ---
  TRANSACTION_EXPIRY_MINUTES: z.string().default('30').transform(Number),
});

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | undefined;

export function loadAndValidateConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    throw new Error(
      `\n━━━ Configuration Validation Failed ━━━\n${formatted}\n` +
      'Please check your .env file.',
    );
  }

  _config = result.data;
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error('Configuration not loaded. Call loadAndValidateConfig() first.');
  }
  return _config;
}

// For use with NestJS @nestjs/config useFactory
export const configuration = () => loadAndValidateConfig();
