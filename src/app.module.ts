import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule],
})
export class AppModule {}
