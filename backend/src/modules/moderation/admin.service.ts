import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { decodeCursor, encodeCursor, type CursorPosition } from "../../common/pagination/cursor.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { AdminResourceType, ModerationAction, Prisma } from "../../generated/prisma/client.js";
import { AdminAccessService } from "../auth/admin-access.service.js";
import { GameLifecycleService } from "../games/game-lifecycle.service.js";
import { gameNow } from "../games/game-internals.js";
import { MediaService } from "../media/media.service.js";
import { writePollEvent } from "../polls/polls-internals.js";
import { ReviewDecision, type AdminAuditQueryDto, type AdminPollVisibilityDto, type AdminReportsQueryDto, type AdminUserStatusDto, type AdminVersionDto, type ReviewReportDto } from "./dto/admin.dto.js";

type Tx = Prisma.TransactionClient;
const missing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "İncelenecek kayıt bulunamadı.");
const conflict = (code: string, message: string) => new ApiError(409, code, message);
const seek = (cursor: CursorPosition | null) => cursor ? { OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }] } : {};
const userSummary = { id: true, username: true, displayName: true, status: true } as const;

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService, private readonly access: AdminAccessService, private readonly idempotency: IdempotencyService,
    private readonly games: GameLifecycleService, private readonly media: MediaService) {}

  async me(actorId: string) { await this.access.require(this.db, actorId); return { userId: actorId, role: "ADMIN" as const }; }

  private mutate<T>(actorId: string, scope: string, payload: unknown, key: unknown, work: (tx: Tx) => Promise<T>) {
    return this.access.require(this.db, actorId).then(() => this.idempotency.execute(actorId, scope, key, payload, 200, work));
  }

  private async audit(tx: Tx, actorId: string, action: ModerationAction, resourceType: AdminResourceType, resourceId: string, reason: string,
    before: Prisma.InputJsonObject, after: Prisma.InputJsonObject, reportId?: string) {
    const row = await tx.moderationAudit.create({ data: { actorId, action, resourceType, resourceId, reason, before, after, reportId, createdAt: await gameNow(tx) } });
    await tx.outboxEvent.create({ data: { aggregateType: "moderation-audit", aggregateId: row.id, aggregateVersion: 1, type: "moderation.action.applied",
      payload: { schemaVersion: 1, auditId: row.id, action, resourceType, resourceId } } });
    return { auditId: row.id, resourceType, resourceId, appliedAt: row.createdAt };
  }

  reports(actorId: string, query: AdminReportsQueryDto) {
    const context = { list: "admin-reports-v1", actorId, status: query.status, targetType: query.targetType ?? "ALL" };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.db.$transaction(async (tx) => {
      await this.access.require(tx, actorId);
      const rows = await tx.report.findMany({ where: { status: query.status, ...(query.targetType ? { targetType: query.targetType } : {}), ...seek(cursor) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1,
        select: { id: true, targetType: true, pollId: true, commentId: true, targetUserId: true, status: true, reason: true, createdAt: true, version: true } });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return { items: page.map(({ pollId, commentId, targetUserId, ...row }) => ({ ...row, targetId: pollId ?? commentId ?? targetUserId })), serverNow: await gameNow(tx),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }

  report(actorId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.access.require(tx, actorId);
      const row = await tx.report.findUnique({ where: { id }, include: { reporter: { select: userSummary }, reviewedBy: { select: userSummary },
        poll: { select: { id: true, authorId: true, question: true, contentStatus: true, visibility: true, status: true, version: true,
          options: { orderBy: { position: "asc" }, select: { position: true, mediaId: true } } } },
        comment: { select: { id: true, pollId: true, authorId: true, body: true, contentStatus: true, removedAt: true } },
        targetUser: { select: userSummary },
      } });
      if (!row) throw missing();
      const { poll, comment, targetUser, pollId, commentId, targetUserId, reporterId, reviewedById, ...rest } = row;
      const previewPath = (mediaId: string) => `/v1/admin/reports/${id}/media/${mediaId}/content`;
      return { ...rest, targetId: pollId ?? commentId ?? targetUserId,
        target: poll ? { ...poll, options: poll.options.map((option) => ({ ...option, previewPath: previewPath(option.mediaId) })) } : comment ?? targetUser };
    }, { isolationLevel: "RepeatableRead" });
  }

  async preview(actorId: string, reportId: string, mediaId: string, variant: "display" | "thumbnail") {
    await this.db.$transaction(async (tx) => {
      await this.access.require(tx, actorId);
      const row = await tx.report.findUnique({ where: { id: reportId }, select: { pollId: true, comment: { select: { pollId: true } }, targetUser: { select: { avatarMediaId: true } } } });
      if (!row) throw missing();
      const pollId = row.pollId ?? row.comment?.pollId;
      const allowed = pollId ? await tx.pollOption.count({ where: { pollId, mediaId } }) > 0 : row.targetUser?.avatarMediaId === mediaId;
      if (!allowed) throw missing();
    });
    return this.media.readModerationPreview(mediaId, variant);
  }

  private async pollState(tx: Tx, actorId: string, id: string, contentStatus: "VISIBLE" | "HIDDEN", expectedVersion?: number) {
    await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${id}::uuid FOR UPDATE`;
    await this.access.lockActors(tx, actorId);
    const row = await tx.poll.findUnique({ where: { id } }); if (!row) throw missing();
    if (expectedVersion !== undefined && row.version !== expectedVersion) throw conflict("VERSION_CONFLICT", "Paylaşım değişmiş; tekrar oku.");
    if (row.contentStatus === "REMOVED") throw conflict("CONTENT_REMOVED", "Silinmiş paylaşım geri açılamaz veya değiştirilemez.");
    const before = { contentStatus: row.contentStatus, version: row.version };
    if (row.contentStatus === contentStatus) return { before, after: before };
    const saved = await tx.poll.update({ where: { id }, data: { contentStatus, version: { increment: 1 } } });
    await writePollEvent(tx, saved, "poll.moderation.changed", { contentStatus });
    return { before, after: { contentStatus: saved.contentStatus, version: saved.version } };
  }

  private async removeComment(tx: Tx, actorId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Comment" WHERE "id" = ${id}::uuid FOR UPDATE`;
    await this.access.lockActors(tx, actorId);
    const row = await tx.comment.findUnique({ where: { id } }); if (!row) throw missing();
    const before = { contentStatus: row.contentStatus };
    if (row.contentStatus !== "REMOVED") {
      await tx.comment.update({ where: { id }, data: { contentStatus: "REMOVED", removedAt: await gameNow(tx), removedById: actorId } });
      await tx.outboxEvent.create({ data: { aggregateType: "comment", aggregateId: id, aggregateVersion: 2, type: "poll.comment.removed",
        payload: { schemaVersion: 1, commentId: id, pollId: row.pollId, removedById: actorId, byModerator: true } } });
    }
    return { before, after: { contentStatus: "REMOVED" } };
  }

  private async userState(tx: Tx, actorId: string, id: string, status: "ACTIVE" | "SUSPENDED") {
    await this.access.lockActors(tx, actorId, id);
    const row = await tx.user.findUnique({ where: { id } }); if (!row) throw missing();
    if (id === actorId || row.role === "ADMIN") throw conflict("PROTECTED_ADMIN", "Yönetici hesaplarına bu uçtan yaptırım uygulanamaz.");
    if (row.status === "DELETED") throw conflict("ACCOUNT_DELETED", "Silinmiş hesap geri açılamaz.");
    const before = { status: row.status };
    if (status === "SUSPENDED") {
      await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: await gameNow(tx) } });
      await tx.deviceToken.deleteMany({ where: { userId: id } });
    }
    if (row.status !== status) {
      // user.status.changed trendler gibi sonraki tüketiciler için çıkarma/
      // geri hesaplama kaynağıdır; eski tercihler burada keyfî silinmez.
      const saved = await tx.user.update({ where: { id }, data: { status, socialRevision: { increment: 1 } } });
      await tx.outboxEvent.create({ data: { aggregateType: "user-status", aggregateId: id, aggregateVersion: saved.socialRevision, type: "user.status.changed",
        payload: { schemaVersion: 1, userId: id, status, revision: saved.socialRevision } } });
    }
    return { before, after: { status } };
  }

  review(actorId: string, id: string, dto: ReviewReportDto, key: unknown) {
    return this.mutate(actorId, `admin.report.review:${id}`, dto, key, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Report" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const report = await tx.report.findUnique({ where: { id } }); if (!report) throw missing();
      if (report.version !== dto.expectedVersion) throw conflict("VERSION_CONFLICT", "Şikâyet değişmiş; tekrar oku.");
      if (report.status !== "OPEN") throw conflict("REPORT_ALREADY_REVIEWED", "Şikâyet zaten incelenmiş.");
      let change: { before: Prisma.InputJsonObject; after: Prisma.InputJsonObject } | undefined;
      if (dto.decision === ReviewDecision.HIDE_POLL && report.pollId) change = await this.pollState(tx, actorId, report.pollId, "HIDDEN");
      else if (dto.decision === ReviewDecision.REMOVE_COMMENT && report.commentId) change = await this.removeComment(tx, actorId, report.commentId);
      else if (dto.decision === ReviewDecision.SUSPEND_USER && report.targetUserId) change = await this.userState(tx, actorId, report.targetUserId, "SUSPENDED");
      else if (![ReviewDecision.DISMISS, ReviewDecision.NO_ACTION].includes(dto.decision)) throw new ApiError(400, "REPORT_ACTION_MISMATCH", "Bu karar şikâyetin hedef türüne uygun değil.");
      else await this.access.lockActors(tx, actorId);
      const status = dto.decision === ReviewDecision.DISMISS ? "DISMISSED" : "RESOLVED";
      const saved = await tx.report.update({ where: { id }, data: { status, version: { increment: 1 }, reviewedById: actorId, reviewedAt: await gameNow(tx), decisionNote: dto.reason } });
      const receipt = await this.audit(tx, actorId, status === "DISMISSED" ? "REPORT_DISMISSED" : "REPORT_RESOLVED", "REPORT", id, dto.reason,
        { status: report.status, version: report.version, ...(change ? { target: change.before } : {}) },
        { status: saved.status, version: saved.version, decision: dto.decision, targetId: report.pollId ?? report.commentId ?? report.targetUserId, ...(change ? { target: change.after } : {}) }, id);
      return { ...receipt, status: saved.status, version: saved.version };
    });
  }

  visibility(actorId: string, id: string, dto: AdminPollVisibilityDto, key: unknown) {
    return this.mutate(actorId, `admin.poll.visibility:${id}`, dto, key, async (tx) => {
      const change = await this.pollState(tx, actorId, id, dto.contentStatus, dto.expectedVersion);
      return this.audit(tx, actorId, dto.contentStatus === "HIDDEN" ? "POLL_HIDDEN" : "POLL_RESTORED", "POLL", id, dto.reason, change.before, change.after);
    });
  }
  comment(actorId: string, id: string, reason: string, key: unknown) {
    return this.mutate(actorId, `admin.comment.remove:${id}`, { reason }, key, async (tx) => {
      const change = await this.removeComment(tx, actorId, id); return this.audit(tx, actorId, "COMMENT_REMOVED", "COMMENT", id, reason, change.before, change.after);
    });
  }
  status(actorId: string, id: string, dto: AdminUserStatusDto, key: unknown) {
    return this.mutate(actorId, `admin.user.status:${id}`, dto, key, async (tx) => {
      const change = await this.userState(tx, actorId, id, dto.status);
      return this.audit(tx, actorId, dto.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_RESTORED", "USER", id, dto.reason, change.before, change.after);
    });
  }
  cancelGame(actorId: string, id: string, dto: AdminVersionDto, key: unknown) {
    return this.mutate(actorId, `admin.game.cancel:${id}`, dto, key, async (tx) => {
      const locked = await this.games.lock(tx, id);
      const row = await this.games.advance(tx, locked, await gameNow(tx));
      await this.access.lockActors(tx, actorId);
      if (row.version !== dto.expectedVersion) throw conflict("VERSION_CONFLICT", "Oyun değişmiş; tekrar oku.");
      if (["COMPLETED", "CANCELLED"].includes(row.phase)) throw conflict("GAME_FINISHED", "Bitmiş oyun yeniden iptal edilemez.");
      const saved = await this.games.cancel(tx, row, "MODERATION", await gameNow(tx));
      return this.audit(tx, actorId, "GAME_CANCELLED", "GAME", id, dto.reason, { phase: row.phase, version: row.version }, { phase: saved.phase, version: saved.version });
    });
  }
  audits(actorId: string, query: AdminAuditQueryDto) {
    const context = { list: "moderation-audit-v1", actorId, resourceType: query.resourceType ?? "ALL", resourceId: query.resourceId ?? "ALL" };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.db.$transaction(async (tx) => {
      await this.access.require(tx, actorId);
      const rows = await tx.moderationAudit.findMany({ where: { ...(query.resourceType ? { resourceType: query.resourceType } : {}), ...(query.resourceId ? { resourceId: query.resourceId } : {}), ...seek(cursor) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1 });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return { items: page, serverNow: await gameNow(tx), nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }
}
