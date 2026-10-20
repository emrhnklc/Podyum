import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { OutboxModule } from "../../common/outbox/outbox.module.js";
import { TrendProjectionService } from "./trend-projection.service.js";
import { TrendConsumer } from "./trend-consumer.service.js";
import { TrendsService } from "./trends.service.js";
import { TrendsController } from "./trends.controller.js";
@Module({
  imports: [DatabaseModule, OutboxModule],
  controllers: [TrendsController],
  providers: [TrendProjectionService, TrendConsumer, TrendsService],
  exports: [TrendProjectionService],
})
export class TrendsModule {}
