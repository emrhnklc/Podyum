import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { trendSnapshot } from "./trend-snapshot.js";
import {
  readTrendCursor,
  trendCursor,
  trendUuid,
  type TrendVoteKey,
} from "./trend-rebuild-cursor.js";
import { TREND_POLICY } from "./trend-policy.js";

type Tx = Prisma.TransactionClient;
async function lock(tx: Tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('trend-projection-v1', 0))::text`;
}
@Injectable()
export class TrendProjectionService {
  constructor(private readonly db: PrismaService) {}

  async synchronize(tx: Tx, keys: TrendVoteKey[], apply = true) {
    if (typeof apply !== "boolean")
      throw new Error("Trend onarım modu boolean olmalı.");
    if (!keys.length)
      return {
        votes: 0,
        contributionCount: 0,
        previousCount: 0,
        invalidSnapshots: 0,
      };
    if (
      keys.length > 100 ||
      keys.some((key) => !trendUuid(key.pollId) || !trendUuid(key.voterId))
    )
      throw new Error("Geçersiz trend kaynak sınırı.");
    await lock(tx);
    const votes = await tx.pollVote.findMany({
      where: { OR: keys },
      include: {
        poll: {
          select: {
            authorId: true,
            visibility: true,
            status: true,
            publishedAt: true,
            closesAt: true,
            audienceGender: true,
            audienceAgeBand: true,
            styleMatchRequired: true,
          },
        },
        option: {
          select: {
            products: {
              where: { source: "CATALOG", catalogProductId: { not: null } },
              orderBy: { id: "asc" },
              select: {
                id: true,
                catalogProductId: true,
                catalogSnapshot: true,
              },
            },
          },
        },
      },
    });
    const [{ now }] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS "now"`;
    const contributions: Prisma.TrendContributionCreateManyInput[] = [];
    let invalidSnapshots = 0;
    for (const vote of votes) {
      const p = vote.poll;
      // Gizli/iptal içerik için gerçek yayın geçmişi saklanabilir, fakat yalnız
      // SQL uygunluk görünümü genel trende kaynak olur. DRAFT/FRIENDS asla yazılmaz.
      if (
        p.visibility !== "PUBLIC" ||
        p.status === "DRAFT" ||
        !p.publishedAt ||
        !p.closesAt ||
        p.authorId === vote.voterId ||
        p.audienceGender !== "ANY" ||
        p.audienceAgeBand !== null ||
        p.styleMatchRequired ||
        vote.createdAt < p.publishedAt ||
        vote.createdAt >= p.closesAt ||
        vote.createdAt > now
      )
        continue;
      const seen = new Set<string>();
      for (const tag of vote.option.products) {
        const snapshot = trendSnapshot(
          tag.catalogSnapshot,
          tag.catalogProductId!,
          p.publishedAt,
        );
        if (!snapshot) {
          invalidSnapshots++;
          continue;
        }
        if (seen.has(tag.catalogProductId!)) continue;
        seen.add(tag.catalogProductId!);
        contributions.push({
          pollId: vote.pollId,
          voterId: vote.voterId,
          sourceCatalogProductId: tag.catalogProductId!,
          productTagId: tag.id,
          votedAt: vote.createdAt,
          ...snapshot,
          projectionVersion: TREND_POLICY.version,
        });
      }
    }
    const previousCount = await tx.trendContribution.count({
      where: { OR: keys },
    });
    if (apply) {
      await tx.trendContribution.deleteMany({ where: { OR: keys } });
      if (contributions.length)
        await tx.trendContribution.createMany({ data: contributions });
    }
    return {
      votes: votes.length,
      contributionCount: contributions.length,
      previousCount,
      invalidSnapshots,
    };
  }

  async rebuildBatch(
    options: {
      apply?: boolean;
      batchSize?: number;
      cursor?: string;
      pollId?: string;
    } = {},
  ) {
    const { apply = false, batchSize = 50 } = options;
    const pollId = options.pollId?.toLowerCase() ?? null;
    if (
      typeof apply !== "boolean" ||
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 100 ||
      (pollId !== null && !trendUuid(pollId))
    )
      throw new Error(
        "Trend onarımı için 1–100 batch ve geçerli kaynak gerekli.",
      );
    const after = options.cursor
      ? readTrendCursor(options.cursor, pollId)
      : null;
    return this.db.$transaction(
      async (tx) => {
        await lock(tx);
        const rows = await tx.pollVote.findMany({
          where: {
            AND: [
              ...(pollId ? [{ pollId }] : []),
              ...(after
                ? [
                    {
                      OR: [
                        { pollId: { gt: after.pollId } },
                        {
                          pollId: after.pollId,
                          voterId: { gt: after.voterId },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: { pollId: true, voterId: true },
          orderBy: [{ pollId: "asc" }, { voterId: "asc" }],
          take: batchSize + 1,
        });
        const keys = rows.slice(0, batchSize),
          last = keys.at(-1);
        const result = await this.synchronize(tx, keys, apply);
        return {
          mode: apply ? "apply" : "dry-run",
          ...result,
          hasMore: rows.length > batchSize,
          nextCursor:
            rows.length > batchSize && last ? trendCursor(last, pollId) : null,
          policy: TREND_POLICY,
        };
      },
      { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 30000 },
    );
  }
}
