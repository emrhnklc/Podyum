import { Module } from "@nestjs/common";
import { IdempotencyModule } from "../../common/idempotency/idempotency.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { MediaModule } from "../media/media.module.js";
import { SocialModule } from "../social/social.module.js";
import { PollsController } from "./polls.controller.js";
import { PollsService } from "./polls.service.js";
import { PollParticipationService } from "./poll-participation.service.js";
import { PollCloseWorker } from "./poll-close.worker.js";
import { PollInteractionsController } from "./poll-interactions.controller.js";
import { PollInteractionsService } from "./poll-interactions.service.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { PollProductTagsService } from "./poll-product-tags.service.js";

@Module({ imports: [DatabaseModule, MediaModule, SocialModule, IdempotencyModule, CatalogModule], controllers: [PollsController, PollInteractionsController],
  providers: [PollsService, PollParticipationService, PollInteractionsService, PollCloseWorker, PollProductTagsService], exports: [PollsService, PollParticipationService] })
export class PollsModule {}
