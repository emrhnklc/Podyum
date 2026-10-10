import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  provider: string;
}

export interface ApiRequest extends Request {
  requestId?: string;
  user?: AuthenticatedUser;
}

export function requestContext(request: ApiRequest, response: Response, next: NextFunction) {
  request.requestId = randomUUID();
  response.setHeader("X-Request-Id", request.requestId);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
}
