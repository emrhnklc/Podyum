import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { decodeCursor, encodeCursor, type CursorPosition } from "../../common/pagination/cursor.js";
import type { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { canonicalPair, relationshipState, SocialAccessService, userNotFound } from "./social-access.service.js";
import type { FriendRequestsQueryDto, UserSearchQueryDto } from "./dto/social.dto.js";

type Transaction = Prisma.TransactionClient;
const summarySelect = { id: true, username: true, displayName: true } as const;
type ChangeReason = "REQUESTED" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "REMOVED" | "BLOCKED" | "UNBLOCKED";

function requestNotFound() { return new ApiError(404, "RESOURCE_NOT_FOUND", "Arkadaşlık isteği bulunamadı."); }

function relationshipSeek(viewerId: string, cursor?: CursorPosition): Prisma.FriendshipWhereInput {
  if (!cursor) return {};
  const createdAt = new Date(cursor.createdAt);
  const { userAId, userBId } = canonicalPair(viewerId, cursor.id);
  return { OR: [
    { createdAt: { lt: createdAt } },
    { createdAt, userAId: { lt: userAId } },
    { createdAt, userAId, userBId: { lt: userBId } },
  ] };
}

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService, private readonly access: SocialAccessService) {}

  private async lockUsers(tx: Transaction, actorId: string, targetId: string) {
    for (const userId of [actorId, targetId].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    }
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { status: true } });
    if (actor?.status === "SUSPENDED") throw new ApiError(403, "ACCOUNT_SUSPENDED", "Hesap askıya alınmış.");
    if (actor?.status !== "ACTIVE") throw new ApiError(401, "INVALID_SESSION", "Oturum geçersiz veya süresi dolmuş.");
  }

  private mutate<T>(actorId: string, targetId: string, work: (tx: Transaction) => Promise<T>, visible = true) {
    if (actorId === targetId) throw new ApiError(400, "SELF_RELATIONSHIP_NOT_ALLOWED", "Bu işlemi kendinle yapamazsın.");
    return this.prisma.$transaction(async (tx) => {
      await this.lockUsers(tx, actorId, targetId);
      if (visible) await this.access.requireUserAccess(tx, actorId, targetId);
      return work(tx);
    });
  }

  private async changed(tx: Transaction, actorId: string, targetId: string, reason: ChangeReason) {
    for (const userId of [actorId, targetId].sort()) {
      const user = await tx.user.update({ where: { id: userId }, data: { socialRevision: { increment: 1 } }, select: { socialRevision: true } });
      await tx.outboxEvent.create({ data: {
        aggregateType: "user-social", aggregateId: userId, aggregateVersion: user.socialRevision,
        type: "social.relationship.changed",
        payload: { schemaVersion: 1, userId, otherUserId: userId === actorId ? targetId : actorId, actorId, reason, revision: user.socialRevision },
      } });
    }
  }

  relationship(viewerId: string, targetId: string) {
    return this.prisma.$transaction(async (tx) => ({ userId: targetId, state: (await this.access.requireUserAccess(tx, viewerId, targetId)).state }), { isolationLevel: "RepeatableRead" });
  }

  request(actorId: string, targetId: string) {
    return this.mutate(actorId, targetId, async (tx) => {
      const pair = canonicalPair(actorId, targetId);
      const row = await tx.friendship.findUnique({ where: { userAId_userBId: pair } });
      if (row?.status === "ACCEPTED") return { userId: targetId, state: "FRIENDS" as const };
      if (row?.status === "PENDING") {
        if (row.requesterId !== actorId) throw new ApiError(409, "INCOMING_REQUEST_EXISTS", "Gelen isteği kabul et veya reddet.");
        return { userId: targetId, state: "OUTGOING_REQUEST" as const };
      }
      await tx.friendship.upsert({ where: { userAId_userBId: pair },
        create: { ...pair, requesterId: actorId },
        update: { requesterId: actorId, status: "PENDING", createdAt: new Date() },
      });
      await this.changed(tx, actorId, targetId, "REQUESTED");
      return { userId: targetId, state: "OUTGOING_REQUEST" as const };
    });
  }

  accept(actorId: string, requesterId: string) {
    return this.mutate(actorId, requesterId, async (tx) => {
      const pair = canonicalPair(actorId, requesterId);
      const row = await tx.friendship.findUnique({ where: { userAId_userBId: pair } });
      if (!row) throw requestNotFound();
      if (row.requesterId === actorId) throw new ApiError(409, "REQUEST_NOT_INCOMING", "Yalnızca gelen isteği kabul edebilirsin.");
      if (row.status === "ACCEPTED") return { userId: requesterId, state: "FRIENDS" as const };
      if (row.status !== "PENDING") throw requestNotFound();
      await tx.friendship.update({ where: { userAId_userBId: pair }, data: { status: "ACCEPTED" } });
      await this.changed(tx, actorId, requesterId, "ACCEPTED");
      return { userId: requesterId, state: "FRIENDS" as const };
    });
  }

  decline(actorId: string, requesterId: string) {
    return this.mutate(actorId, requesterId, async (tx) => {
      const pair = canonicalPair(actorId, requesterId);
      const row = await tx.friendship.findUnique({ where: { userAId_userBId: pair } });
      if (!row) throw requestNotFound();
      if (row.requesterId === actorId) throw new ApiError(409, "REQUEST_NOT_INCOMING", "Yalnızca gelen isteği reddedebilirsin.");
      if (row.status === "ACCEPTED") throw new ApiError(409, "FRIENDSHIP_ALREADY_ACCEPTED", "Arkadaşlığı kaldırma işlemini kullan.");
      if (row.status !== "DECLINED") {
        await tx.friendship.update({ where: { userAId_userBId: pair }, data: { status: "DECLINED" } });
        await this.changed(tx, actorId, requesterId, "DECLINED");
      }
      return { userId: requesterId, state: "NONE" as const };
    });
  }

  cancel(actorId: string, targetId: string) {
    return this.mutate(actorId, targetId, async (tx) => {
      const pair = canonicalPair(actorId, targetId);
      const row = await tx.friendship.findUnique({ where: { userAId_userBId: pair } });
      if (!row) return { userId: targetId, state: "NONE" as const };
      if (row.status === "ACCEPTED") throw new ApiError(409, "FRIENDSHIP_ALREADY_ACCEPTED", "Arkadaşlığı kaldırma işlemini kullan.");
      if (row.requesterId !== actorId) throw new ApiError(409, "REQUEST_NOT_OUTGOING", "Yalnızca gönderdiğin isteği iptal edebilirsin.");
      await tx.friendship.delete({ where: { userAId_userBId: pair } });
      if (row.status === "PENDING") await this.changed(tx, actorId, targetId, "CANCELLED");
      return { userId: targetId, state: "NONE" as const };
    });
  }

  removeFriend(actorId: string, targetId: string) {
    return this.mutate(actorId, targetId, async (tx) => {
      const pair = canonicalPair(actorId, targetId);
      const row = await tx.friendship.findUnique({ where: { userAId_userBId: pair } });
      if (row?.status === "PENDING") throw new ApiError(409, "FRIENDSHIP_NOT_ACCEPTED", "Bekleyen istek için iptal veya red işlemini kullan.");
      if (row?.status === "ACCEPTED") {
        await tx.friendship.delete({ where: { userAId_userBId: pair } });
        await this.changed(tx, actorId, targetId, "REMOVED");
      }
      return { userId: targetId, state: "NONE" as const };
    });
  }

  block(actorId: string, targetId: string) {
    return this.mutate(actorId, targetId, async (tx) => {
      if (!await tx.user.findUnique({ where: { id: targetId, status: "ACTIVE" }, select: { id: true } })) throw userNotFound();
      const where = { blockerId_blockedId: { blockerId: actorId, blockedId: targetId } };
      const existing = await tx.block.findUnique({ where });
      if (!existing) await tx.block.create({ data: { blockerId: actorId, blockedId: targetId } });
      const removed = await tx.friendship.deleteMany({ where: canonicalPair(actorId, targetId) });
      if (!existing || removed.count > 0) await this.changed(tx, actorId, targetId, "BLOCKED");
      return { blockedUserId: targetId, blocked: true };
    }, false);
  }

  unblock(actorId: string, targetId: string) {
    return this.mutate(actorId, targetId, async (tx) => {
      const removed = await tx.block.deleteMany({ where: { blockerId: actorId, blockedId: targetId } });
      if (removed.count > 0) await this.changed(tx, actorId, targetId, "UNBLOCKED");
      return { blockedUserId: targetId, blocked: false };
    }, false);
  }

  search(viewerId: string, query: UserSearchQueryDto) {
    const context = { kind: "user-search", viewerId, q: query.q };
    const cursor = query.cursor ? decodeCursor(query.cursor, context) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.user.findMany({ where: {
        ...this.access.activeUnblockedUserWhere(viewerId), id: { not: viewerId }, username: { startsWith: query.q.replaceAll("_", "\\_") },
        ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }] } : {}),
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1,
      select: { ...summarySelect, createdAt: true,
        friendshipsA: { where: { userBId: viewerId }, select: { status: true, requesterId: true } },
        friendshipsB: { where: { userAId: viewerId }, select: { status: true, requesterId: true } },
      } });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return { items: page.map(({ createdAt, friendshipsA, friendshipsB, ...user }) => ({ user, createdAt, relationship: relationshipState(viewerId, friendshipsA[0] ?? friendshipsB[0]) })),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }

  friends(viewerId: string, query: PageQueryDto) { return this.listRelationships(viewerId, query, "ACCEPTED"); }
  requests(viewerId: string, query: FriendRequestsQueryDto) { return this.listRelationships(viewerId, query, "PENDING", query.direction); }

  private listRelationships(viewerId: string, query: PageQueryDto, status: "ACCEPTED" | "PENDING", direction?: "incoming" | "outgoing") {
    const context = { kind: "relationships", viewerId, status, direction: direction ?? null };
    const cursor = query.cursor ? decodeCursor(query.cursor, context) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const otherUser = this.access.activeUnblockedUserWhere(viewerId);
      const rows = await tx.friendship.findMany({ where: { status,
        ...(direction ? { requesterId: direction === "outgoing" ? viewerId : { not: viewerId } } : {}),
        AND: [{ OR: [{ userAId: viewerId, userB: otherUser }, { userBId: viewerId, userA: otherUser }] }, relationshipSeek(viewerId, cursor)],
      }, orderBy: [{ createdAt: "desc" }, { userAId: "desc" }, { userBId: "desc" }], take: query.limit + 1,
      select: { userAId: true, userBId: true, requesterId: true, status: true, createdAt: true, userA: { select: summarySelect }, userB: { select: summarySelect } } });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      const other = (row: typeof rows[number]) => row.userAId === viewerId ? row.userB : row.userA;
      return { items: page.map((row) => ({ user: other(row), createdAt: row.createdAt, relationship: relationshipState(viewerId, row) })),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: other(last).id, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }

  blocks(viewerId: string, query: PageQueryDto) {
    const context = { kind: "blocks", viewerId };
    const cursor = query.cursor ? decodeCursor(query.cursor, context) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.block.findMany({ where: { blockerId: viewerId,
        ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), blockedId: { lt: cursor.id } }] } : {}),
      }, orderBy: [{ createdAt: "desc" }, { blockedId: "desc" }], take: query.limit + 1,
      select: { blockedId: true, createdAt: true, blocked: { select: { ...summarySelect, status: true } } } });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return { items: page.map(({ blockedId, createdAt, blocked: { status, ...user } }) => ({ blockedUserId: blockedId, createdAt, user: status === "ACTIVE" ? user : null })),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ id: last.blockedId, createdAt: last.createdAt.toISOString() }, context) : null };
    }, { isolationLevel: "RepeatableRead" });
  }
}
