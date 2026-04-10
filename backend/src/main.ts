import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import { FastifyRequest } from "fastify";
import { Readable } from "stream";
import { AppModule } from "./app.module";
import { loadAndValidateConfig } from "./config/configuration";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

// Fastify's JSON serializer does not support BigInt natively.
// Patch globally so all BigInt values serialize as strings (safe for JS clients via Number()).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  // Validate environment variables BEFORE anything else
  const config = loadAndValidateConfig();

  let app: NestFastifyApplication;
  try {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: false, // Pino handles logging
        trustProxy: true,
        bodyLimit: 1048576, // 1MB max body
      }) as any,
      { bufferLogs: true },
    );
  } catch (err) {
    console.error("--- NEST FACTORY CREATE FAILED ---");
    console.error(err instanceof Error ? err.message : err);
    throw err;
  }

  // WebSocket adapter — required for @WebSocketGateway when using Fastify
  app.useWebSocketAdapter(new WsAdapter(app));

  // Use Pino as the application logger
  app.useLogger(app.get(Logger));

  // Raw body capture — required for byte-exact HMAC verification on webhook endpoints.
  // The preParsing hook buffers the incoming stream, attaches it as req.rawBody,
  // then replaces the stream so Fastify continues to parse JSON normally.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fastifyInstance = app.getHttpAdapter().getInstance() as any;
  fastifyInstance.addHook(
    "preParsing",
    async (
      request: FastifyRequest & { rawBody?: Buffer },
      _reply: unknown,
      payload: AsyncIterable<Buffer>,
    ) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
        );
      }
      const raw = Buffer.concat(chunks);
      (request as FastifyRequest & { rawBody: Buffer }).rawBody = raw;
      const readable = new Readable({ read() {} });
      readable.push(raw);
      readable.push(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return readable as any;
    },
  );

  // Security headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  // Gzip compression
  await app.register(compress as any, { global: true, threshold: 1024 });

  // CORS — allow frontend origin
  const corsOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim());
  if (corsOrigins.includes("*")) {
    throw new Error(
      'CORS_ORIGINS must not be "*" in production. Set explicit origins.',
    );
  }
  if (config.NODE_ENV === "production") {
    const httpOrigins = corsOrigins.filter((o) => o.startsWith("http://"));
    if (httpOrigins.length > 0) {
      console.warn(
        `[SECURITY] CORS_ORIGINS contains plain HTTP origins in production: ${httpOrigins.join(", ")}. ` +
          "Tokens sent over HTTP are visible on the network. Switch to HTTPS.",
      );
    }
  }
  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  });

  // Global API versioning
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix(config.API_PREFIX);

  // Global validation pipe - strict mode
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true, // Auto-transform primitives
      transformOptions: {
        enableImplicitConversion: false, // Explicit typing required
      },
      stopAtFirstError: false, // Collect all errors
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger (only in non-production)
  if (config.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("MikroServer API")
      .setDescription("WiFi Monetization Platform - Internal API")
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("auth", "Authentication endpoints")
      .addTag("plans", "WiFi plan management")
      .addTag("transactions", "Payment transactions")
      .addTag("vouchers", "Hotspot vouchers")
      .addTag("routers", "MikroTik router management")
      .addTag("sessions", "Active sessions")
      .addTag("metrics", "KPIs and analytics")
      .addTag("health", "System health")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });
  }

  // Required for onModuleDestroy / onApplicationShutdown hooks to fire on SIGTERM.
  // Without this, BullMQ workers are killed mid-job during rolling deployments.
  app.enableShutdownHooks();

  await app.listen(config.PORT, "0.0.0.0");

  const logger = app.get(Logger);
  logger.log(`MikroServer API listening on port ${config.PORT}`, "Bootstrap");
  logger.log(`Environment: ${config.NODE_ENV}`, "Bootstrap");
}

bootstrap().catch((error: unknown) => {
  console.error("Fatal error during bootstrap:", error);
  process.exit(1);
});
