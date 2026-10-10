import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma, Report } from "../../generated/prisma/client.js";
import { SocialAccessService } from "../social/social-access.service.js";
import type { CreateReportDto } from "./dto/reports.dto.js";

type Tx = Prisma.TransactionClient;

const REPORTS_PER_DAY = 50;
const targetMissing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Şikâyet edilecek içerik bulunamadı.");
const ownContent = () => new ApiError(400, "SELF_REPORT_NOT_ALLOWED", "Kendi içeriğini veya hesabını şikâyet edemezsin.");

// Kullanıcının şikâyet kaydı içeriği kendiliğinden gizlemez.
// İnceleme ve yaptırım ayrı, yönetici yetkili AdminService üzerinden yapılır.
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService) {}

  // Şikâyet eden yalnız görebildiği içeriği bildirir; hedef sütunu döner.
  private async target(tx: Tx, userId: string, dto: CreateReportDto) {
    if (dto.targetType === "POLL") {
      const poll = await this.access.requirePublishedPollAccess(tx, userId, dto.targetId).catch(() => { throw targetMissing(); });
      if (poll.authorId === userId) throw ownContent();
      return { pollId: poll.id };
    }
    if (dto.targetType === "COMMENT") {
      const comment = await tx.comment.findFirst({ where: { id: dto.targetId, contentStatus: "VISIBLE",
        author: this.access.activeUnblockedUserWhere(userId), poll: this.access.visiblePublishedPollWhere(userId) }, select: { id: true, authorId: true } });
      if (!comment) throw targetMissing();
      if (comment.authorId === userId) throw ownContent();
      return { commentId: comment.id };
    }
    if (dto.targetId === userId) throw ownContent();
    // Engellediğin kişiyi de şikâyet edebilirsin; seni engelleyen kişi sana görünmez.
    const user = await tx.user.findFirst({ where: { id: dto.targetId, status: "ACTIVE", blocksMade: { none: { blockedId: userId } } }, select: { id: true } });
    if (!user) throw targetMissing();
    return { targetUserId: user.id };
  }

  private receipt(row: Report) {
    return { id: row.id, targetType: row.targetType, targetId: (row.pollId ?? row.commentId ?? row.targetUserId)!,
      reason: row.reason, status: row.status, createdAt: row.createdAt };
  }

  create(userId: string, dto: CreateReportDto) {
    return this.prisma.$transaction(async (tx) => {
      // Aynı kullanıcının eşzamanlı şikâyetleri sıraya girer; tekillik ve kota birlikte okunur.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      if (!await tx.user.count({ where: { id: userId, status: "ACTIVE" } })) throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
      const target = await this.target(tx, userId, dto);
      // Aynı hedef için ikinci şikâyet yeni kayıt açmaz; ilk kayıt döner.
      const existing = await tx.report.findFirst({ where: { reporterId: userId, ...target } });
      if (existing) return this.receipt(existing);
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      const recent = await tx.report.count({ where: { reporterId: userId, createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
      if (recent >= REPORTS_PER_DAY) throw new ApiError(429, "REPORT_RATE_LIMITED", "Bugün çok fazla şikâyet gönderdin.");
      const row = await tx.report.create({ data: { reporterId: userId, targetType: dto.targetType, reason: dto.reason, note: dto.note ?? null, createdAt: now, ...target } });
      // Olay açıklama metnini taşımaz.
      await tx.outboxEvent.create({ data: { aggregateType: "report", aggregateId: row.id, aggregateVersion: 1, type: "report.created",
        payload: { schemaVersion: 1, reportId: row.id, targetType: row.targetType, reason: row.reason, createdAt: now.toISOString() } } });
      return this.receipt(row);
    });
  }
}
