import { Injectable, type OnModuleInit } from "@nestjs/common";
import { OutboxRegistry } from "../../common/outbox/outbox-dispatcher.js";
import type { OutboxHandler, OutboxTx } from "../../common/outbox/outbox.types.js";
import type { OutboxEvent } from "../../generated/prisma/client.js";
import { canonicalPair, SocialAccessService } from "../social/social-access.service.js";
import { NOTIFICATIONS, type NotificationType } from "./notification-catalog.js";

// Bu süreden eski olay bildirime dönüşmez; işçi uzun süre kapalı kaldıysa eski haber yağmaz.
const MAX_EVENT_AGE_MS = 72 * 3_600_000;
const FAN_OUT_CHUNK = 1000;
const text = (value: unknown) => typeof value === "string" && value ? value : null;

type Recipient = { userId: string; resourceId: string; actorId?: string | null; at?: Date };

// İç olayları kişisel bildirimlere çevirir. Olay yalnız tetikleyicidir; kime ne
// yazılacağı her seferinde güncel veritabanı durumundan okunur, bu yüzden geç
// veya sıra dışı gelen olay artık geçerli olmayan bir bildirim üretmez.
@Injectable()
export class NotificationProjector implements OutboxHandler, OnModuleInit {
  readonly name = "notification-projector";
  readonly types = ["social.relationship.changed", "poll.comment.created", "poll.comment.removed", "poll.closed", "game.voting.opened", "game.completed"];

  constructor(private readonly registry: OutboxRegistry, private readonly access: SocialAccessService) {}

  onModuleInit() { this.registry.register(this); }

  async project(tx: OutboxTx, event: OutboxEvent) {
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    if (now.getTime() - event.createdAt.getTime() > MAX_EVENT_AGE_MS) return;
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    if (event.type === "social.relationship.changed") return this.relationship(tx, event, payload);
    if (event.type === "poll.comment.created") return this.comments(tx, event, payload, true);
    if (event.type === "poll.comment.removed") return this.comments(tx, event, payload, false);
    if (event.type === "poll.closed") return this.pollClosed(tx, event, payload);
    return this.game(tx, event, payload);
  }

  // Aynı olay + kişi + tür ikinci kez yazılmaz. Push yalnız yeni oluşan satır için istenir.
  private async create(tx: OutboxTx, event: OutboxEvent, type: NotificationType, recipients: Recipient[]) {
    const definition = NOTIFICATIONS[type];
    for (let start = 0; start < recipients.length; start += FAN_OUT_CHUNK) {
      const created = await tx.notification.createManyAndReturn({ skipDuplicates: true, select: { id: true, userId: true },
        data: recipients.slice(start, start + FAN_OUT_CHUNK).map((row) => ({ userId: row.userId, eventId: event.id, type,
          resourceType: definition.resourceType, resourceId: row.resourceId, actorId: row.actorId ?? null,
          ...(row.at ? { createdAt: row.at, activityAt: row.at } : {}) })) });
      if (definition.push && created.length) await tx.outboxEvent.createMany({ data: created.map((row) => ({
        aggregateType: "notification", aggregateId: row.id, aggregateVersion: 1, type: "notification.created",
        payload: { schemaVersion: 1, notificationId: row.id, userId: row.userId, type } })) });
    }
  }

  private async visibleTo(tx: OutboxTx, recipientId: string, actorId: string) {
    if (!await tx.user.count({ where: { id: recipientId, status: "ACTIVE" } })) return false;
    return await tx.user.count({ where: { id: actorId, ...this.access.activeUnblockedUserWhere(recipientId) } }) > 0;
  }

  // Her ilişki değişikliği iki kullanıcı için ayrı olay yazar; bildirim işlemi yapmayan tarafa gider.
  private async relationship(tx: OutboxTx, event: OutboxEvent, payload: Record<string, unknown>) {
    const userId = text(payload.userId); const otherId = text(payload.otherUserId);
    const actorId = text(payload.actorId); const reason = text(payload.reason);
    if (!userId || !otherId || !actorId || !reason) return;
    // İstek sonuçlandıysa veya ilişki değiştiyse bekleyen "istek geldi" satırı artık geçersizdir.
    if (reason !== "REQUESTED") await tx.notification.deleteMany({ where: { userId, actorId: otherId, type: "friend.request.received" } });
    if (userId === actorId || (reason !== "REQUESTED" && reason !== "ACCEPTED")) return;
    const row = await tx.friendship.findUnique({ where: { userAId_userBId: canonicalPair(userId, actorId) }, select: { status: true, requesterId: true } });
    const current = reason === "REQUESTED" ? row?.status === "PENDING" && row.requesterId === actorId : row?.status === "ACCEPTED";
    if (!current || !await this.visibleTo(tx, userId, actorId)) return;
    // Reddedilip yeniden gönderilen istek tek satır kalır.
    if (reason === "REQUESTED") await tx.notification.deleteMany({ where: { userId, actorId, type: "friend.request.received" } });
    await this.create(tx, event, reason === "REQUESTED" ? "friend.request.received" : "friend.request.accepted", [{ userId, resourceId: actorId, actorId }]);
  }

  // Paylaşım başına tek okunmamış satır. Sayı saklanan bir sayaç gibi artırılmaz;
  // grubun başladığı andan beri görünür yorumlardan yeniden hesaplanır, böylece
  // kaldırılan yorum veya tekrar işlenen olay sayıyı bozmaz.
  private async comments(tx: OutboxTx, event: OutboxEvent, payload: Record<string, unknown>, created: boolean) {
    const pollId = text(payload.pollId); const commentId = text(payload.commentId);
    if (!pollId || !commentId) return;
    const poll = await tx.poll.findUnique({ where: { id: pollId }, select: { authorId: true, contentStatus: true, status: true, author: { select: { status: true } } } });
    if (!poll) return;
    const recipientId = poll.authorId;
    const group = await tx.notification.findFirst({ where: { userId: recipientId, type: "poll.comment.received", resourceId: pollId, readAt: null }, orderBy: { activityAt: "desc" } });
    const reachable = poll.contentStatus === "VISIBLE" && (poll.status === "OPEN" || poll.status === "CLOSED") && poll.author.status === "ACTIVE";
    if (!reachable) { if (group) await tx.notification.delete({ where: { id: group.id } }); return; }
    const visible = { pollId, contentStatus: "VISIBLE" as const, authorId: { not: recipientId }, author: this.access.activeUnblockedUserWhere(recipientId) };
    if (group) {
      const where = { ...visible, createdAt: { gte: group.createdAt } };
      const latest = await tx.comment.findFirst({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { authorId: true, createdAt: true } });
      if (!latest) { await tx.notification.delete({ where: { id: group.id } }); return; }
      await tx.notification.update({ where: { id: group.id }, data: { count: await tx.comment.count({ where }), actorId: latest.authorId, activityAt: latest.createdAt } });
      return;
    }
    if (!created) return;
    const comment = await tx.comment.findFirst({ where: { ...visible, id: commentId }, select: { authorId: true, createdAt: true } });
    if (comment) await this.create(tx, event, "poll.comment.received", [{ userId: recipientId, resourceId: pollId, actorId: comment.authorId, at: comment.createdAt }]);
  }

  // Sahibe push'lu, oy verenlere yalnız uygulama içi. Oy verenlerde sonucu hâlâ görebilenler seçilir.
  private async pollClosed(tx: OutboxTx, event: OutboxEvent, payload: Record<string, unknown>) {
    const pollId = text(payload.pollId);
    if (!pollId) return;
    const poll = await tx.poll.findFirst({ where: { id: pollId, status: "CLOSED", contentStatus: "VISIBLE", author: { status: "ACTIVE" } }, select: { id: true, authorId: true, visibility: true } });
    if (!poll) return;
    await this.create(tx, event, "poll.result.own", [{ userId: poll.authorId, resourceId: poll.id }]);
    const voters = await tx.pollVote.findMany({ where: { pollId, voterId: { not: poll.authorId }, voter: { AND: [
      this.access.activeUnblockedUserWhere(poll.authorId), ...(poll.visibility === "FRIENDS" ? [this.access.acceptedFriendWhere(poll.authorId)] : []),
    ] } }, select: { voterId: true } });
    await this.create(tx, event, "poll.result.voted", voters.map((vote) => ({ userId: vote.voterId, resourceId: poll.id })));
  }

  private async game(tx: OutboxTx, event: OutboxEvent, payload: Record<string, unknown>) {
    const sessionId = text(payload.sessionId);
    if (!sessionId) return;
    const type = event.type === "game.voting.opened" ? "game.voting.opened" as const : "game.completed" as const;
    // Aşama çoktan geçtiyse "oylama başladı" haberi yazılmaz.
    const session = await tx.gameSession.findFirst({ where: { id: sessionId, phase: type === "game.completed" ? "COMPLETED" : "VOTING" }, select: { id: true } });
    if (!session) return;
    // Oyun bitince okunmamış "oylama başladı" çağrısının anlamı kalmaz.
    if (type === "game.completed") await tx.notification.deleteMany({ where: { type: "game.voting.opened", resourceId: sessionId, readAt: null } });
    const members = await tx.gameMembership.findMany({ where: { sessionId, status: "ACTIVE", user: { status: "ACTIVE" } }, select: { userId: true } });
    await this.create(tx, event, type, members.map((member) => ({ userId: member.userId, resourceId: sessionId })));
  }
}
