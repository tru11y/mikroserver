type OTelConfig = {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint?: string;
  sampleRatio: number;
};

type OTelSdk = {
  start: () => Promise<void> | void;
  shutdown: () => Promise<void> | void;
};

let sdkInstance: OTelSdk | null = null;

export async function initializeOpenTelemetry(
  config: OTelConfig,
): Promise<void> {
  if (!config.enabled || sdkInstance) {
    return;
  }

  try {
    // Use dynamic require to keep runtime optional when OTEL deps are absent.
    const req = eval("require") as NodeRequire;
    const { NodeSDK } = req("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = req(
      "@opentelemetry/auto-instrumentations-node",
    );
    const { OTLPTraceExporter } = req(
      "@opentelemetry/exporter-trace-otlp-http",
    );
    const { resourceFromAttributes } = req("@opentelemetry/resources");
    const { ParentBasedSampler, TraceIdRatioBasedSampler } = req(
      "@opentelemetry/sdk-trace-base",
    );
    const { SemanticResourceAttributes } = req(
      "@opentelemetry/semantic-conventions",
    );

    const traceExporter = config.otlpEndpoint
      ? new OTLPTraceExporter({ url: config.otlpEndpoint })
      : new OTLPTraceExporter();

    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.npm_package_version ?? "1.0.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV ?? "development",
    });

    const sdk = new NodeSDK({
      traceExporter,
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(config.sampleRatio),
      }),
      resource,
      instrumentations: [getNodeAutoInstrumentations()],
    }) as OTelSdk;

    sdkInstance = sdk;
    await sdk.start();

    const shutdown = async () => {
      if (!sdkInstance) return;
      try {
        await sdkInstance.shutdown();
      } catch {
        // no-op
      } finally {
        sdkInstance = null;
      }
    };

    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
  } catch (error) {
    console.warn(
      `[OTEL] OpenTelemetry initialization skipped: ${(error as Error).message}`,
    );
  }
}
