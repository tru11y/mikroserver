import * as Sentry from "@sentry/node";

type SentryConfig = {
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
};

let initialized = false;

export function initializeSentry(config: SentryConfig): void {
  if (!config.dsn || initialized) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
  });

  initialized = true;
}

export function isSentryInitialized(): boolean {
  return initialized;
}

export function captureException(exception: unknown): void {
  if (!initialized) return;
  Sentry.captureException(exception);
}
