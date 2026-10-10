import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialModule } from "../social/social.module.js";
import { FeedController } from "./feed.controller.js";
import { FeedService } from "./feed.service.js";

@Module({ imports: [DatabaseModule, SocialModule], controllers: [FeedController], providers: [FeedService] })
export class FeedModule {}
