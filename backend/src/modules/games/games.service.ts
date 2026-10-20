import { Injectable } from "@nestjs/common";
import { randomBytes, randomInt } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { GameSession, Prisma } from "../../generated/prisma/client.js";
import { MediaService } from "../media/media.service.js";
import type { CreateGameDto, GamePageDto } from "./dto/games.dto.js";
import { GameAccessService, gameMissing } from "./game-access.service.js";
import { decodeGameCursor, encodeGameCursor } from "./game-cursor.js";
import { checkGameVersion, gameConflict, gameEvent, gameNow, gameTokenHash, lockGameUsers, type GameTx } from "./game-internals.js";
import { GameLifecycleService, TURN_SECONDS } from "./game-lifecycle.service.js";
import { leagueFor } from "./league.js";

export function gameSummary(session: GameSession, now: Date) {
  const phaseEndsAt = session.phase === "SCHEDULED" ? session.startsAt : session.phase === "WAITING" ? session.startsAt ?? session.waitingExpiresAt
    : session.phase === "SUBMISSION" ? session.submissionEndsAt : session.phase === "VOTING" ? session.votingEndsAt : null;
  return {
    id: session.id, kind: session.kind, phase: session.phase, themeTitle: session.themeTitle, rulesVersion: session.rulesVersion,
    version: session.version, hostId: session.hostId, maxMembers: session.maxMembers, isPublic: session.isPublic,
    submissionSeconds: session.submissionSeconds, votingSeconds: session.votingSeconds,
    startsAt: session.startsAt, submissionEndsAt: session.submissionEndsAt, votingStartsAt: session.votingStartsAt,
    votingEndsAt: session.votingEndsAt, waitingExpiresAt: session.waitingExpiresAt, finishedAt: session.finishedAt,
    cancelReason: session.cancelReason, phaseEndsAt, serverNow: now,
    remainingSeconds: phaseEndsAt ? Math.max(0, Math.ceil((phaseEndsAt.getTime() - now.getTime()) / 1000)) : 0,
  };
}

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService, private readonly access: GameAccessService,
    private readonly lifecycle: GameLifecycleService, private readonly media: MediaService, private readonly idempotency: IdempotencyService) {}

  private async activeActor(tx: GameTx, userId: string) {
    if (!await tx.user.count({ where: { id: userId, status: "ACTIVE" } })) throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
  }

  // Planlı başlangıç en erken 1 dakika, en geç bekleme süresi (24 saat) içinde olmalı.
  private startTime(value: string | null, now: Date, latest: Date) {
    if (value === null) return null;
    const startsAt = new Date(value);
    if (startsAt.getTime() < now.getTime() + 60000 || startsAt > latest) {
      throw new ApiError(422, "INVALID_START_TIME", "Başlangıç saati en erken 1 dakika, en geç 24 saat sonrası olmalı.");
    }
    return startsAt;
  }

  private host(session: GameSession, userId: string) {
    if (session.hostId !== userId || session.kind !== "PRIVATE") throw new ApiError(403, "HOST_REQUIRED", "Bu işlem lobi sahibine ait.");
  }

  private async state(tx: GameTx, session: GameSession, userId: string, now: Date) {
    const member = await this.access.requireMember(tx, userId, session);
    const mine = await tx.gameSubmission.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } },
      select: { id: true, mediaId: true, status: true, submittedAt: true } });
    const memberCount = await tx.gameMembership.count({ where: { sessionId: session.id, status: "ACTIVE" } });
    const submissionCount = await tx.gameSubmission.count({ where: { sessionId: session.id, status: { in: ["SUBMITTED", "FROZEN"] } } });
    const myRatingCount = await tx.gameScore.count({ where: { sessionId: session.id, voterId: userId } });
    return { ...gameSummary(session, now), membershipStatus: member.status, memberCount, submissionCount, myRatingCount,
      isHost: session.hostId === userId, mySubmission: mine,
      canSubmit: session.phase === "SUBMISSION" && session.submissionEndsAt! > now,
      canVote: session.phase === "VOTING" && session.votingEndsAt! > now,
      canEndSubmission: session.kind === "PRIVATE" && session.hostId === userId && session.phase === "SUBMISSION" && session.submissionEndsAt! > now,
    };
  }

  private async current(tx: GameTx, id: string, userId: string) {
    const session = await this.lifecycle.lock(tx, id);
    await this.access.requireMember(tx, userId, session);
    return this.lifecycle.advance(tx, session, await gameNow(tx));
  }

  get(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId);
      return this.state(tx, session, userId, await gameNow(tx));
    }, { timeout: 30000 });
  }

  create(userId: string, dto: CreateGameDto, key: unknown) {
    return this.idempotency.execute(userId, "games.create", key, dto, 201, async (tx) => {
      await lockGameUsers(tx, [userId]); await this.activeActor(tx, userId);
      const now = await gameNow(tx);
      const active = await tx.gameSession.count({ where: { hostId: userId, phase: { in: ["WAITING", "SUBMISSION", "VOTING"] } } });
      const daily = await tx.gameSession.count({ where: { hostId: userId, createdAt: { gte: new Date(now.getTime() - 86400000) } } });
      if (active >= 10 || daily >= 100) throw new ApiError(429, "GAME_QUOTA_EXCEEDED", "Lobi oluşturma sınırına ulaştın.");
      const waitingExpiresAt = new Date(now.getTime() + 86400000);
      const session = await tx.gameSession.create({ data: {
        kind: "PRIVATE", phase: "WAITING", hostId: userId, ...dto, startsAt: this.startTime(dto.startsAt, now, waitingExpiresAt), waitingExpiresAt,
        members: { create: { userId, ballotSeed: randomInt(2147483647) } },
      } });
      await gameEvent(tx, session, "game.created");
      return this.state(tx, session, userId, now);
    });
  }

  settings(userId: string, id: string, dto: CreateGameDto, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `games.settings:${id}`, key, { ...dto, expectedVersion }, 200, async (tx) => {
      const session = await this.current(tx, id, userId); this.host(session, userId); checkGameVersion(session, expectedVersion);
      if (session.phase !== "WAITING") throw gameConflict("GAME_ALREADY_STARTED", "Tema ve süreler yalnız başlamamış lobide değişir.");
      const count = await tx.gameMembership.count({ where: { sessionId: id, status: "ACTIVE" } });
      if (dto.maxMembers < count) throw gameConflict("CAPACITY_BELOW_MEMBERS", "Kapasite mevcut katılımcı sayısından küçük olamaz.");
      const startsAt = this.startTime(dto.startsAt, await gameNow(tx), session.waitingExpiresAt!);
      const saved = await tx.gameSession.update({ where: { id }, data: { ...dto, startsAt, version: { increment: 1 } } });
      await gameEvent(tx, saved, "game.settings.changed"); return this.state(tx, saved, userId, await gameNow(tx));
    });
  }

  rotateInvite(userId: string, id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId); this.host(session, userId); checkGameVersion(session, expectedVersion);
      if (!["WAITING", "SUBMISSION"].includes(session.phase)) throw gameConflict("GAME_JOIN_CLOSED", "Bu lobinin katılımı kapandı.");
      const now = await gameNow(tx);
      const expiresAt = session.phase === "WAITING" ? session.waitingExpiresAt! : session.submissionEndsAt!;
      const token = randomBytes(32).toString("base64url");
      const saved = await tx.gameSession.update({ where: { id }, data: { inviteHash: gameTokenHash(token), inviteExpiresAt: expiresAt, version: { increment: 1 } } });
      await gameEvent(tx, saved, "game.invite.rotated");
      return { sessionId: id, version: saved.version, token, expiresAt, deepLink: `podyum://games/join?token=${token}` };
    });
  }

  revokeInvite(userId: string, id: string, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `games.invite.revoke:${id}`, key, { expectedVersion }, 200, async (tx) => {
      const session = await this.current(tx, id, userId); this.host(session, userId); checkGameVersion(session, expectedVersion);
      const saved = await tx.gameSession.update({ where: { id }, data: { inviteHash: null, inviteExpiresAt: null, version: { increment: 1 } } });
      await gameEvent(tx, saved, "game.invite.revoked"); return this.state(tx, saved, userId, await gameNow(tx));
    });
  }

  private async invited(tx: GameTx, userId: string, token: string) {
    const hash = gameTokenHash(token);
    const candidate = await tx.gameSession.findUnique({ where: { inviteHash: hash }, select: { id: true } });
    if (!candidate) throw gameMissing();
    const session = await this.lifecycle.lock(tx, candidate.id);
    const now = await gameNow(tx);
    if (session.inviteHash !== hash || !session.inviteExpiresAt || session.inviteExpiresAt <= now) throw gameMissing();
    const allowedHost = await tx.gameSession.count({ where: { id: session.id, kind: "PRIVATE", ...this.access.hostVisibleWhere(userId) } });
    if (!allowedHost) throw gameMissing();
    return this.lifecycle.advance(tx, session, now);
  }

  previewInvite(userId: string, token: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.invited(tx, userId, token);
      if (!["WAITING", "SUBMISSION"].includes(session.phase)) throw gameMissing();
      return gameSummary(session, await gameNow(tx));
    });
  }

  private async addMember(tx: GameTx, session: GameSession, userId: string) {
    await lockGameUsers(tx, [userId]); await this.activeActor(tx, userId);
    const previous = await tx.gameMembership.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } });
    if (previous?.status === "ACTIVE") return this.state(tx, session, userId, await gameNow(tx));
    if (!["WAITING", "SCHEDULED", "SUBMISSION"].includes(session.phase)) throw gameConflict("GAME_JOIN_CLOSED", "Oy aşamasına geçildi; yeni katılım kapalı.");
    if (session.kind === "PRIVATE") {
      const blocked = await tx.block.count({ where: { OR: [
        { blockerId: userId, blocked: { gameMemberships: { some: { sessionId: session.id, status: "ACTIVE" } } } },
        { blockedId: userId, blocker: { gameMemberships: { some: { sessionId: session.id, status: "ACTIVE" } } } },
      ] } });
      if (blocked) throw new ApiError(403, "GAME_ACCESS_DENIED", "Bu lobiye katılamazsın.");
    }
    const count = await tx.gameMembership.count({ where: { sessionId: session.id, status: "ACTIVE" } });
    if (session.maxMembers !== null && count >= session.maxMembers) throw gameConflict("ROOM_FULL", "Lobi dolu.");
    const now = await gameNow(tx);
    if (session.phase === "SUBMISSION" && session.submissionEndsAt! <= now) throw gameConflict("GAME_JOIN_CLOSED", "Fotoğraf süresi doldu; yeni katılım kapalı.");
    if (session.phase === "WAITING" && session.waitingExpiresAt! <= now) throw gameConflict("GAME_JOIN_CLOSED", "Lobinin bekleme süresi doldu.");
    await tx.gameMembership.upsert({ where: { sessionId_userId: { sessionId: session.id, userId } },
      create: { sessionId: session.id, userId, ballotSeed: randomInt(2147483647), joinedAt: now },
      update: { status: "ACTIVE", leftAt: null, joinedAt: now },
    });
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: { version: { increment: 1 } } });
    await gameEvent(tx, saved, "game.member.joined", { userId });
    return this.state(tx, saved, userId, now);
  }

  joinPrivate(userId: string, token: string, key: unknown) {
    return this.idempotency.execute(userId, "games.join-invite", key, { tokenHash: gameTokenHash(token) }, 200,
      async (tx) => this.addMember(tx, await this.invited(tx, userId, token), userId));
  }

  // Günlük etkinliğe veya herkese açık özel lobiye davetsiz katılım.
  joinDaily(userId: string, id: string, key: unknown) {
    return this.idempotency.execute(userId, `games.join-daily:${id}`, key, {}, 200, async (tx) => {
      const session = await this.lifecycle.lock(tx, id);
      if (session.kind !== "DAILY" && !(session.kind === "PRIVATE" && session.isPublic)) throw gameMissing();
      if (session.kind === "PRIVATE" && !await tx.gameSession.count({ where: { id, ...this.access.hostVisibleWhere(userId) } })) throw gameMissing();
      return this.addMember(tx, await this.lifecycle.advance(tx, session, await gameNow(tx)), userId);
    });
  }

  // Hızlı eşleş için katılınabilir herkese açık lobiler: bekleyen veya fotoğraf
  // süresi devam eden, dolu olmayan, üyesi olmadığın ve engelli olmayan host.
  openRooms(userId: string) {
    return this.prisma.$transaction(async (tx) => {
    const now = await gameNow(tx);
    const rows = await tx.gameSession.findMany({
      where: { kind: "PRIVATE", isPublic: true, ...this.access.hostVisibleWhere(userId),
        OR: [{ phase: "WAITING", waitingExpiresAt: { gt: now } }, { phase: "SUBMISSION", submissionEndsAt: { gt: now } }],
        members: { none: { userId, status: "ACTIVE" } } },
      include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ startsAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 50,
    });
    return rows.filter((row) => row.maxMembers === null || row._count.members < row.maxMembers).slice(0, 20)
      .map(({ _count, ...row }) => ({ ...gameSummary(row, now), memberCount: _count.members }));
    });
  }

  start(userId: string, id: string, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `games.start:${id}`, key, { expectedVersion }, 200, async (tx) => {
      const session = await this.current(tx, id, userId); this.host(session, userId); checkGameVersion(session, expectedVersion);
      if (session.phase !== "WAITING") throw gameConflict("GAME_ALREADY_STARTED", "Lobi zaten başladı veya kapandı.");
      if (await tx.gameMembership.count({ where: { sessionId: id, status: "ACTIVE", user: { status: "ACTIVE" } } }) < 2) {
        throw gameConflict("NOT_ENOUGH_PLAYERS", "Başlamak için en az iki katılımcı gerekli.");
      }
      const now = await gameNow(tx);
      const saved = await this.lifecycle.openSubmission(tx, session, now);
      return this.state(tx, saved, userId, now);
    });
  }

  endSubmission(userId: string, id: string, expectedVersion: number, key: unknown) {
    return this.idempotency.execute(userId, `games.end-submission:${id}`, key, { expectedVersion }, 200, async (tx) => {
      const session = await this.current(tx, id, userId); this.host(session, userId); checkGameVersion(session, expectedVersion);
      if (session.phase !== "SUBMISSION") throw gameConflict("SUBMISSION_CLOSED", "Fotoğraf aşaması açık değil.");
      const now = await gameNow(tx);
      const saved = await this.lifecycle.openVoting(tx, session, now, true);
      return this.state(tx, saved, userId, now);
    });
  }

  leave(userId: string, id: string, key: unknown) {
    return this.idempotency.execute(userId, `games.leave:${id}`, key, {}, 200, async (tx) => {
      const session = await this.current(tx, id, userId);
      if (!["WAITING", "SCHEDULED", "SUBMISSION"].includes(session.phase)) throw gameConflict("GAME_LEAVE_CLOSED", "Bu aşamada katılım listesi sabit.");
      const now = await gameNow(tx);
      await tx.gameMembership.update({ where: { sessionId_userId: { sessionId: id, userId } }, data: { status: "LEFT", leftAt: now } });
      await tx.gameSubmission.updateMany({ where: { sessionId: id, userId }, data: { status: "WITHDRAWN" } });
      const saved = session.hostId === userId && session.phase === "WAITING" ? await this.lifecycle.cancel(tx, session, "HOST_LEFT", now)
        : await tx.gameSession.update({ where: { id }, data: { version: { increment: 1 } } });
      await gameEvent(tx, saved, "game.member.left", { userId });
      return { sessionId: id, left: true as const, version: saved.version, phase: saved.phase };
    });
  }

  submit(userId: string, id: string, mediaId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId);
      const previous = await tx.gameSubmission.findUnique({ where: { sessionId_userId: { sessionId: id, userId } } });
      if (previous?.mediaId === mediaId && previous.status !== "WITHDRAWN") return this.submissionReceipt(previous);
      if (session.phase !== "SUBMISSION") throw gameConflict("SUBMISSION_CLOSED", "Fotoğraf süresi açık değil.");
      // Medya → kullanıcı sırası avatar hattıyla aynıdır; kullanıcı kilidinden sonra medya alınmaz.
      await this.media.requirePublishableAsset(tx, userId, mediaId, "GAME");
      await lockGameUsers(tx, [userId]); await this.activeActor(tx, userId);
      await this.access.requireMember(tx, userId, session);
      const now = await gameNow(tx);
      if (session.submissionEndsAt! <= now) throw gameConflict("SUBMISSION_CLOSED", "Fotoğraf süresi doldu.");
      const position = previous?.position ?? session.ballotSlots + 1;
      const row = await tx.gameSubmission.upsert({ where: { sessionId_userId: { sessionId: id, userId } },
        create: { sessionId: id, userId, mediaId, position, submittedAt: now }, update: { mediaId, status: "SUBMITTED", submittedAt: now },
      });
      const saved = await tx.gameSession.update({ where: { id }, data: { version: { increment: 1 }, ...(!previous ? { ballotSlots: position } : {}) } });
      await gameEvent(tx, saved, "game.submission.accepted", { submissionId: row.id, userId });
      return this.submissionReceipt(row);
    });
  }

  private submissionReceipt(row: { id: string; sessionId: string; mediaId: string; submittedAt: Date }) {
    return { sessionId: row.sessionId, submissionId: row.id, mediaId: row.mediaId, acceptedAt: row.submittedAt };
  }

  ballot(userId: string, id: string, query: GamePageDto) {
    const ordinal = decodeGameCursor(query.cursor, id, userId, "ballot");
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId);
      if (session.phase !== "VOTING") throw gameConflict("VOTING_NOT_OPEN", "Oylama aşaması açık değil.");
      const member = await this.access.requireMember(tx, userId, session);
      const slots = session.ballotSlots;
      const split = member.ballotSeed % slots + 1;
      const where: Prisma.GameSubmissionWhereInput = { sessionId: id, userId: { not: userId },
        ...this.access.eligibleSubmissionWhere(userId), scores: { none: { voterId: userId } } };
      const select = { id: true, position: true, mediaId: true } as const;
      const rows = await tx.gameSubmission.findMany({ where: { AND: [where, { position: { gte: Math.max(split, split + ordinal + 1), lte: slots } }] },
        orderBy: { position: "asc" }, take: query.limit + 1, select });
      if (rows.length < query.limit + 1) rows.push(...await tx.gameSubmission.findMany({ where: { AND: [where,
        { position: { gte: Math.max(1, ordinal - slots + split + 1), lt: split } },
      ] }, orderBy: { position: "asc" }, take: query.limit + 1 - rows.length, select }));
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return { items: page.map((row) => this.card(row)), serverNow: await gameNow(tx), votingEndsAt: session.votingEndsAt!,
        nextCursor: rows.length > query.limit && last ? encodeGameCursor((last.position - split + slots) % slots, id, userId, "ballot") : null,
      };
    });
  }

  private card(row: { id: string; position: number; mediaId: string }) {
    return { id: row.id, number: row.position, mediaId: row.mediaId,
      displayPath: `/v1/media/${row.mediaId}/content`, thumbnailPath: `/v1/media/${row.mediaId}/content?variant=thumbnail` };
  }

  score(userId: string, id: string, submissionId: string, stars: number) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId);
      const target = await tx.gameSubmission.findFirst({ where: { id: submissionId, sessionId: id }, select: { userId: true } });
      if (!target) throw gameMissing();
      await lockGameUsers(tx, [userId, target.userId]); await this.activeActor(tx, userId);
      await this.access.requireMember(tx, userId, session);
      if (!await tx.gameSubmission.count({ where: { id: submissionId, sessionId: id, ...this.access.eligibleSubmissionWhere(userId) } })) throw gameMissing();
      if (target.userId === userId) throw new ApiError(403, "SELF_RATING_NOT_ALLOWED", "Kendi fotoğrafına yıldız veremezsin.");
      const previous = await tx.gameScore.findUnique({ where: { submissionId_voterId: { submissionId, voterId: userId } } });
      if (previous) {
        if (previous.stars !== stars) throw gameConflict("RATING_ALREADY_CAST", "Değerlendirmen kaydedildi; değiştirilemez.");
        return { sessionId: id, submissionId, stars, acceptedAt: previous.createdAt };
      }
      const now = await gameNow(tx);
      if (session.phase !== "VOTING" || session.votingEndsAt! <= now) throw gameConflict("VOTING_CLOSED", "Oylama süresi açık değil.");
      const row = await tx.gameScore.create({ data: { sessionId: id, submissionId, targetUserId: target.userId, voterId: userId, stars, createdAt: now } });
      const saved = await tx.gameSession.update({ where: { id }, data: { version: { increment: 1 } } });
      await gameEvent(tx, saved, "game.rating.cast", { submissionId, voterId: userId });
      // Son oy ise sonuçlar hemen açılır.
      await this.lifecycle.finishIfAllVoted(tx, saved, now, (voterId) => tx.gameSubmission.count({ where: {
        sessionId: id, userId: { not: voterId }, ...this.access.eligibleSubmissionWhere(voterId) } }));
      return { sessionId: id, submissionId, stars, acceptedAt: row.createdAt };
    }, { timeout: 30000 });
  }

  results(userId: string, id: string, query: GamePageDto) {
    const position = decodeGameCursor(query.cursor, id, userId, "results");
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId);
      if (session.phase !== "COMPLETED") throw gameConflict("RESULTS_NOT_AVAILABLE", "Sonuçlar oylama tamamlandığında açılır.");
      // Sıraya göre sayfalanır; cursor son görülen sıradır.
      const rows = await tx.gameSubmission.findMany({ where: { sessionId: id, outcome: { rank: { gt: position } }, ...this.access.eligibleSubmissionWhere(userId) },
        orderBy: { outcome: { rank: "asc" } }, take: query.limit + 1,
        include: { outcome: true, member: { select: { user: { select: { id: true, username: true, displayName: true, avatarMediaId: true } } } } },
      });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      const ranked = this.lifecycle.ranked(session);
      const mine = await tx.gameOutcome.findUnique({ where: { sessionId_userId: { sessionId: id, userId } } });
      const totalPoints = ranked ? (await tx.gameLeaguePoint.aggregate({ where: { userId }, _sum: { delta: true } }))._sum.delta ?? 0 : null;
      return { ...gameSummary(session, await gameNow(tx)), official: ranked, awardedPoints: mine?.awardedPoints ?? 0,
        myRank: mine?.rank ?? null, totalPoints, league: totalPoints === null ? null : leagueFor(totalPoints),
        items: page.map((row) => ({ ...this.card(row), author: { id: row.member.user.id, username: row.member.user.username,
          displayName: row.member.user.displayName,
          avatarPath: row.member.user.avatarMediaId ? `/v1/media/${row.member.user.avatarMediaId}/content?variant=thumbnail` : null },
          rank: row.outcome!.rank, awardedPoints: row.outcome!.awardedPoints,
          ratingCount: row.outcome!.ratingCount, ratingSum: row.outcome!.ratingSum,
          averageStars: row.outcome!.ratingCount ? row.outcome!.ratingSum / row.outcome!.ratingCount : null,
        })), nextCursor: rows.length > query.limit && last?.outcome?.rank ? encodeGameCursor(last.outcome.rank, id, userId, "results") : null,
      };
    }, { timeout: 30000 });
  }

  // Podyum Turu: o an herkese gösterilen yarışmacı, turun bitişi ve oy durumu.
  // Sıra yarışmacı numarasıdır; tur sunucu saatinden hesaplanır.
  turn(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.current(tx, id, userId);
      if (session.phase !== "VOTING") throw gameConflict("VOTING_CLOSED", "Oylama açık değil.");
      const now = await gameNow(tx);
      const entries = await tx.gameSubmission.findMany({ where: { sessionId: id, status: "FROZEN" }, orderBy: { position: "asc" },
        select: { id: true, position: true, mediaId: true, userId: true } });
      const start = session.votingStartsAt!.getTime();
      if (!entries.length) throw gameConflict("VOTING_CLOSED", "Gösterilebilecek kombin kalmadı.");
      const slot = Math.max(0, Math.floor((now.getTime() - start) / (TURN_SECONDS * 1000)));
      const index = slot % entries.length;
      const turnEnd = Math.min(start + (slot + 1) * TURN_SECONDS * 1000, session.votingEndsAt!.getTime());
      const entry = entries[index];
      const mine = entry.userId === userId;
      // Engelli yazarın kombini bu kullanıcıya gösterilmez; tur yine sayılır.
      const visible = mine || await tx.gameSubmission.count({ where: { id: entry.id, ...this.access.eligibleSubmissionWhere(userId) } }) > 0;
      const myScore = await tx.gameScore.findUnique({ where: { submissionId_voterId: { submissionId: entry.id, voterId: userId } } });
      const members = await tx.gameMembership.count({ where: { sessionId: id, status: "ACTIVE", user: { status: "ACTIVE" } } });
      const myIndex = entries.findIndex((row) => row.userId === userId);
      return {
        index, total: entries.length, cycle: Math.floor(slot / entries.length) + 1, turnSeconds: Math.min(TURN_SECONDS, Math.max(0, (turnEnd - (start + slot * TURN_SECONDS * 1000)) / 1000)), serverNow: now,
        turnEndsAt: new Date(turnEnd), votingEndsAt: session.votingEndsAt, remainingSeconds: Math.max(0, Math.ceil((session.votingEndsAt!.getTime() - now.getTime()) / 1000)),
        current: visible ? { ...this.card(entry), mine, myStars: myScore?.stars ?? null } : null,
        votedCount: await tx.gameScore.count({ where: { submissionId: entry.id } }),
        voterCount: Math.max(0, members - 1),
        myTurnIn: myIndex >= 0 && myIndex !== index ? (myIndex - index + entries.length) % entries.length : null,
        nextNumber: turnEnd < session.votingEndsAt!.getTime() ? entries[(index + 1) % entries.length].position : null,
      };
    }, { timeout: 30000 });
  }

  // Kullanıcının herkese açık defilelerden kazandığı toplam lig puanı ve ligi.
  async league(userId: string) {
    const totalPoints = (await this.prisma.gameLeaguePoint.aggregate({ where: { userId }, _sum: { delta: true } }))._sum.delta ?? 0;
    return { totalPoints, league: leagueFor(totalPoints) };
  }

  history(userId: string, query: GamePageDto) {
    const context = { resource: "game-history", userId };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      const now = await gameNow(tx);
      const rows = await tx.gameMembership.findMany({ where: { userId, session: this.access.hostVisibleWhere(userId),
        ...(cursor ? { OR: [{ joinedAt: { lt: new Date(cursor.createdAt) } }, { joinedAt: new Date(cursor.createdAt), sessionId: { lt: cursor.id } }] } : {}),
      }, orderBy: [{ joinedAt: "desc" }, { sessionId: "desc" }], take: query.limit + 1, include: { session: true } });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      return { items: page.map((row) => ({ ...gameSummary(row.session, now), membershipStatus: row.status })), serverNow: now,
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.sessionId, createdAt: last.joinedAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }
}
