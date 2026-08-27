import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser = require("cookie-parser");
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  const configuredOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const development = process.env.NODE_ENV !== "production";
  app.enableCors({
    credentials: true,
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      try {
        const url = new URL(origin);
        const privateNetwork =
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1" ||
          /^10\./.test(url.hostname) ||
          /^192\.168\./.test(url.hostname) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname) ||
          url.hostname.endsWith(".local");
        if (development && privateNetwork && url.port === "3000") {
          callback(null, true);
          return;
        }
      } catch {
        // Invalid origins are rejected below.
      }
      callback(new Error("Origin is not allowed by WMS CORS policy"), false);
    },
  });

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("WMS API")
    .setDescription("Warehouse management API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(
    Number(process.env.PORT ?? 4000),
    process.env.HOST ?? "0.0.0.0",
  );
}

void bootstrap();
