import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyModule } from "../../common/idempotency/idempotency.module.js";
import {
  CatalogAdminController,
  CatalogController,
} from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogLinkService } from "./catalog-link.service.js";
@Module({
  imports: [DatabaseModule, AuthModule, IdempotencyModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogService, CatalogLinkService],
  exports: [CatalogLinkService],
})
export class CatalogModule {}
