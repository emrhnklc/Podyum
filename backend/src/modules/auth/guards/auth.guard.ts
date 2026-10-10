import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ApiRequest } from "../../../common/http/request-context.js";
import { ApiError } from "../../../common/errors/api-error.js";
import { AuthService } from "../auth.service.js";
import { PUBLIC_ROUTE } from "../decorators/public.decorator.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const match = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i);
    if (!match) throw new ApiError(401, "AUTH_REQUIRED", "Geçerli bir oturum gerekli.");
    request.user = await this.auth.authenticate(match[1]);
    return true;
  }
}
