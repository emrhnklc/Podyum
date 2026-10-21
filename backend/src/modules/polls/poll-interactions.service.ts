import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor.js";
import type { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { PollReasonCode } from "../../generated/prisma/enums.js";
import { SocialAccessService } from "../social/social-access.service.js";
import { pollCardInclude, presentPollCard } from "./poll-card.js";
import { effectivePollStatus, pollServerNow } from "./polls-internals.js";

type Tx = Prisma.TransactionClient;

const COMMENTS_PER_POLL_PER_DAY = 30;
const commentMissing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Yorum bulunamadı.");

// Kaydetme, yorum ve oy sonrası hazır neden etiketleri. Hepsi normal tercihten
// ayrıdır: oy sayısını, sonucu veya Poll.version değerini değiştirmez.
@Injectable()
export class PollInteractionsService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService,
    private readonly idempotency: IdempotencyService) {}

  private async activeActor(tx: Tx, userId: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    if (!await tx.user.count({ where: { id: userId, status: "ACTIVE" } })) throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
  }

  // ── Kaydetme ──────────────────────────────────────────────────────────

  save(userId: string, pollId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${pollId}::uuid FOR SHARE`;
      await this.activeActor(tx, userId);
      // Kaydetmek erişim hakkı vermez; yalnız görülebilen yayın kaydedilir.
      await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const row = await tx.pollSave.upsert({ where: { pollId_userId: { pollId, userId } }, create: { pollId, userId }, update: {} });
      return { pollId, isSaved: true, savedAt: row.createdAt };
    });
  }

  // Erişimi sonradan kapanan kayıt da kaldırılabilir; olmayan kayıt hata değildir.
  async unsave(userId: string, pollId: string) {
    await this.prisma.pollSave.deleteMany({ where: { pollId, userId } });
    return { pollId, isSaved: false, savedAt: null };
  }

  listSaved(userId: string, query: PageQueryDto) {
    const context = { list: "saved-polls-v1", userId };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      const now = await pollServerNow(tx);
      const rows = await tx.pollSave.findMany({
        where: { userId, poll: this.access.visiblePublishedPollWhere(userId), ...(cursor ? { OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), pollId: { lt: cursor.id } },
        ] } : {}) },
        orderBy: [{ createdAt: "desc" }, { pollId: "desc" }], take: query.limit + 1,
        include: { poll: { include: pollCardInclude(this.access, userId) } },
      });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return { items: page.map((row) => ({ ...presentPollCard(row.poll, userId, now), savedAt: row.createdAt })), serverNow: now,
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.pollId, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }

  // ── Beğeni ────────────────────────────────────────────────────────────
  // Tercih oyundan ayrıdır: sonucu, trendi veya Poll.version'ı değiştirmez.
  // Kendi paylaşımını beğenmek serbesttir; oy kuralları uygulanmaz.

  private likeCount(tx: Tx, userId: string, pollId: string) {
    return tx.pollLike.count({ where: { pollId, user: this.access.activeUnblockedUserWhere(userId) } });
  }

  like(userId: string, pollId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${pollId}::uuid FOR SHARE`;
      await this.activeActor(tx, userId);
      await this.access.requirePublishedPollAccess(tx, userId, pollId);
      await tx.pollLike.upsert({ where: { pollId_userId: { pollId, userId } }, create: { pollId, userId }, update: {} });
      return { pollId, isLiked: true, likeCount: await this.likeCount(tx, userId, pollId) };
    });
  }

  // Erişimi sonradan kapanan beğeni de kaldırılabilir; sayaç yalnız erişim sürüyorsa döner.
  unlike(userId: string, pollId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.pollLike.deleteMany({ where: { pollId, userId } });
      const visible = await tx.poll.count({ where: { id: pollId, ...this.access.visiblePublishedPollWhere(userId) } });
      return { pollId, isLiked: false, likeCount: visible ? await this.likeCount(tx, userId, pollId) : 0 };
    });
  }

  // ── Başkasının görünür paylaşımları ───────────────────────────────────

  listUserPolls(viewerId: string, authorId: string, query: PageQueryDto) {
    const context = { list: "user-polls-v1", viewerId, authorId };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      await this.access.requireUserAccess(tx, viewerId, authorId);
      const now = await pollServerNow(tx);
      const rows = await tx.poll.findMany({
        where: { AND: [this.access.visiblePublishedPollWhere(viewerId), { authorId, publishedAt: { lte: now } },
          ...(cursor ? [{ OR: [
            { publishedAt: { lt: new Date(cursor.createdAt) } }, { publishedAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ] }] : [])] },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: query.limit + 1, include: pollCardInclude(this.access, viewerId),
      });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return { items: page.map((poll) => presentPollCard(poll, viewerId, now)), serverNow: now,
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.publishedAt!.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }

  // ── Yorumlar ──────────────────────────────────────────────────────────

  private async mayComment(tx: Tx, userId: string, poll: { id: string; authorId: string }) {
    if (poll.authorId === userId) return true;
    return await tx.pollVote.count({ where: { pollId: poll.id, voterId: userId } }) > 0;
  }

  listComments(userId: string, pollId: string, query: PageQueryDto) {
    const context = { list: "poll-comments-v1", pollId, viewerId: userId };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      const access = await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId }, select: { commentsEnabled: true } });
      const rows = await tx.comment.findMany({
        where: { pollId, contentStatus: "VISIBLE", author: this.access.activeUnblockedUserWhere(userId), ...(cursor ? { OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ] } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1,
        include: { author: { select: { id: true, username: true, displayName: true, avatarMediaId: true } } },
      });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return {
        items: page.map((row) => {
          const { avatarMediaId, ...author } = row.author;
          return { id: row.id, pollId, body: row.body, createdAt: row.createdAt,
            author: { ...author, avatarPath: avatarMediaId ? `/v1/media/${avatarMediaId}/content` : null },
            isMine: row.authorId === userId, canRemove: row.authorId === userId || access.authorId === userId };
        }),
        commentsEnabled: poll.commentsEnabled,
        canComment: poll.commentsEnabled && await this.mayComment(tx, userId, access),
        serverNow: await pollServerNow(tx),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }, context) : null,
      };
    }, { isolationLevel: "RepeatableRead" });
  }

  // Makbuz yorum metnini taşımaz: işlem tekrarı kaydı hassas içerik saklamaz.
  createComment(userId: string, pollId: string, body: string, key: unknown) {
    return this.idempotency.execute(userId, `polls.comment.create:${pollId}`, key, { body }, 201, async (tx) => {
      // Oy ile aynı kilit sırası: önce oylama, sonra kullanıcı. Yorum ayarı ve
      // sosyal değişiklikler bu kilitleri beklerken güncel durum tekrar okunur.
      await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${pollId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      await this.activeActor(tx, userId);
      const access = await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId }, select: { commentsEnabled: true } });
      if (!poll.commentsEnabled) throw new ApiError(409, "COMMENTS_DISABLED", "Bu paylaşım yeni yorum kabul etmiyor.");
      if (!await this.mayComment(tx, userId, access)) throw new ApiError(403, "COMMENT_REQUIRES_VOTE", "Yorum yazmak için önce tercihini yap.");
      const now = await pollServerNow(tx);
      const recent = await tx.comment.count({ where: { pollId, authorId: userId, createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
      if (recent >= COMMENTS_PER_POLL_PER_DAY) throw new ApiError(429, "COMMENT_RATE_LIMITED", "Bu paylaşıma bugün çok fazla yorum yazdın.");
      const row = await tx.comment.create({ data: { pollId, authorId: userId, body, createdAt: now } });
      await tx.outboxEvent.create({ data: { aggregateType: "comment", aggregateId: row.id, aggregateVersion: 1, type: "poll.comment.created",
        payload: { schemaVersion: 1, commentId: row.id, pollId, pollAuthorId: access.authorId, authorId: userId, createdAt: now.toISOString() } } });
      return { id: row.id, pollId, createdAt: row.createdAt };
    });
  }

  removeComment(userId: string, commentId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Comment" WHERE "id" = ${commentId}::uuid FOR UPDATE`;
      await this.activeActor(tx, userId);
      const row = await tx.comment.findUnique({ where: { id: commentId }, include: { poll: { select: { authorId: true } } } });
      const byPollOwner = row?.poll.authorId === userId;
      // Yazan veya paylaşım sahibi dışındakilere yorumun varlığı açıklanmaz.
      if (!row || (row.authorId !== userId && !byPollOwner)) throw commentMissing();
      if (row.contentStatus === "REMOVED") return { id: commentId, removed: true as const };
      const now = await pollServerNow(tx);
      await tx.comment.update({ where: { id: commentId }, data: { contentStatus: "REMOVED", removedAt: now, removedById: userId } });
      await tx.outboxEvent.create({ data: { aggregateType: "comment", aggregateId: commentId, aggregateVersion: 2, type: "poll.comment.removed",
        payload: { schemaVersion: 1, commentId, pollId: row.pollId, removedById: userId, byPollOwner: byPollOwner && row.authorId !== userId } } });
      return { id: commentId, removed: true as const };
    });
  }

  // ── Oy sonrası hazır neden ────────────────────────────────────────────

  setReason(userId: string, pollId: string, reason: PollReasonCode) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${pollId}::uuid FOR SHARE`;
      await this.activeActor(tx, userId);
      await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const vote = await tx.pollVote.findUnique({ where: { pollId_voterId: { pollId, voterId: userId } }, select: { optionId: true } });
      if (!vote) throw new ApiError(409, "VOTE_REQUIRED", "Neden seçmek için önce tercihini yap.");
      const row = await tx.pollVoteReason.upsert({ where: { pollId_voterId: { pollId, voterId: userId } },
        create: { pollId, voterId: userId, reason }, update: { reason } });
      return { pollId, optionId: vote.optionId, reason: row.reason, updatedAt: row.updatedAt };
    });
  }

  async clearReason(userId: string, pollId: string) {
    const vote = await this.prisma.pollVote.findUnique({ where: { pollId_voterId: { pollId, voterId: userId } }, select: { optionId: true } });
    await this.prisma.pollVoteReason.deleteMany({ where: { pollId, voterId: userId } });
    return { pollId, optionId: vote?.optionId ?? null, reason: null, updatedAt: null };
  }

  // Sonuçla aynı görünürlük: yazar, oy veren veya kapanıştan sonra erişebilen.
  reasons(userId: string, pollId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId } });
      const mine = await tx.pollVote.findUnique({ where: { pollId_voterId: { pollId, voterId: userId } }, include: { reason: true } });
      if (poll.authorId !== userId && !mine && effectivePollStatus(poll, await pollServerNow(tx)) !== "CLOSED") {
        throw new ApiError(403, "RESULTS_NOT_AVAILABLE", "Nedenleri oy verdikten sonra veya oylama bitince görebilirsin.");
      }
      const options = await tx.pollOption.findMany({ where: { pollId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
      const groups = await tx.$queryRaw<{ optionId: string; reason: PollReasonCode; count: number }[]>`
        SELECT v."optionId", r."reason"::text AS "reason", COUNT(*)::int AS "count"
        FROM "PollVoteReason" r JOIN "PollVote" v ON v."pollId" = r."pollId" AND v."voterId" = r."voterId"
        WHERE r."pollId" = ${pollId}::uuid GROUP BY v."optionId", r."reason"`;
      const counts = new Map(groups.map((group) => [`${group.optionId}:${group.reason}`, group.count]));
      return { pollId, myReason: mine?.reason?.reason ?? null, options: options.map((option) => ({
        id: option.id, position: option.position, label: String.fromCharCode(64 + option.position),
        reasons: Object.values(PollReasonCode).map((code) => ({ code, count: counts.get(`${option.id}:${code}`) ?? 0 })),
      })) };
    }, { isolationLevel: "RepeatableRead" });
  }
}
