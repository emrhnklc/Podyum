import "reflect-metadata";
import { type Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule, getSchemaPath } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { readEnvironment } from "./common/config/environment.js";
import { ApiExceptionFilter } from "./common/errors/api-exception.filter.js";
import { requestContext } from "./common/http/request-context.js";
import { validationPipe } from "./common/http/validation.js";
import { ApiErrorResponseDto } from "./common/errors/api-error.dto.js";

export async function createApp(rootModule: Type = AppModule, env = readEnvironment()) {
  const app = await NestFactory.create<NestExpressApplication>(rootModule, {
    bodyParser: false, ...(env.nodeEnv === "test" ? { logger: ["error"] } : {}),
  });
  app.disable("x-powered-by");
  app.use(requestContext);
  app.useBodyParser("json", { limit: "64kb", strict: true });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  if (env.corsOrigins.length > 0) {
    app.enableCors({ origin: env.corsOrigins, exposedHeaders: ["X-Request-Id"], credentials: false });
  }
  if (env.docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle("Kombin API")
      .setDescription("Çalışan endpoint'ler. Google/Apple mock ve yerel posta kutusu geliştirme içindir.")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("v1/docs", app, () => {
      const document = SwaggerModule.createDocument(app, config, { extraModels: [ApiErrorResponseDto] });
      for (const path of Object.values(document.paths)) {
        for (const method of ["get", "post", "put", "patch", "delete"] as const) {
          const operation = path[method];
          if (!operation) continue;
          for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503]) {
            operation.responses[status] ??= {
              description: "Ortak hata yanıtı; error.code kararlıdır.",
              content: { "application/json": { schema: { $ref: getSchemaPath(ApiErrorResponseDto) } } },
            };
          }
        }
      }
      return document;
    }, {
      jsonDocumentUrl: "/v1/openapi.json",
      swaggerOptions: { persistAuthorization: false },
    });
  }
  app.enableShutdownHooks();
  return app;
}
