import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { OutboxModule } from "../../common/outbox/outbox.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { GamesModule } from "../games/games.module.js";
import { MediaModule } from "../media/media.module.js";
import { PollsModule } from "../polls/polls.module.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsService } from "./accounts.service.js";
import { AccountErasureService } from "./account-erasure.service.js";
import { LocalAccountArtifacts } from "./local-account-artifacts.service.js";

@Module({ imports: [DatabaseModule, OutboxModule, AuthModule, GamesModule, MediaModule, PollsModule],
  controllers: [AccountsController], providers: [AccountsService, AccountErasureService, LocalAccountArtifacts] })
export class AccountsModule {}
