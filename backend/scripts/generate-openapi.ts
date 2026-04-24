import { writeFileSync } from "fs";
import { resolve } from "path";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";

function ensureEnv(key: string, value: string): void {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

async function main(): Promise<void> {
  ensureEnv("NODE_ENV", "development");
  ensureEnv("PORT", "3000");
  ensureEnv("API_PREFIX", "api/v1");
  ensureEnv(
    "DATABASE_URL",
    "postgresql://mikroserver:mikroserver@localhost:5432/mikroserver",
  );
  ensureEnv(
    "JWT_ACCESS_SECRET",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  ensureEnv(
    "JWT_REFRESH_SECRET",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  );
  ensureEnv(
    "ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  const config = new DocumentBuilder()
    .setTitle("MikroServer API")
    .setDescription("WiFi Monetization Platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(process.cwd(), "openapi.json");
  writeFileSync(outputPath, JSON.stringify(document, null, 2), "utf8");

  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec generated: ${outputPath}`);
}

void main();
