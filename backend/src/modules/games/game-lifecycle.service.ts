import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { GameSession } from "../../generated/prisma/client.js";
import { gameMissing } from "./game-access.service.js";
import { gameEvent, gameNow, type GameTx } from "./game-internals.js";
import { RANK_POINTS } from "./league.js";

// Podyum Turu: oylamada kombinler yarışmacı numarası sırasıyla, herkese aynı anda
// ve her biri bu kadar saniye gösterilir. Oylama süresi = kombin sayısı x tur.
export const TURN_SECONDS = 10;

@Injectable()
export class GameLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async lock(tx: GameTx, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "GameSession" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const session = await tx.gameSession.findUnique({ where: { id } });
    if (!session) throw gameMissing();
    return session;
  }

  async cancel(tx: GameTx, session: GameSession, reason: string, now: Date) {
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: {
      phase: "CANCELLED", cancelReason: reason, finishedAt: now, inviteHash: null, inviteExpiresAt: null, version: { increment: 1 },
    } });
    await gameEvent(tx, saved, "game.cancelled", { reason });
    return saved;
  }

  // Fotoğraf aşamasını açar. Süreler başlangıç anından hesaplanır; planlı odada
  // işçi geç kalsa bile pencere uzamaz.
  async openSubmission(tx: GameTx, session: GameSession, from: Date) {
    const end = new Date(from.getTime() + session.submissionSeconds * 1000);
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: {
      phase: "SUBMISSION", startsAt: from, submissionEndsAt: end, votingStartsAt: end,
      votingEndsAt: new Date(end.getTime() + session.votingSeconds * 1000), version: { increment: 1 },
      ...(session.inviteHash ? { inviteExpiresAt: end } : {}),
    } });
    await gameEvent(tx, saved, "game.submission.opened");
    return saved;
  }

  async openVoting(tx: GameTx, session: GameSession, now: Date, early = false) {
    await tx.gameSubmission.updateMany({ where: { sessionId: session.id, status: "SUBMITTED", OR: [
      { member: { status: "LEFT" } }, { member: { user: { status: { not: "ACTIVE" } } } },
      { media: { status: { not: "READY" } } }, { media: { previewAcceptedAt: null } },
    ] }, data: { status: "WITHDRAWN" } });
    const valid = await tx.gameSubmission.count({ where: { sessionId: session.id, status: "SUBMITTED" } });
    if (valid < 2) return this.cancel(tx, session, "NOT_ENOUGH_SUBMISSIONS", now);
    await tx.gameSubmission.updateMany({ where: { sessionId: session.id, status: "SUBMITTED" }, data: { status: "FROZEN" } });
    // Turlar oylamanın planlanan başlangıcından sayılır; işçi geç kalsa da pencere uzamaz.
    const from = early ? now : session.votingStartsAt!;
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: {
      phase: "VOTING", inviteHash: null, inviteExpiresAt: null, version: { increment: 1 },
      ...(early ? { submissionEndsAt: now, votingStartsAt: now } : {}),
      votingEndsAt: new Date(from.getTime() + valid * TURN_SECONDS * 1000),
    } });
    await gameEvent(tx, saved, "game.voting.opened", { early, submissionCount: valid });
    return saved;
  }

  // Herkese açık defilede (günlük veya herkese açık lobi) lig puanı verilir;
  // arkadaşlarla kurulan davetli odada yalnız sıralama vardır.
  ranked(session: GameSession) {
    return session.kind === "DAILY" || session.isPublic;
  }

  async complete(tx: GameTx, session: GameSession) {
    const submissions = await tx.gameSubmission.findMany({ where: { sessionId: session.id, status: "FROZEN" }, select: { id: true, userId: true, position: true } });
    const groups = await tx.gameScore.groupBy({ by: ["submissionId"], where: { sessionId: session.id }, _count: { _all: true }, _sum: { stars: true } });
    const scores = new Map(groups.map((group) => [group.submissionId, group]));
    // Sıra: ortalama yıldız (oy alan önce), sonra oy sayısı, sonra yükleme sırası.
    const rows = submissions.map((submission) => {
      const count = scores.get(submission.id)?._count._all ?? 0;
      const sum = scores.get(submission.id)?._sum.stars ?? 0;
      return { ...submission, count, sum, average: count ? sum / count : -1 };
    }).sort((a, b) => b.average - a.average || b.count - a.count || a.position - b.position);
    const ranked = this.ranked(session);
    const outcomes = rows.map((row, index) => ({
      sessionId: session.id, submissionId: row.id, userId: row.userId, ratingCount: row.count, ratingSum: row.sum,
      rank: index + 1, awardedPoints: ranked && row.count > 0 ? RANK_POINTS[index] ?? 0 : 0,
    }));
    if (outcomes.length) await tx.gameOutcome.createMany({ data: outcomes });
    const awards = outcomes.filter((outcome) => outcome.awardedPoints > 0);
    if (awards.length) await tx.gameLeaguePoint.createMany({ data: awards.map((outcome) => ({
      userId: outcome.userId, sessionId: session.id, rank: outcome.rank, delta: outcome.awardedPoints,
    })), skipDuplicates: true });
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: {
      phase: "COMPLETED", finishedAt: session.votingEndsAt, version: { increment: 1 }, inviteHash: null, inviteExpiresAt: null,
    } });
    await gameEvent(tx, saved, "game.completed");
    return saved;
  }

  // Odadaki her aktif üye kendine düşen bütün kombinleri oyladıysa oylama
  // süresini beklemeden biter. Hiç oy vermemiş bir üye varsa beklenir.
  async finishIfAllVoted(tx: GameTx, session: GameSession, now: Date, eligible: (voterId: string) => Promise<number>) {
    if (session.phase !== "VOTING") return session;
    const members = await tx.gameMembership.findMany({ where: { sessionId: session.id, status: "ACTIVE", user: { status: "ACTIVE" } }, select: { userId: true } });
    for (const { userId } of members) {
      const rated = await tx.gameScore.count({ where: { sessionId: session.id, voterId: userId } });
      if (rated < await eligible(userId)) return session;
    }
    const closed = await tx.gameSession.update({ where: { id: session.id }, data: { votingEndsAt: now } });
    return this.complete(tx, closed);
  }

  async advance(tx: GameTx, session: GameSession, now: Date) {
    let current = session;
    // Planlı özel lobi saatinde kendiliğinden başlar; iki aktif üye yoksa iptal olur.
    if (current.phase === "WAITING" && current.startsAt && current.startsAt <= now) {
      const members = await tx.gameMembership.count({ where: { sessionId: current.id, status: "ACTIVE", user: { status: "ACTIVE" } } });
      if (members < 2) return this.cancel(tx, current, "NOT_ENOUGH_PLAYERS", now);
      current = await this.openSubmission(tx, current, current.startsAt);
    }
    if (current.phase === "WAITING" && current.waitingExpiresAt! <= now) return this.cancel(tx, current, "LOBBY_EXPIRED", now);
    if (current.phase === "SCHEDULED" && current.startsAt! <= now) {
      current = await tx.gameSession.update({ where: { id: current.id }, data: { phase: "SUBMISSION", version: { increment: 1 } } });
      await gameEvent(tx, current, "game.submission.opened");
    }
    if (current.phase === "SUBMISSION" && current.submissionEndsAt! <= now) current = await this.openVoting(tx, current, now);
    if (current.phase === "VOTING" && current.votingEndsAt! <= now) current = await this.complete(tx, current);
    return current;
  }

  async scan(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Oyun tarama sınırı 1–500 olmalı.");
    // Her oda ayrı transaction: büyük günlük sonuç diğer odaların süresini tutmaz.
    const candidates = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "GameSession" WHERE
      ("phase" = 'WAITING' AND ("waitingExpiresAt" <= clock_timestamp() OR "startsAt" <= clock_timestamp())) OR
      ("phase" = 'SCHEDULED' AND "startsAt" <= clock_timestamp()) OR
      ("phase" = 'SUBMISSION' AND "submissionEndsAt" <= clock_timestamp()) OR
      ("phase" = 'VOTING' AND "votingEndsAt" <= clock_timestamp()) ORDER BY "createdAt", "id" LIMIT ${limit}`;
    let advanced = 0;
    for (const { id } of candidates) await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "GameSession" WHERE "id" = ${id}::uuid FOR UPDATE SKIP LOCKED`;
      if (!locked) return;
      const row = await tx.gameSession.findUniqueOrThrow({ where: { id } });
      const saved = await this.advance(tx, row, await gameNow(tx));
      if (saved.version !== row.version) advanced++;
    }, { timeout: 30000 });
    return { advanced };
  }
}
