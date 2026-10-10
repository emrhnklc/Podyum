import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { Prisma } from "../../generated/prisma/client.js";

export type RelationshipState = "SELF" | "NONE" | "OUTGOING_REQUEST" | "INCOMING_REQUEST" | "FRIENDS";

export function canonicalPair(first: string, second: string) {
  const [userAId, userBId] = [first.toLowerCase(), second.toLowerCase()].sort();
  return { userAId, userBId };
}

export function relationshipState(viewerId: string, row?: { status: string; requesterId: string } | null): RelationshipState {
  if (row?.status === "ACCEPTED") return "FRIENDS";
  if (row?.status === "PENDING") return row.requesterId === viewerId ? "OUTGOING_REQUEST" : "INCOMING_REQUEST";
  return "NONE";
}

export const userNotFound = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Kullanıcı bulunamadı.");

@Injectable()
export class SocialAccessService {
  acceptedFriendWhere(viewerId: string): Prisma.UserWhereInput {
    return { OR: [
      { friendshipsA: { some: { userBId: viewerId, status: "ACCEPTED" } } },
      { friendshipsB: { some: { userAId: viewerId, status: "ACCEPTED" } } },
    ] };
  }

  activeUnblockedUserWhere(viewerId: string): Prisma.UserWhereInput {
    return {
      status: "ACTIVE",
      blocksMade: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
    };
  }

  async requireUserAccess(tx: Prisma.TransactionClient, viewerId: string, targetId: string) {
    const target = await tx.user.findFirst({ where: { id: targetId, ...this.activeUnblockedUserWhere(viewerId) }, select: { id: true } });
    if (!target) throw userNotFound();
    if (viewerId === targetId) return { isSelf: true, isFriend: false, state: "SELF" as RelationshipState };
    const row = await tx.friendship.findUnique({ where: { userAId_userBId: canonicalPair(viewerId, targetId) }, select: { requesterId: true, status: true } });
    const state = relationshipState(viewerId, row);
    return { isSelf: false, isFriend: state === "FRIENDS", state };
  }

  visiblePublishedPollWhere(viewerId: string): Prisma.PollWhereInput {
    return {
      contentStatus: "VISIBLE",
      status: { in: ["OPEN", "CLOSED"] },
      author: this.activeUnblockedUserWhere(viewerId),
      OR: [
        { authorId: viewerId },
        { visibility: "PUBLIC" },
        { visibility: "FRIENDS", author: this.acceptedFriendWhere(viewerId) },
      ],
    };
  }

  async requirePublishedPollAccess(tx: Prisma.TransactionClient, viewerId: string, pollId: string) {
    const poll = await tx.poll.findFirst({
      where: { id: pollId, ...this.visiblePublishedPollWhere(viewerId) },
      select: { id: true, authorId: true, visibility: true, status: true },
    });
    if (!poll) throw new ApiError(404, "RESOURCE_NOT_FOUND", "Oylama bulunamadı.");
    return poll;
  }
}
