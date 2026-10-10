import { Module } from "@nestjs/common";
import { OutboxModule } from "../../common/outbox/outbox.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { SocialModule } from "../social/social.module.js";
import { NotificationProjector } from "./notification-projector.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { PushDeliveryHandler } from "./push/push-delivery.handler.js";
import { createPushProvider, PUSH_PROVIDER } from "./push/push-provider.js";

// Olay kuyruğundan uygulama içi bildirim üretir ve push teslim eder. Diğer
// modüller bu modülü çağırmaz; yalnız kendi transaction'larında olay yazarlar.
@Module({ imports: [DatabaseModule, SocialModule, OutboxModule], controllers: [NotificationsController],
  providers: [NotificationsService, NotificationProjector, PushDeliveryHandler, { provide: PUSH_PROVIDER, useFactory: createPushProvider }] })
export class NotificationsModule {}
