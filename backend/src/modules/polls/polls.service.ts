import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Poll, Prisma } from "../../generated/prisma/client.js";
import { MediaService } from "../media/media.service.js";
import { SocialAccessService } from "../social/social-access.service.js";
import type { CreatePollDto, MyPollsQueryDto, PollOptionInputDto, UpdateCommentSettingsDto, UpdatePollDto } from "./dto/polls.dto.js";
import { pollServerNow as serverNow, effectivePollStatus as effectiveStatus, writePollEvent } from "./polls-internals.js";
import { pollDetailInclude, presentPoll } from "./poll-read-model.js";

type Tx = Prisma.TransactionClient;
const missing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Oylama bulunamadı.");

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService, private readonly media: MediaService,
    private readonly access: SocialAccessService, private readonly idempotency: IdempotencyService) {}

  private async activeActor(tx: Tx, userId: string) {
    if (!await tx.user.count({ where: { id: userId, status: "ACTIVE" } })) throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
  }

  private async owned(tx: Tx, userId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${id}::uuid FOR UPDATE`;
    await this.activeActor(tx, userId);
    const poll = await tx.poll.findFirst({ where: { id, authorId: userId } });
    if (!poll) throw missing();
    return poll;
  }

  private version(poll: Poll, expected: number) {
    if (poll.version !== expected) throw new ApiError(409, "VERSION_CONFLICT", "Oylama değişmiş; güncel sürümü alıp tekrar dene.");
  }

  private editable(poll: Poll) {
    if (poll.status !== "DRAFT") throw new ApiError(409, "POLL_NOT_DRAFT", "Yalnızca taslak düzenlenebilir veya silinebilir.");
    if (poll.contentStatus !== "VISIBLE") throw new ApiError(409, "POLL_UNAVAILABLE", "Bu içerik düzenlenemez veya yayınlanamaz.");
  }

  private async event(tx: Tx, poll: Pick<Poll, "id" | "authorId" | "version" | "status" | "visibility">, type: string) {
    await writePollEvent(tx, poll, type);
  }

  private async detail(tx: Tx, viewerId: string, id: string, now?: Date) {
    const poll = await tx.poll.findUnique({ where: { id }, include: pollDetailInclude });
    if (!poll) throw missing();
    await this.access.requireUserAccess(tx, viewerId, poll.authorId);
    if (viewerId !== poll.authorId) await this.access.requirePublishedPollAccess(tx, viewerId, id);
    const currentTime = now ?? await serverNow(tx);
    const mine = await tx.pollVote.findUnique({ where: { pollId_voterId: { pollId: id, voterId: viewerId } }, select: { optionId: true } });
    return presentPoll(poll, viewerId, currentTime, mine?.optionId ?? null);
  }

  private async replaceOptions(tx: Tx, userId: string, pollId: string, options: PollOptionInputDto[]) {
    // Aynı kilit sırası medya cleanup/silme ve çoklu paylaşım için korunur.
    for (const mediaId of options.map((option) => option.mediaId).sort()) await this.media.requireAttachableAsset(tx, userId, mediaId);
    await tx.productTag.deleteMany({ where: { option: { pollId } } });
    await tx.pollOption.deleteMany({ where: { pollId } });
    const now = await serverNow(tx);
    for (const option of [...options].sort((a, b) => a.position - b.position)) {
      await tx.pollOption.create({ data: {
        pollId, position: option.position, mediaId: option.mediaId,
        products: { create: (option.products ?? []).map((product) => ({
          title: product.title, brand: product.brand ?? null, priceMinor: product.priceMinor ?? null,
          currency: product.currency ?? "TRY", externalUrl: product.externalUrl,
          priceRecordedAt: product.priceMinor != null ? now : null,
        })) },
      } });
    }
  }

  create(userId: string, dto: CreatePollDto, key: unknown) {
    return this.idempotency.execute(userId, "polls.create", key, dto, 201, async (tx) => {
      await this.activeActor(tx, userId);
      const quotaLock = `poll-create-quota:${userId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${quotaLock}, 0))::text`;
      const now = await serverNow(tx);
      const daily = await tx.idempotencyRecord.count({ where: { userId, scope: "polls.create", expiresAt: { gt: now } } });
      const drafts = await tx.poll.count({ where: { authorId: userId, status: "DRAFT" } });
      if (daily >= 100 || drafts >= 50) throw new ApiError(429, "POLL_QUOTA_EXCEEDED", "Oylama oluşturma sınırına ulaştın; daha sonra tekrar dene.");
      const settings = await tx.userSettings.findUnique({ where: { userId } });
      const poll = await tx.poll.create({ data: {
        authorId: userId, question: dto.question ?? "", category: dto.category ?? "OUTFIT", occasion: dto.occasion ?? null,
        visibility: dto.visibility ?? settings?.defaultPollVisibility ?? "PUBLIC",
        commentsEnabled: dto.commentsEnabled ?? settings?.defaultCommentsEnabled ?? true, durationSeconds: dto.durationSeconds ?? 1800,
      } });
      if (dto.options) await this.replaceOptions(tx, userId, poll.id, dto.options);
      // Medya → kullanıcı sırası korunur. Silmeyle yarışan oluşturma ya önce
      // commit olur ve temizlik onu görür ya da aktif hesap kontrolünde durur.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      await this.activeActor(tx, userId);
      await this.event(tx, poll, "poll.draft.created");
      return this.detail(tx, userId, poll.id);
    });
  }

  update(userId: string, id: string, dto: UpdatePollDto, key: unknown) {
    return this.idempotency.execute(userId, `polls.update:${id}`, key, dto, 200, async (tx) => {
      await this.activeActor(tx, userId);
      const poll = await this.owned(tx, userId, id);
      this.editable(poll);
      this.version(poll, dto.expectedVersion);
      const { expectedVersion: _version, options, ...fields } = dto;
      if (!Object.values(fields).some((value) => value !== undefined) && options === undefined) throw new ApiError(400, "EMPTY_UPDATE", "En az bir taslak alanı gönder.");
      if (options !== undefined) await this.replaceOptions(tx, userId, id, options);
      const saved = await tx.poll.update({ where: { id }, data: { ...fields, version: { increment: 1 } } });
      await this.event(tx, saved, "poll.draft.updated");
      return this.detail(tx, userId, id);
    });
  }

  publish(userId: string, id: string, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `polls.publish:${id}`, key, { expectedVersion }, 200, async (tx) => {
      await this.activeActor(tx, userId);
      const poll = await this.owned(tx, userId, id);
      this.editable(poll);
      this.version(poll, expectedVersion);
      if (!poll.question.trim()) throw new ApiError(422, "QUESTION_REQUIRED", "Yayınlamak için sorunu yaz.");
      const options = await tx.pollOption.findMany({ where: { pollId: id }, orderBy: { position: "asc" } });
      if (options.length < 2 || options.length > 4) throw new ApiError(422, "INVALID_OPTION_COUNT", "Yayın için 2–4 seçenek gerekli.");
      if (new Set(options.map((option) => option.mediaId)).size !== options.length
        || options.some((option, index) => option.position !== index + 1)) throw new ApiError(422, "INVALID_OPTION_ORDER", "Seçenekler farklı fotoğraflarla 1'den başlayarak sıralanmalı.");
      for (const mediaId of options.map((option) => option.mediaId).sort()) await this.media.requirePublishableAsset(tx, userId, mediaId);
      if (poll.audienceGender !== "ANY" || poll.audienceAgeBand !== null || poll.styleMatchRequired) {
        throw new ApiError(400, "UNSUPPORTED_AUDIENCE", "Gelişmiş kitle filtreleri henüz açık değil.");
      }
      const now = await serverNow(tx);
      const saved = await tx.poll.update({ where: { id }, data: {
        status: "OPEN", publishedAt: now, closesAt: new Date(now.getTime() + poll.durationSeconds * 1000), version: { increment: 1 },
      } });
      await this.event(tx, saved, "poll.published");
      return this.detail(tx, userId, id, now);
    });
  }

  cancel(userId: string, id: string, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `polls.cancel:${id}`, key, { expectedVersion }, 200, async (tx) => {
      await this.activeActor(tx, userId);
      const poll = await this.owned(tx, userId, id);
      this.version(poll, expectedVersion);
      if (poll.status === "CANCELLED") return this.detail(tx, userId, id);
      const now = await serverNow(tx);
      if (effectiveStatus(poll, now) === "CLOSED") throw new ApiError(409, "POLL_EXPIRED", "Süresi dolmuş oylama iptal edilemez.");
      if (poll.status !== "DRAFT" && poll.status !== "OPEN") throw new ApiError(409, "POLL_NOT_CANCELLABLE", "Oylama bu durumda iptal edilemez.");
      const saved = await tx.poll.update({ where: { id }, data: { status: "CANCELLED", closedAt: now, version: { increment: 1 } } });
      await this.event(tx, saved, "poll.cancelled");
      return this.detail(tx, userId, id, now);
    });
  }

  deleteDraft(userId: string, id: string, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `polls.delete:${id}`, key, { expectedVersion }, 200, async (tx) => {
      await this.activeActor(tx, userId);
      const poll = await this.owned(tx, userId, id);
      this.editable(poll);
      this.version(poll, expectedVersion);
      await tx.productTag.deleteMany({ where: { option: { pollId: id } } });
      await tx.pollOption.deleteMany({ where: { pollId: id } });
      await this.event(tx, { ...poll, version: poll.version + 1 }, "poll.draft.deleted");
      await tx.poll.delete({ where: { id } });
      return { id, deleted: true as const };
    });
  }

  updateCommentSettings(userId: string, id: string, dto: UpdateCommentSettingsDto, key: unknown) {
    return this.idempotency.execute(userId, `polls.comments:${id}`, key, dto, 200, async (tx) => {
      await this.activeActor(tx, userId);
      const poll = await this.owned(tx, userId, id);
      this.version(poll, dto.expectedVersion);
      if (poll.contentStatus !== "VISIBLE" || !["OPEN", "CLOSED"].includes(poll.status)) throw new ApiError(409, "POLL_UNAVAILABLE", "Yorum ayarı yalnız görünür yayınlarda değiştirilebilir.");
      if (poll.commentsEnabled === dto.commentsEnabled) return this.detail(tx, userId, id);
      const saved = await tx.poll.update({ where: { id }, data: { commentsEnabled: dto.commentsEnabled, version: { increment: 1 } } });
      await this.event(tx, saved, "poll.comment-settings.changed");
      return this.detail(tx, userId, id);
    });
  }

  get(viewerId: string, id: string) {
    return this.prisma.$transaction((tx) => this.detail(tx, viewerId, id), { isolationLevel: "RepeatableRead" });
  }

  listMine(userId: string, query: MyPollsQueryDto) {
    const context = { list: "my-polls-v1", userId, status: query.status ?? "ALL" };
    const cursor = query.cursor ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      const now = await serverNow(tx);
      let status: Prisma.PollWhereInput = {};
      if (query.status === "OPEN") status = { status: "OPEN", closesAt: { gt: now } };
      else if (query.status === "CLOSED") status = { OR: [{ status: "CLOSED" }, { status: "OPEN", closesAt: { lte: now } }] };
      else if (query.status) status = { status: query.status };
      const rows = await tx.poll.findMany({ where: { authorId: userId, AND: [status, ...(cursor ? [{ OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ] }] : [])] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1,
      include: { _count: { select: { options: true } }, options: { orderBy: { position: "asc" }, take: 1, select: {
        mediaId: true, media: { select: { status: true, thumbnailKey: true } },
      } } } });
      const items = rows.slice(0, query.limit).map((poll) => ({
        id: poll.id, question: poll.question, category: poll.category, visibility: poll.visibility, status: poll.status,
        effectiveStatus: effectiveStatus(poll, now), contentStatus: poll.contentStatus, version: poll.version,
        createdAt: poll.createdAt, updatedAt: poll.updatedAt, publishedAt: poll.publishedAt, closesAt: poll.closesAt,
        optionCount: poll._count.options, thumbnailPath: poll.options[0]?.media.status === "READY" && poll.options[0].media.thumbnailKey
          ? `/v1/media/${poll.options[0].mediaId}/content?variant=thumbnail` : null,
      }));
      const last = items.at(-1);
      return { items, serverNow: now, nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }
}
