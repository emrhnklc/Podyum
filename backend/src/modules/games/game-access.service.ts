import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { GameSession, Prisma } from "../../generated/prisma/client.js";
import { SocialAccessService } from "../social/social-access.service.js";

export const gameMissing = () => new ApiError(404, "RESOURCE_NOT_FOUND", "Oyun bulunamadı.");

@Injectable()
export class GameAccessService {
  constructor(private readonly social: SocialAccessService) {}

  visibleSessionWhere(userId: string): Prisma.GameSessionWhereInput {
    return { members: { some: { userId, status: "ACTIVE", user: { status: "ACTIVE" } } }, ...this.hostVisibleWhere(userId) };
  }

  hostVisibleWhere(userId: string): Prisma.GameSessionWhereInput {
    return { OR: [
      { kind: "DAILY" }, { host: this.social.activeUnblockedUserWhere(userId) },
    ] };
  }

  async requireMember(tx: Prisma.TransactionClient, userId: string, session: GameSession) {
    if (!await tx.gameSession.count({ where: { id: session.id, ...this.visibleSessionWhere(userId) } })) throw gameMissing();
    return tx.gameMembership.findUniqueOrThrow({ where: { sessionId_userId: { sessionId: session.id, userId } } });
  }

  eligibleSubmissionWhere(userId: string): Prisma.GameSubmissionWhereInput {
    return { status: "FROZEN", member: { status: "ACTIVE", user: this.social.activeUnblockedUserWhere(userId) },
      media: { status: "READY", previewAcceptedAt: { not: null } } };
  }

  async mayReadMedia(tx: Prisma.TransactionClient, viewerId: string, mediaId: string) {
    return await tx.gameSubmission.count({ where: {
      mediaId, ...this.eligibleSubmissionWhere(viewerId),
      session: { ...this.visibleSessionWhere(viewerId), phase: { in: ["VOTING", "COMPLETED"] } },
    } }) > 0;
  }
}
