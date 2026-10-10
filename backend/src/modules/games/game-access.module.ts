import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialModule } from "../social/social.module.js";
import { GameAccessService } from "./game-access.service.js";

@Module({ imports: [DatabaseModule, SocialModule], providers: [GameAccessService], exports: [GameAccessService] })
export class GameAccessModule {}
