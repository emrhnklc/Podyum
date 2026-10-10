import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { OutboxRegistry } from "../../../common/outbox/outbox-dispatcher.js";
import type { OutboxHandler } from "../../../common/outbox/outbox.types.js";
import { PrismaService } from "../../../database/prisma.service.js";
import type { OutboxEvent } from "../../../generated/prisma/client.js";
import { notificationDefinition, PUSH_TITLE, targetType } from "../notification-catalog.js";
import { PUSH_PROVIDER, type PushProvider } from "./push-provider.js";

// Yeni bildirimi kullanıcının geçerli cihazlarına iletir. Gövde genel metindir;
// isim, soru veya yorum taşımaz. data alanı uygulamanın açacağı hedefi verir.
@Injectable()
export class PushDeliveryHandler implements OutboxHandler, OnModuleInit {
  readonly name = "push-delivery";
  readonly types = ["notification.created"];

  constructor(private readonly registry: OutboxRegistry, private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private readonly provider: PushProvider) {}

  onModuleInit() { this.registry.register(this); }

  async deliver(event: OutboxEvent) {
    const id = (event.payload as { notificationId?: unknown } | null)?.notificationId;
    if (typeof id !== "string") return;
    const row = await this.prisma.notification.findUnique({ where: { id }, include: { user: { select: { status: true, settings: true } } } });
    // Silinmiş veya çoktan okunmuş bildirim için push gönderilmez.
    if (!row || row.readAt || row.user.status !== "ACTIVE") return;
    const push = notificationDefinition(row.type)?.push;
    const preference = notificationDefinition(row.type)?.preference;
    if (!push || !preference) return;
    const now = new Date();
    // Geç kalmış haber (ör. biten oylama penceresi) gönderilmez.
    if (now.getTime() - row.activityAt.getTime() > push.ttlSeconds * 1000) return;
    // Ayar satırı yoksa varsayılanlar açıktır.
    if (row.user.settings && (!row.user.settings.pushEnabled || !row.user.settings[preference])) return;
    // Çıkış yapılmış veya süresi dolmuş oturumun cihazına gönderilmez.
    const devices = await this.prisma.deviceToken.findMany({ where: { userId: row.userId, session: { revokedAt: null, expiresAt: { gt: now } } }, select: { id: true, token: true } });
    if (!devices.length) return;
    const results = await this.provider.send(devices.map((device) => ({ to: device.token, userId: row.userId, title: PUSH_TITLE, body: push.body, ttlSeconds: push.ttlSeconds,
      data: { notificationId: row.id, type: row.type, targetType: targetType(row.resourceType), targetId: row.resourceId } })));
    const invalid = devices.filter((_device, index) => results[index] === "invalid-token").map((device) => device.id);
    if (invalid.length) await this.prisma.deviceToken.deleteMany({ where: { id: { in: invalid } } });
  }
}
