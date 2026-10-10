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
import { AuthModule } from "../auth/auth.module.js";
import { OutboxModule } from "../../common/outbox/outbox.module.js";
import { GameRealtimeGateway } from "./game-realtime.gateway.js";

@Module({ imports: [DatabaseModule, IdempotencyModule, MediaModule, GameAccessModule, AuthModule, OutboxModule], controllers: [GamesController],
  providers: [GamesService, GameLifecycleService, GameSchedulerService, GameWorker, GameRealtimeGateway], exports: [GamesService, GameLifecycleService] })
export class GamesModule {}
