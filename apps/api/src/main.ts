import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { SanitizeResponseInterceptor } from "./common/interceptors/sanitize-response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api/v1");
  app.enableVersioning({ type: VersioningType.URI });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN") ?? "http://localhost:3000",
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SanitizeResponseInterceptor());

  const swaggerEnabled =
    config.get<string>("SWAGGER_ENABLED") === "true" ||
    (config.get<string>("NODE_ENV") !== "production" && config.get<string>("SWAGGER_ENABLED") !== "false");
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Study Center CRM API")
        .setDescription("REST API for study center management")
        .setVersion("1.0")
        .addBearerAuth()
        .build()
    );
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(config.get<number>("API_PORT") ?? 4000);
}

void bootstrap();
