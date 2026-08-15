import { execSync } from "child_process";
import { resolve } from "path";
import { createConnection } from "net";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

/**
 * The postgres log line testcontainers waits on fires slightly before Docker
 * Desktop's host port-forward is actually accepting connections (seen on
 * Windows). Poll the raw TCP port before handing off to `prisma migrate
 * deploy`, instead of racing it.
 */
function waitForPort(host: string, port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    const attempt = () => {
      const socket = createConnection({ host, port }, () => {
        socket.end();
        resolvePromise();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

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
      // The postgres image logs this message twice: once after the initdb
      // bootstrap pass (which then shuts the server back down), and once for
      // the real startup. Waiting for only the first occurrence races with
      // that restart and intermittently fails with P1001.
      Wait.forLogMessage("database system is ready to accept connections", 2),
    )
    .start();

  const redis = await new GenericContainer("redis:7-alpine")
    .withCommand(["redis-server", "--requirepass", redisPassword])
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();

  // Force IPv4: Node's "localhost" resolution prefers IPv6 (::1) on Windows,
  // but Docker Desktop's port publish only listens on the IPv4 loopback,
  // which silently connection-refuses Prisma even after the TCP wait below
  // succeeds via a different address family.
  const postgresHost =
    postgres.getHost() === "localhost" ? "127.0.0.1" : postgres.getHost();
  const redisHostRaw =
    redis.getHost() === "localhost" ? "127.0.0.1" : redis.getHost();

  await waitForPort(postgresHost, postgres.getMappedPort(5432));

  const postgresUrl = `postgresql://${pgUser}:${pgPassword}@${postgresHost}:${postgres.getMappedPort(5432)}/${pgDb}`;
  const redisHost = redisHostRaw;
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
