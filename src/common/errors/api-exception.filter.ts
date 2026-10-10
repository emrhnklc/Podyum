import { randomUUID } from "node:crypto";
import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import type { ApiRequest } from "../http/request-context.js";
import { ApiError } from "./api-error.js";

const defaults: Record<number, [string, string]> = {
  400: ["VALIDATION_ERROR", "İstek geçersiz."],
  401: ["AUTH_REQUIRED", "Giriş yapmalısın."],
  403: ["ACCESS_DENIED", "Bu işlem için yetkin yok."],
  404: ["RESOURCE_NOT_FOUND", "Kaynak bulunamadı."],
  409: ["CONFLICT", "İşlem mevcut durumla çakışıyor."],
  413: ["PAYLOAD_TOO_LARGE", "İstek boyutu sınırı aşıldı."],
  415: ["UNSUPPORTED_MEDIA_TYPE", "İçerik türü desteklenmiyor."],
  422: ["UNPROCESSABLE_REQUEST", "İstek bu durumda uygulanamıyor."],
  429: ["RATE_LIMITED", "Çok fazla istek; daha sonra tekrar dene."],
  503: ["DEPENDENCY_UNAVAILABLE", "Gerekli servis şu anda kullanılamıyor."],
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<ApiRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    const requestId = request.requestId ?? randomUUID();
    const parser = exception as { type?: string; status?: number } | null;
    const status = exception instanceof HttpException ? exception.getStatus()
      : parser?.type === "entity.too.large" ? 413
      : parser?.type === "entity.parse.failed" ? 400
      : 500;
    const [code, message] = defaults[status] ?? ["INTERNAL_ERROR", "Beklenmeyen bir hata oluştu."];
    const detail = exception instanceof ApiError ? exception.getResponse() as object : { code, message };
    // Hata nesnesi, body, URL query, parola ve token loglanmaz.
    if (status >= 500) this.logger.error(JSON.stringify({ requestId, status, code }));
    response.setHeader("X-Request-Id", requestId);
    response.status(status).json({ error: { ...detail, requestId } });
  }
}
