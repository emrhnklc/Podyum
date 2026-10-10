import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma, UserPrivate } from "../../generated/prisma/client.js";
import type { UpdatePrivateProfileDto, UpdateProfileDto, UpdateSettingsDto } from "./dto/users.dto.js";
import { SocialAccessService } from "../social/social-access.service.js";

type Transaction = Prisma.TransactionClient;
const missing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Kullanıcı bulunamadı.");
const settingsDefaults = {
  pushEnabled: true,
  friendRequestNotifications: true,
  pollResultNotifications: true,
  commentNotifications: true,
  defaultPollVisibility: "PUBLIC" as const,
  defaultCommentsEnabled: true,
  defaultBlurFace: true,
};
const profileSelect = {
  id: true, username: true, displayName: true, bio: true, createdAt: true, updatedAt: true,
  profileCompletedAt: true,
  styles: { select: { style: { select: { id: true, label: true } } }, orderBy: { styleId: "asc" as const } },
} satisfies Prisma.UserSelect;

function requireChanges(dto: object) {
  if (!Object.values(dto).some((value) => value !== undefined)) {
    throw new ApiError(400, "EMPTY_UPDATE", "En az bir alan gönder.");
  }
}

function privateResponse(row: UserPrivate | null) {
  return {
    gender: row?.gender ?? null,
    ageBand: row?.ageBand ?? null,
    cityCode: row?.cityCode ?? null,
    analyticsConsent: row?.analyticsConsentAt != null,
    analyticsConsentAt: row?.analyticsConsentAt ?? null,
    analyticsRevision: row?.analyticsRevision ?? 0,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService) {}

  private async lockActiveUser(tx: Transaction, userId: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status === "SUSPENDED") throw new ApiError(403, "ACCOUNT_SUSPENDED", "Hesap askıya alınmış.");
    if (user?.status !== "ACTIVE") throw new ApiError(401, "INVALID_SESSION", "Oturum geçersiz veya süresi dolmuş.");
  }

  async usernameAvailability(userId: string, username: string) {
    const existing = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    return { username, available: !existing || existing.id === userId };
  }

  styleTags() {
    return this.prisma.styleTag.findMany({ select: { id: true, label: true }, orderBy: { id: "asc" } });
  }

  private async profile(tx: Transaction, viewerId: string, targetId: string) {
    await this.access.requireUserAccess(tx, viewerId, targetId);
    const user = await tx.user.findUnique({ where: { id: targetId, status: "ACTIVE" }, select: profileSelect });
    if (!user) throw missing();
    const polls = await tx.poll.count({ where: {
      ...this.access.visiblePublishedPollWhere(viewerId), authorId: targetId,
    } });
    const activeUnblockedFriend = this.access.activeUnblockedUserWhere(targetId);
    const friends = await tx.friendship.count({ where: { status: "ACCEPTED", OR: [
      { userAId: targetId, userB: activeUnblockedFriend },
      { userBId: targetId, userA: activeUnblockedFriend },
    ] } });
    const ledger = await tx.pointsLedger.aggregate({ where: { userId: targetId }, _sum: { delta: true } });
    const { profileCompletedAt, styles, ...publicFields } = user;
    return {
      profile: { ...publicFields, styles: styles.map(({ style }) => style), counts: { polls, friends, stars: ledger._sum.delta ?? 0 } },
      profileSetupRequired: profileCompletedAt === null,
    };
  }

  me(userId: string) {
    return this.prisma.$transaction((tx) => this.profile(tx, userId, userId), { isolationLevel: "RepeatableRead" });
  }

  publicProfile(viewerId: string, targetId: string) {
    return this.prisma.$transaction(async (tx) => (await this.profile(tx, viewerId, targetId)).profile, { isolationLevel: "RepeatableRead" });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    requireChanges(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockActiveUser(tx, userId);
        if (dto.styleIds !== undefined) {
          const found = await tx.styleTag.count({ where: { id: { in: dto.styleIds } } });
          if (found !== dto.styleIds.length) throw new ApiError(400, "UNKNOWN_STYLE_TAG", "Stil sözlüğündeki etiketleri seç.");
        }
        const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { profileCompletedAt: true } });
        await tx.user.update({ where: { id: userId }, data: {
          username: dto.username,
          displayName: dto.displayName,
          bio: dto.bio === undefined ? undefined : dto.bio || null,
          ...(!current.profileCompletedAt && dto.username !== undefined && dto.displayName !== undefined ? { profileCompletedAt: new Date() } : {}),
        } });
        if (dto.styleIds !== undefined) {
          await tx.userStyle.deleteMany({ where: { userId } });
          if (dto.styleIds.length) await tx.userStyle.createMany({ data: dto.styleIds.map((styleId) => ({ userId, styleId })) });
        }
        return this.profile(tx, userId, userId);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ApiError(409, "USERNAME_UNAVAILABLE", "Bu kullanıcı adı kullanılamıyor.");
      throw error;
    }
  }

  async privateProfile(userId: string) {
    return privateResponse(await this.prisma.userPrivate.findUnique({ where: { userId } }));
  }

  async updatePrivateProfile(userId: string, dto: UpdatePrivateProfileDto) {
    requireChanges(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.lockActiveUser(tx, userId);
      const current = await tx.userPrivate.findUnique({ where: { userId } });
      const before = privateResponse(current);
      const consent = dto.analyticsConsent ?? before.analyticsConsent;
      const consentChanged = consent !== before.analyticsConsent;
      const demographicsChanged = (dto.gender !== undefined && dto.gender !== before.gender)
        || (dto.ageBand !== undefined && dto.ageBand !== before.ageBand)
        || (dto.cityCode !== undefined && dto.cityCode !== before.cityCode);
      if (!consentChanged && !demographicsChanged) return before;
      const now = new Date();
      const data = {
        gender: dto.gender, ageBand: dto.ageBand, cityCode: dto.cityCode,
        analyticsConsentAt: consentChanged ? (consent ? now : null) : before.analyticsConsentAt,
        analyticsRevision: before.analyticsRevision + 1,
      };
      const saved = await tx.userPrivate.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      // Gelecekteki trend tüketicisi için kalıcı kaynak; ham demografi olayda taşınmaz.
      await tx.outboxEvent.create({ data: {
        aggregateType: "user-analytics", aggregateId: userId, aggregateVersion: saved.analyticsRevision,
        type: "user.analytics-preferences.changed",
        payload: { schemaVersion: 1, userId, revision: saved.analyticsRevision, analyticsConsent: consent, consentChanged, demographicsChanged, changedAt: now.toISOString() },
      } });
      return privateResponse(saved);
    });
  }

  async settings(userId: string) {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!row) return { ...settingsDefaults };
    const { userId: _userId, ...settings } = row;
    return settings;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    requireChanges(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.lockActiveUser(tx, userId);
      const row = await tx.userSettings.upsert({ where: { userId }, create: { userId, ...dto }, update: dto });
      const { userId: _userId, ...settings } = row;
      return settings;
    });
  }
}
