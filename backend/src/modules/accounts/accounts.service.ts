import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { PrismaService } from "../../database/prisma.service.js";
import { AdminAccessService } from "../auth/admin-access.service.js";
import { PollParticipationService } from "../polls/poll-participation.service.js";
import type { DeleteAccountDto } from "./dto/accounts.dto.js";

export const ACCOUNT_DELETE_RECENT_LOGIN_MS = 15 * 60_000;
const invalid = () => new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");

@Injectable()
export class AccountsService {
  constructor(private readonly db: PrismaService, private readonly analytics: PollParticipationService, private readonly admin: AdminAccessService) {}

  requestDeletion(actor: AuthenticatedUser, _dto: DeleteAccountDto) {
    return this.db.$transaction(async (tx) => {
      // Kaynak satırlarına burada gidilmez: poll/media/game → user kilit sırası
      // bozulmaz. İçerik temizliği ayrı kalıcı işte kendi kaynak kilitleriyle yapılır.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: actor.userId }, include: { privateData: true } });
      const session = await tx.authSession.findFirst({ where: { id: actor.sessionId, userId: actor.userId, revokedAt: null } });
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      if (!user || user.status !== "ACTIVE" || !session || session.accessExpiresAt <= now || session.expiresAt <= now) throw invalid();
      if (user.role === "ADMIN") throw new ApiError(409, "PROTECTED_ADMIN", "Yönetici hesabı silinmeden önce rolü güvenilen işlemle kaldırılmalı.");
      if (now.getTime() - session.createdAt.getTime() > ACCOUNT_DELETE_RECENT_LOGIN_MS) {
        throw new ApiError(403, "RECENT_LOGIN_REQUIRED", "Hesabını silmeden önce yeniden giriş yap; token yenileme yeterli değildir.");
      }
      const actions = await tx.authActionToken.findMany({ where: { userId: user.id }, select: { tokenHash: true } });
      const devices = await tx.deviceToken.findMany({ where: { userId: user.id }, select: { token: true } });
      const notifications = await tx.notification.findMany({ where: { userId: user.id }, select: { id: true } });
      const job = await tx.accountDeletion.create({ data: { userId: user.id, requestedAt: now,
        mailTokenHashes: actions.map((row) => row.tokenHash), pushTokenHashes: devices.map((row) => createHash("sha256").update(row.token).digest("hex")),
        notificationIds: notifications.map((row) => row.id) } });
      const saved = await tx.user.update({ where: { id: user.id }, data: { status: "DELETED", username: `deleted_${randomBytes(11).toString("hex")}`,
        displayName: "Silinmiş kullanıcı", bio: null, avatarMediaId: null, profileCompletedAt: null, socialRevision: { increment: 1 } } });
      await tx.deviceToken.deleteMany({ where: { userId: user.id } });
      await tx.usedRefreshToken.deleteMany({ where: { session: { userId: user.id } } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.authActionToken.deleteMany({ where: { userId: user.id } });
      await tx.authCredential.deleteMany({ where: { userId: user.id } });
      await tx.authIdentity.deleteMany({ where: { userId: user.id } });
      await this.analytics.clearAnalyticsSnapshots(tx, user.id);
      await tx.userPrivate.deleteMany({ where: { userId: user.id } });
      await tx.userSettings.deleteMany({ where: { userId: user.id } });
      await tx.userStyle.deleteMany({ where: { userId: user.id } });
      await tx.outboxEvent.createMany({ data: [
        { aggregateType: "user-status", aggregateId: user.id, aggregateVersion: saved.socialRevision, type: "user.status.changed",
          payload: { schemaVersion: 1, userId: user.id, status: "DELETED", revision: saved.socialRevision } },
        { aggregateType: "user-analytics", aggregateId: user.id, aggregateVersion: (user.privateData?.analyticsRevision ?? 0) + 1, type: "user.analytics-preferences.changed",
          payload: { schemaVersion: 1, userId: user.id, revision: (user.privateData?.analyticsRevision ?? 0) + 1, analyticsConsent: false, consentChanged: user.privateData?.analyticsConsentAt != null, demographicsChanged: true, changedAt: now.toISOString() } },
        { aggregateType: "account-deletion", aggregateId: job.id, aggregateVersion: 1, type: "account.deletion.requested",
          payload: { schemaVersion: 1, deletionId: job.id, userId: user.id } },
      ] });
      return { deletionId: job.id, status: "ACCEPTED" as const, requestedAt: job.requestedAt };
    }, { timeout: 30_000 });
  }

  async status(actorId: string, userId: string) {
    await this.admin.require(this.db, actorId);
    const row = await this.db.accountDeletion.findUnique({ where: { userId }, select: { id: true, userId: true, requestedAt: true, completedAt: true } });
    if (!row) throw new ApiError(404, "RESOURCE_NOT_FOUND", "Silme işi bulunamadı.");
    return { deletionId: row.id, userId, requestedAt: row.requestedAt, completedAt: row.completedAt, status: row.completedAt ? "COMPLETED" : "PENDING",
      pendingMedia: await this.db.mediaAsset.count({ where: { ownerId: userId, filesPurgedAt: null } }) };
  }
}
