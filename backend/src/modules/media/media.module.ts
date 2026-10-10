import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialModule } from "../social/social.module.js";
import { ImageProcessor } from "./image-processor.service.js";
import { LocalMediaStorage } from "./local-media-storage.service.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";
import { MediaUploadGuard } from "./media-upload.guard.js";
import { MediaWorkInterceptor } from "./media-work.interceptor.js";
import { GameAccessModule } from "../games/game-access.module.js";

@Module({
  imports: [DatabaseModule, SocialModule, GameAccessModule],
  controllers: [MediaController],
  providers: [MediaService, LocalMediaStorage, ImageProcessor, MediaUploadGuard, MediaWorkInterceptor],
  exports: [MediaService],
})
export class MediaModule {}
