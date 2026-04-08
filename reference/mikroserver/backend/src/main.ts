import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadAndValidateConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

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
    console.error('--- NEST FACTORY CREATE FAILED ---');
    console.error(err instanceof Error ? err.message : err);
    throw err;
  }

  // Use Pino as the application logger
  app.useLogger(app.get(Logger));

  // CORS — allow frontend origin
  app.enableCors({
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Global API versioning
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix(config.API_PREFIX);

  // Global validation pipe - strict mode
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true,           // Auto-transform primitives
      transformOptions: {
        enableImplicitConversion: false, // Explicit typing required
      },
      stopAtFirstError: false,   // Collect all errors
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger (only in non-production)
  if (config.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MikroServer API')
      .setDescription('WiFi Monetization Platform - Internal API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('plans', 'WiFi plan management')
      .addTag('transactions', 'Payment transactions')
      .addTag('vouchers', 'Hotspot vouchers')
      .addTag('routers', 'MikroTik router management')
      .addTag('sessions', 'Active sessions')
      .addTag('metrics', 'KPIs and analytics')
      .addTag('health', 'System health')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(config.PORT, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`MikroServer API listening on port ${config.PORT}`, 'Bootstrap');
  logger.log(`Environment: ${config.NODE_ENV}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
