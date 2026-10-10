import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { IdempotencyModule } from "../../common/idempotency/idempotency.module.js";
import { MediaModule } from "../media/media.module.js";
import { GameAccessModule } from "./game-access.module.js";
import { GameLifecycleService } from "./game-lifecycle.service.js";
import { GameSchedulerService } from "./game-scheduler.service.js";
import { GamesController } from "./games.controller.js";
import { GamesService } from "./games.service.js";
import { GameWorker } from "./game.worker.js";

@Module({ imports: [DatabaseModule, IdempotencyModule, MediaModule, GameAccessModule], controllers: [GamesController],
  providers: [GamesService, GameLifecycleService, GameSchedulerService, GameWorker], exports: [GamesService] })
export class GamesModule {}
