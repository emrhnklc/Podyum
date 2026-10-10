import { Module } from "@nestjs/common";
import { IdempotencyModule } from "../../common/idempotency/idempotency.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { MediaModule } from "../media/media.module.js";
import { SocialModule } from "../social/social.module.js";
import { PollsController } from "./polls.controller.js";
import { PollsService } from "./polls.service.js";

@Module({ imports: [DatabaseModule, MediaModule, SocialModule, IdempotencyModule], controllers: [PollsController], providers: [PollsService], exports: [PollsService] })
export class PollsModule {}
