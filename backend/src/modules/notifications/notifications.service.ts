import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor.js";
import type { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { SocialAccessService } from "../social/social-access.service.js";
import type { RegisterDeviceDto } from "./dto/notifications.dto.js";
import { NOTIFICATION_TYPES, targetType, type NotificationType } from "./notification-catalog.js";

type Tx = Prisma.TransactionClient;

const DEVICES_PER_USER = 10;
const serverNow = async (tx: Tx) => (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`)[0].now;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService) {}

  // Engellenen veya pasif hale gelen kişinin bildirimi silinmez ama listede ve sayaçta görünmez.
  private visibleWhere(userId: string): Prisma.NotificationWhereInput {
    return { userId, type: { in: NOTIFICATION_TYPES }, OR: [{ actorId: null }, { actor: this.access.activeUnblockedUserWhere(userId) }] };
  }

  list(userId: string, query: PageQueryDto) {
    const context = { list: "notifications-v1", userId };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.notification.findMany({
        where: { AND: [this.visibleWhere(userId), ...(cursor ? [{ OR: [
          { activityAt: { lt: new Date(cursor.createdAt) } }, { activityAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ] }] : [])] },
        orderBy: [{ activityAt: "desc" }, { id: "desc" }], take: query.limit + 1,
        include: { actor: { select: { id: true, username: true, displayName: true, avatarMediaId: true } } },
      });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      // Başlık yalnız izleyicinin hâlâ görebildiği hedef için döner; bildirim erişim hakkı vermez.
      const ids = (type: string) => page.filter((row) => row.resourceType === type).map((row) => row.resourceId);
      const polls = await tx.poll.findMany({ where: { id: { in: ids("poll") }, ...this.access.visiblePublishedPollWhere(userId) }, select: { id: true, question: true } });
      const games = await tx.gameSession.findMany({ where: { id: { in: ids("game") }, members: { some: { userId } } }, select: { id: true, themeTitle: true } });
      const titles = new Map<string, string | null>([...polls.map((poll) => [poll.id, poll.question] as const), ...games.map((game) => [game.id, game.themeTitle] as const)]);
      return {
        items: page.map((row) => ({
          id: row.id, type: row.type as NotificationType, createdAt: row.activityAt, isRead: row.readAt !== null, readAt: row.readAt, count: row.count,
          actor: row.actor ? { id: row.actor.id, username: row.actor.username, displayName: row.actor.displayName,
            avatarPath: row.actor.avatarMediaId ? `/v1/media/${row.actor.avatarMediaId}/content` : null } : null,
          target: { type: targetType(row.resourceType), id: row.resourceId, title: titles.get(row.resourceId) ?? null },
        })),
        unreadCount: await tx.notification.count({ where: { ...this.visibleWhere(userId), readAt: null } }),
        serverNow: await serverNow(tx),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.activityAt.toISOString() }, context) : null,
      };
    }, { isolationLevel: "RepeatableRead" });
  }

  async unreadCount(userId: string) {
    return { unreadCount: await this.prisma.notification.count({ where: { ...this.visibleWhere(userId), readAt: null } }) };
  }

  // Tekrar aynı sonucu verir; ilk okunma zamanı korunur. Başkasının bildirimi yok sayılır.
  markRead(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Notification" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await tx.notification.findFirst({ where: { id, userId }, select: { readAt: true } });
      if (!row) throw new ApiError(404, "RESOURCE_NOT_FOUND", "Bildirim bulunamadı.");
      if (row.readAt) return { id, isRead: true as const, readAt: row.readAt };
      const readAt = await serverNow(tx);
      await tx.notification.update({ where: { id }, data: { readAt } });
      return { id, isRead: true as const, readAt };
    });
  }

  markAllRead(userId: string, before?: string) {
    return this.prisma.$transaction(async (tx) => {
      const now = await serverNow(tx);
      const limit = before !== undefined && new Date(before) < now ? new Date(before) : now;
      const { count } = await tx.notification.updateMany({ where: { userId, readAt: null, activityAt: { lte: limit } }, data: { readAt: now } });
      return { updated: count, unreadCount: await tx.notification.count({ where: { ...this.visibleWhere(userId), readAt: null } }) };
    });
  }

  // Kurulum tek kullanıcıya ve onu kaydeden oturuma bağlıdır. Aynı telefonda başka
  // hesap giriş yaparsa kayıt yeni hesaba geçer; eski hesap o cihaza push almaz.
  registerDevice(user: AuthenticatedUser, installationId: string, dto: RegisterDeviceDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.userId}::uuid FOR UPDATE`;
      // Yeniden kurulumda aynı cihaz anahtarı yeni kurulum kimliğiyle gelir.
      await tx.deviceToken.deleteMany({ where: { token: dto.token, installationId: { not: installationId } } });
      const fields = { userId: user.userId, sessionId: user.sessionId, token: dto.token, platform: dto.platform };
      const row = await tx.deviceToken.upsert({ where: { installationId }, create: { installationId, ...fields }, update: fields });
      const extra = await tx.deviceToken.findMany({ where: { userId: user.userId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: DEVICES_PER_USER, select: { id: true } });
      if (extra.length) await tx.deviceToken.deleteMany({ where: { id: { in: extra.map((device) => device.id) } } });
      return { installationId, platform: row.platform, updatedAt: row.updatedAt };
    });
  }

  async removeDevice(userId: string, installationId: string) {
    await this.prisma.deviceToken.deleteMany({ where: { installationId, userId } });
    return { installationId, removed: true as const };
  }
}
