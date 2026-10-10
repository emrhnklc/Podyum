import { Injectable } from "@nestjs/common";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { pollDetailInclude, presentPoll } from "../polls/poll-read-model.js";
import { pollServerNow } from "../polls/polls-internals.js";
import { SocialAccessService } from "../social/social-access.service.js";
import { FeedScope, type FeedQueryDto } from "./dto/feed.dto.js";

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService) {}

  list(userId: string, query: FeedQueryDto) {
    const context = { resource: "feed", viewerId: userId, scope: query.scope, category: query.category ?? "ALL", order: "publishedAt:id:desc" };
    const cursor = query.cursor !== undefined ? decodeCursor(query.cursor, context) : null;
    return this.prisma.$transaction(async (tx) => {
      const now = await pollServerNow(tx);
      const conditions: Prisma.PollWhereInput[] = [
        this.access.visiblePublishedPollWhere(userId),
        {
          authorId: { not: userId }, status: "OPEN", closesAt: { gt: now }, publishedAt: { lte: now },
          audienceGender: "ANY", audienceAgeBand: null, styleMatchRequired: false,
          votes: { none: { voterId: userId } },
        },
      ];
      if (query.scope === FeedScope.FRIENDS) conditions.push({ author: this.access.acceptedFriendWhere(userId) });
      if (query.category) conditions.push({ category: query.category });
      // Ortak cursor alanının adı createdAt; bu kaynakta sıralama anahtarı publishedAt taşınır.
      if (cursor) conditions.push({ OR: [
        { publishedAt: { lt: new Date(cursor.createdAt) } },
        { publishedAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ] });
      const rows = await tx.poll.findMany({
        where: { AND: conditions }, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: query.limit + 1,
        include: {
          ...pollDetailInclude,
          saves: { where: { userId }, select: { userId: true } },
          _count: { select: {
            votes: true,
            comments: { where: { contentStatus: "VISIBLE", author: this.access.activeUnblockedUserWhere(userId) } },
          } },
        },
      });
      const page = rows.slice(0, query.limit);
      const items = page.map((poll) => ({ ...presentPoll(poll, userId, now),
        totalVotes: poll._count.votes, commentCount: poll._count.comments, isSaved: poll.saves.length > 0,
      }));
      const last = page.at(-1);
      return { items, serverNow: now, nextCursor: rows.length > query.limit && last
        ? encodeCursor({ id: last.id, createdAt: last.publishedAt!.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }
}
