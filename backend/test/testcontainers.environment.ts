import { execSync } from "child_process";
import { resolve } from "path";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

type ContainerState = {
  postgres: StartedTestContainer;
  redis: StartedTestContainer;
};

export type E2EEnvironment = {
  postgresUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  stop: () => Promise<void>;
};

const BACKEND_ROOT = resolve(__dirname, "..");

function setDefaultEnv(key: string, value: string): void {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

export async function setupE2EEnvironment(): Promise<E2EEnvironment> {
  const pgUser = "mikroserver";
  const pgPassword = "mikroserver";
  const pgDb = "mikroserver";
  const redisPassword = "redis-pass";

  const postgres = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_USER: pgUser,
      POSTGRES_PASSWORD: pgPassword,
      POSTGRES_DB: pgDb,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage("database system is ready to accept connections"),
    )
    .start();

  const redis = await new GenericContainer("redis:7-alpine")
    .withCommand(["redis-server", "--requirepass", redisPassword])
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();

  const postgresUrl = `postgresql://${pgUser}:${pgPassword}@${postgres.getHost()}:${postgres.getMappedPort(5432)}/${pgDb}`;
  const redisHost = redis.getHost();
  const redisPort = redis.getMappedPort(6379);

  setDefaultEnv("NODE_ENV", "test");
  setDefaultEnv("PORT", "3000");
  setDefaultEnv("API_PREFIX", "api/v1");
  setDefaultEnv("DATABASE_URL", postgresUrl);
  setDefaultEnv(
    "JWT_ACCESS_SECRET",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  setDefaultEnv(
    "JWT_REFRESH_SECRET",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  );
  setDefaultEnv(
    "ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  setDefaultEnv("REDIS_HOST", redisHost);
  setDefaultEnv("REDIS_PORT", String(redisPort));
  setDefaultEnv("REDIS_PASSWORD", redisPassword);
  setDefaultEnv("CORS_ORIGINS", "http://localhost:3001");
  setDefaultEnv("SWAGGER_ENABLED", "false");
  setDefaultEnv("OTEL_ENABLED", "false");

  execSync("npx prisma migrate deploy", {
    cwd: BACKEND_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: postgresUrl,
    },
  });

  const state: ContainerState = { postgres, redis };

  return {
    postgresUrl,
    redisHost,
    redisPort,
    redisPassword,
    stop: async () => {
      await Promise.allSettled([state.redis.stop(), state.postgres.stop()]);
    },
  };
}
