import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";
import { SocialModule } from "../social/social.module.js";
import { PollsModule } from "../polls/polls.module.js";

@Module({
  imports: [DatabaseModule, SocialModule, PollsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
