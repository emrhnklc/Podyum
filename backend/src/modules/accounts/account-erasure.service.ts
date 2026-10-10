import { Injectable, type OnModuleInit } from "@nestjs/common";
import { OutboxRegistry } from "../../common/outbox/outbox-dispatcher.js";
import type { OutboxHandler } from "../../common/outbox/outbox.types.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { OutboxEvent } from "../../generated/prisma/client.js";
import { GameLifecycleService } from "../games/game-lifecycle.service.js";
import { gameEvent, gameNow } from "../games/game-internals.js";
import { MediaService } from "../media/media.service.js";
import { writePollEvent } from "../polls/polls-internals.js";
import { LocalAccountArtifacts } from "./local-account-artifacts.service.js";

@Injectable()
export class AccountErasureService implements OnModuleInit, OutboxHandler {
  readonly name = "account-erasure";
  readonly types = ["account.deletion.requested"];
  constructor(private readonly db: PrismaService, private readonly registry: OutboxRegistry, private readonly games: GameLifecycleService,
    private readonly media: MediaService, private readonly artifacts: LocalAccountArtifacts) {}
  onModuleInit() { this.registry.register(this); }
  async deliver(event: OutboxEvent) {
    if (event.aggregateType !== "account-deletion") return;
    const job = await this.db.accountDeletion.findUnique({ where: { id: event.aggregateId }, select: { userId: true } });
    if (job) await this.erase(job.userId);
  }

  async erase(userId: string) {
    const job = await this.db.accountDeletion.findUnique({ where: { userId } });
    if (!job || job.completedAt) return { completed: !!job?.completedAt, changed: false };
    if (!await this.db.user.count({ where: { id: userId, status: "DELETED" } })) throw new Error("Silme işi için kapalı hesap gerekli.");

    // Kaynak başına kısa transaction. Başka kullanıcının oyu veya skor toplamı
    // silinmez; FK'ler için kişisel alanları temizlenmiş kullanıcı satırı korunur.
    const polls = await this.db.poll.findMany({ where: { authorId: userId }, select: { id: true } });
    for (const { id } of polls) await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await tx.poll.findUnique({ where: { id } }); if (!row) return;
      await tx.productTag.deleteMany({ where: { option: { pollId: id } } });
      if (row.contentStatus !== "REMOVED" || row.question || row.occasion) {
        const saved = await tx.poll.update({ where: { id }, data: { contentStatus: "REMOVED", question: "", occasion: null,
          commentsEnabled: false, version: { increment: 1 } } });
        await writePollEvent(tx, saved, "poll.moderation.changed", { contentStatus: "REMOVED", reason: "ACCOUNT_DELETED" });
      }
    });
    const comments = await this.db.comment.findMany({ where: { OR: [{ authorId: userId }, { poll: { authorId: userId } }] }, select: { id: true } });
    for (const { id } of comments) await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Comment" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await tx.comment.findUnique({ where: { id } }); if (!row || row.contentStatus === "REMOVED" && !row.body) return;
      await tx.comment.update({ where: { id }, data: { body: "", contentStatus: "REMOVED", removedAt: row.removedAt ?? await gameNow(tx), removedById: row.removedById ?? userId } });
      await tx.outboxEvent.create({ data: { aggregateType: "comment", aggregateId: id, aggregateVersion: 2, type: "poll.comment.removed",
        payload: { schemaVersion: 1, commentId: id, pollId: row.pollId, accountDeleted: true } } });
    });
    const sessions = await this.db.gameSession.findMany({ where: { OR: [{ hostId: userId }, { members: { some: { userId } } }] }, select: { id: true } });
    for (const { id } of sessions) await this.db.$transaction(async (tx) => {
      const session = await this.games.lock(tx, id); const now = await gameNow(tx);
      const member = await tx.gameMembership.updateMany({ where: { sessionId: id, userId, status: "ACTIVE" }, data: { status: "LEFT", leftAt: now } });
      const submission = await tx.gameSubmission.updateMany({ where: { sessionId: id, userId, status: { not: "WITHDRAWN" } }, data: { status: "WITHDRAWN" } });
      let saved = session;
      if (session.hostId === userId && !["COMPLETED", "CANCELLED"].includes(session.phase)) saved = await this.games.cancel(tx, session, "HOST_ACCOUNT_DELETED", now);
      if (session.hostId === userId && session.themeTitle !== "Silinmiş lobi") {
        saved = await tx.gameSession.update({ where: { id }, data: { themeTitle: "Silinmiş lobi", inviteHash: null, inviteExpiresAt: null, version: { increment: 1 } } });
      } else if (saved === session && (member.count || submission.count)) saved = await tx.gameSession.update({ where: { id }, data: { version: { increment: 1 } } });
      if (saved.version !== session.version) await gameEvent(tx, saved, "game.member.left", { userId, reason: "ACCOUNT_DELETED" });
    });
    // Eski oda modeli aktif servis tarafından kullanılmaz; davetler ve aktif
    // üyelikler kapanır, eski puan/sonuç kayıtları FK'leriyle korunur.
    await this.db.gameRoom.updateMany({ where: { hostId: userId }, data: { inviteCodeHash: null, rulesSnapshot: {} } });
    await this.db.activeGameMembership.deleteMany({ where: { userId } });
    await this.db.gameParticipant.updateMany({ where: { userId }, data: { status: "WITHDRAWN" } });
    await this.db.gameEntry.updateMany({ where: { userId }, data: { status: "DISQUALIFIED" } });
    const assets = await this.db.mediaAsset.findMany({ where: { ownerId: userId, filesPurgedAt: null }, select: { id: true } });
    for (const { id } of assets) await this.media.purgeDeletedOwnerAsset(userId, id);
    await this.artifacts.purge(job);

    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AccountDeletion" WHERE "id" = ${job.id}::uuid FOR UPDATE`;
      const current = await tx.accountDeletion.findUniqueOrThrow({ where: { id: job.id } }); if (current.completedAt) return;
      await tx.friendship.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.pollSave.deleteMany({ where: { userId } });
      await tx.pollVoteReason.deleteMany({ where: { voterId: userId } });
      await tx.notification.deleteMany({ where: { OR: [{ userId }, { actorId: userId }] } });
      await tx.idempotencyRecord.deleteMany({ where: { userId } });
      await tx.report.updateMany({ where: { reporterId: userId }, data: { note: null } });
      const now = await gameNow(tx);
      await tx.accountDeletion.update({ where: { id: job.id }, data: { completedAt: now, mailTokenHashes: [], pushTokenHashes: [], notificationIds: [] } });
      await tx.outboxEvent.create({ data: { aggregateType: "account-deletion", aggregateId: job.id, aggregateVersion: 2, type: "account.deletion.completed",
        payload: { schemaVersion: 1, deletionId: job.id, userId } } });
    }, { timeout: 30_000 });
    return { completed: true, changed: true };
  }
}
