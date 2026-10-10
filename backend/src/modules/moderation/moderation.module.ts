import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialModule } from "../social/social.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyModule } from "../../common/idempotency/idempotency.module.js";
import { MediaModule } from "../media/media.module.js";
import { GamesModule } from "../games/games.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({ imports: [DatabaseModule, SocialModule, AuthModule, IdempotencyModule, MediaModule, GamesModule],
  controllers: [ReportsController, AdminController], providers: [ReportsService, AdminService] })
export class ModerationModule {}
