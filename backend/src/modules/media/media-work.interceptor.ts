import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { defer, finalize } from "rxjs";
import { ApiError } from "../../common/errors/api-error.js";

@Injectable()
export class MediaWorkInterceptor implements NestInterceptor {
  private active = 0;

  intercept(_context: ExecutionContext, next: CallHandler) {
    return defer(() => {
      if (this.active >= 2) throw new ApiError(429, "MEDIA_BUSY", "Fotoğraf hattı meşgul; biraz sonra tekrar dene.");
      this.active++;
      return defer(() => next.handle()).pipe(finalize(() => { this.active--; }));
    });
  }
}
