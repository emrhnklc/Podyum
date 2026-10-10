import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { SocialAccessService } from "../social/social-access.service.js";
import { effectivePollStatus, pollServerNow, writePollEvent } from "./polls-internals.js";

@Injectable()
export class PollParticipationService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService) {}

  // Çağıran izin değişikliğini ve User kilidini aynı transaction'da yönetir.
  clearAnalyticsSnapshots(tx: Prisma.TransactionClient, userId: string) {
    return tx.pollVote.updateMany({ where: { voterId: userId }, data: {
      genderAtVote: null, ageBandAtVote: null, analyticsConsentAtVote: null, analyticsRevisionAtVote: null,
    } });
  }

  vote(userId: string, pollId: string, optionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Poll" WHERE "id" = ${pollId}::uuid FOR UPDATE`;
      // İzin değişikliğiyle aynı kullanıcı kilidi: snapshot ve kabul tek ana aittir.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      if (!await tx.user.count({ where: { id: userId, status: "ACTIVE" } })) throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
      // Sosyal değişiklik de bu User kilidini alır: beklerken değişen erişim tekrar okunur.
      await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId } });
      if (poll.authorId === userId) throw new ApiError(403, "SELF_VOTE_NOT_ALLOWED", "Kendi paylaşımına oy veremezsin.");
      const previous = await tx.pollVote.findUnique({ where: { pollId_voterId: { pollId, voterId: userId } } });
      if (previous) {
        if (previous.optionId !== optionId) throw new ApiError(409, "VOTE_ALREADY_CAST", "Tercihin kaydedildi; bu sürümde değiştirilemez.");
        return { pollId, optionId, acceptedAt: previous.createdAt };
      }
      if (!await tx.pollOption.count({ where: { id: optionId, pollId } })) throw new ApiError(400, "OPTION_NOT_IN_POLL", "Seçenek bu oylamaya ait değil.");
      if (poll.audienceGender !== "ANY" || poll.audienceAgeBand !== null || poll.styleMatchRequired) {
        throw new ApiError(400, "UNSUPPORTED_AUDIENCE", "Gelişmiş kitle filtreleri henüz açık değil.");
      }
      const demographics = await tx.userPrivate.findUnique({ where: { userId } });
      const now = await pollServerNow(tx);
      if (poll.status !== "OPEN" || !poll.closesAt || poll.closesAt <= now) throw new ApiError(409, "POLL_EXPIRED", "Oylama sona erdi.");
      const consent = demographics?.analyticsConsentAt != null;
      const saved = await tx.pollVote.create({ data: {
        pollId, voterId: userId, optionId, createdAt: now,
        genderAtVote: consent ? demographics.gender : null, ageBandAtVote: consent ? demographics.ageBand : null,
        analyticsConsentAtVote: consent ? demographics.analyticsConsentAt : null,
        analyticsRevisionAtVote: consent ? demographics.analyticsRevision : null,
      } });
      const changed = await tx.poll.update({ where: { id: pollId }, data: { version: { increment: 1 } } });
      await writePollEvent(tx, changed, "poll.vote.cast", {
        voterId: userId, optionId, votedAt: now.toISOString(), category: poll.category, measurement: "OPTION_PREFERENCE",
      });
      return { pollId, optionId, acceptedAt: saved.createdAt };
    }, { maxWait: 5000, timeout: 15000 });
  }

  results(userId: string, pollId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.requirePublishedPollAccess(tx, userId, pollId);
      const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId } });
      const now = await pollServerNow(tx);
      const status = effectivePollStatus(poll, now);
      const mine = await tx.pollVote.findUnique({ where: { pollId_voterId: { pollId, voterId: userId } }, select: { optionId: true } });
      if (poll.authorId !== userId && !mine && status !== "CLOSED") {
        throw new ApiError(403, "RESULTS_NOT_AVAILABLE", "Sonuçları oy verdikten sonra veya oylama bitince görebilirsin.");
      }
      const options = await tx.pollOption.findMany({ where: { pollId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
      const groups = await tx.pollVote.groupBy({ by: ["optionId"], where: { pollId }, _count: { _all: true } });
      const counts = new Map(groups.map((group) => [group.optionId, group._count._all]));
      const totalVotes = groups.reduce((sum, group) => sum + group._count._all, 0);
      const tallies = options.map((option) => ({ ...option, label: String.fromCharCode(64 + option.position), votes: counts.get(option.id) ?? 0,
        percentage: totalVotes ? Math.floor((counts.get(option.id) ?? 0) * 100 / totalVotes) : 0 }));
      if (totalVotes) {
        const rest = 100 - tallies.reduce((sum, option) => sum + option.percentage, 0);
        const byRemainder = [...tallies].sort((a, b) => (b.votes * 100 % totalVotes) - (a.votes * 100 % totalVotes) || a.position - b.position);
        for (let i = 0; i < rest; i++) byRemainder[i].percentage++;
      }
      const maximum = Math.max(0, ...tallies.map((option) => option.votes));
      return { pollId, status, storedStatus: poll.status, isFinal: status === "CLOSED", version: poll.version,
        serverNow: now, closesAt: poll.closesAt, totalVotes, myOptionId: mine?.optionId ?? null,
        winningOptionIds: maximum ? tallies.filter((option) => option.votes === maximum).map((option) => option.id) : [], options: tallies };
    }, { isolationLevel: "RepeatableRead" });
  }

  async closeExpiredBatch(limit = 100, onlyPollId?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Kapanış batch sınırı 1–500 olmalı.");
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Poll" WHERE "status" = 'OPEN' AND "closesAt" <= clock_timestamp()
        AND (${onlyPollId ?? null}::uuid IS NULL OR "id" = ${onlyPollId ?? null}::uuid)
        ORDER BY "closesAt", "id" LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
      for (const candidate of candidates) {
        const poll = await tx.poll.findUniqueOrThrow({ where: { id: candidate.id } });
        const saved = await tx.poll.update({ where: { id: poll.id }, data: { status: "CLOSED", closedAt: poll.closesAt, version: { increment: 1 } } });
        await writePollEvent(tx, saved, "poll.closed", { closedAt: poll.closesAt!.toISOString() });
      }
      return { closed: candidates.length };
    }, { maxWait: 5000, timeout: 15000 });
  }
}
