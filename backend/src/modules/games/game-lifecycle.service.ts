import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { GameSession } from "../../generated/prisma/client.js";
import { gameMissing } from "./game-access.service.js";
import { gameEvent, gameNow, type GameTx } from "./game-internals.js";

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

  async openVoting(tx: GameTx, session: GameSession, now: Date, early = false) {
    await tx.gameSubmission.updateMany({ where: { sessionId: session.id, status: "SUBMITTED", OR: [
      { member: { status: "LEFT" } }, { member: { user: { status: { not: "ACTIVE" } } } },
      { media: { status: { not: "READY" } } }, { media: { previewAcceptedAt: null } },
    ] }, data: { status: "WITHDRAWN" } });
    const valid = await tx.gameSubmission.count({ where: { sessionId: session.id, status: "SUBMITTED" } });
    if (valid < 2) return this.cancel(tx, session, "NOT_ENOUGH_SUBMISSIONS", now);
    await tx.gameSubmission.updateMany({ where: { sessionId: session.id, status: "SUBMITTED" }, data: { status: "FROZEN" } });
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: {
      phase: "VOTING", inviteHash: null, inviteExpiresAt: null, version: { increment: 1 },
      ...(early ? { submissionEndsAt: now, votingStartsAt: now, votingEndsAt: new Date(now.getTime() + session.votingSeconds * 1000) } : {}),
    } });
    await gameEvent(tx, saved, "game.voting.opened", { early, submissionCount: valid });
    return saved;
  }

  async complete(tx: GameTx, session: GameSession) {
    const submissions = await tx.gameSubmission.findMany({ where: { sessionId: session.id, status: "FROZEN" }, select: { id: true, userId: true } });
    const groups = await tx.gameScore.groupBy({ by: ["submissionId"], where: { sessionId: session.id }, _count: { _all: true }, _sum: { stars: true } });
    const scores = new Map(groups.map((group) => [group.submissionId, group]));
    if (submissions.length) await tx.gameOutcome.createMany({ data: submissions.map((submission) => ({
      sessionId: session.id, submissionId: submission.id, userId: submission.userId,
      ratingCount: scores.get(submission.id)?._count._all ?? 0, ratingSum: scores.get(submission.id)?._sum.stars ?? 0,
    })) });
    const saved = await tx.gameSession.update({ where: { id: session.id }, data: {
      phase: "COMPLETED", finishedAt: session.votingEndsAt, version: { increment: 1 }, inviteHash: null, inviteExpiresAt: null,
    } });
    await gameEvent(tx, saved, "game.completed");
    return saved;
  }

  async advance(tx: GameTx, session: GameSession, now: Date) {
    let current = session;
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
      ("phase" = 'WAITING' AND "waitingExpiresAt" <= clock_timestamp()) OR
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
