import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { ApiError } from "../../../common/errors/api-error.js";
import type { ApiRequest, AuthenticatedUser } from "../../../common/http/request-context.js";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const user = context.switchToHttp().getRequest<ApiRequest>().user;
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Giriş yapmalısın.");
  return user;
});
