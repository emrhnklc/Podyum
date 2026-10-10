import type { Prisma } from "../../generated/prisma/client.js";
import type { SocialAccessService } from "../social/social-access.service.js";
import { pollDetailInclude, presentPoll } from "./poll-read-model.js";

// Liste kartı: detay sunumu + izleyiciye özel tercih/kayıt durumu ve sayaçlar.
// Akış, kaydedilenler ve profil listeleri aynı kartı kullanır.
export function pollCardInclude(access: SocialAccessService, viewerId: string) {
  return {
    ...pollDetailInclude,
    saves: { where: { userId: viewerId }, select: { createdAt: true } },
    votes: { where: { voterId: viewerId }, select: { optionId: true } },
    _count: { select: {
      votes: true,
      comments: { where: { contentStatus: "VISIBLE" as const, author: access.activeUnblockedUserWhere(viewerId) } },
    } },
  } satisfies Prisma.PollInclude;
}

type PollCardRow = Prisma.PollGetPayload<{ include: ReturnType<typeof pollCardInclude> }>;

// Yalnız yetkilendirilmiş kayıtları sunar; erişim kontrolü çağıran servistedir.
export function presentPollCard(poll: PollCardRow, viewerId: string, now: Date) {
  return {
    ...presentPoll(poll, viewerId, now, poll.votes[0]?.optionId ?? null),
    totalVotes: poll._count.votes, commentCount: poll._count.comments, isSaved: poll.saves.length > 0,
  };
}
