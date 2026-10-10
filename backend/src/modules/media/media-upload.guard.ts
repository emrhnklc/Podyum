import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { ApiRequest } from "../../common/http/request-context.js";
import { MediaService } from "./media.service.js";

@Injectable()
export class MediaUploadGuard implements CanActivate {
  constructor(private readonly media: MediaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const id = request.params.id;
    if (typeof id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Medya id geçerli bir UUID olmalı.");
    }
    await this.media.requireUploadGrant(request.user!.userId, id.toLowerCase(), request.headers["x-upload-token"]);
    return true;
  }
}
