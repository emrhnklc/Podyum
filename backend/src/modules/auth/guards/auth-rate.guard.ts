import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiError } from "../../../common/errors/api-error.js";

@Injectable()
export class AuthRateGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext) {
    const now = Date.now();
    for (const [key, entry] of this.windows) if (entry.expires <= now) this.windows.delete(key);
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? "unknown";
    let window = this.windows.get(key);
    if (!window && this.windows.size < 10_000) {
      window = { count: 0, expires: now + 60_000 };
      this.windows.set(key, window);
    }
    if (!window || ++window.count > 30) {
      context.switchToHttp().getResponse<Response>().setHeader("Retry-After", String(Math.max(1, Math.ceil(((window?.expires ?? now + 60_000) - now) / 1000))));
      throw new ApiError(429, "RATE_LIMITED", "Çok fazla giriş isteği; biraz sonra tekrar dene.");
    }
    return true;
  }
}
