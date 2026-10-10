import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { SocialModule } from "./modules/social/social.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { PollsModule } from "./modules/polls/polls.module.js";
import { FeedModule } from "./modules/feed/feed.module.js";

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule, SocialModule, UsersModule, MediaModule, PollsModule, FeedModule],
})
export class AppModule {}
