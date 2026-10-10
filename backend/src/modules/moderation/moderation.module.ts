import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialModule } from "../social/social.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

// Şimdilik yalnız şikâyet kaydı; yönetici rolü ve inceleme API'leri 16. adımda eklenir.
@Module({ imports: [DatabaseModule, SocialModule], controllers: [ReportsController], providers: [ReportsService] })
export class ModerationModule {}
