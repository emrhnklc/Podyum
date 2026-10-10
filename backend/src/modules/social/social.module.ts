import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialAccessService } from "./social-access.service.js";
import { SocialController } from "./social.controller.js";
import { SocialService } from "./social.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [SocialController],
  providers: [SocialService, SocialAccessService],
  exports: [SocialAccessService],
})
export class SocialModule {}
