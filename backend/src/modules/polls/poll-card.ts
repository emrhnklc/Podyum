import type { Prisma } from "../../generated/prisma/client.js";
import type { SocialAccessService } from "../social/social-access.service.js";
import { pollDetailInclude, presentPoll } from "./poll-read-model.js";

// Liste kartı: detay sunumu + izleyiciye özel tercih/kayıt/beğeni durumu ve sayaçlar.
// Akış, kaydedilenler ve profil listeleri aynı kartı kullanır.
export function pollCardInclude(access: SocialAccessService, viewerId: string) {
  return {
    ...pollDetailInclude,
    saves: { where: { userId: viewerId }, select: { createdAt: true } },
    likes: { where: { userId: viewerId }, select: { createdAt: true } },
    votes: { where: { voterId: viewerId }, select: { optionId: true } },
    _count: { select: {
      votes: true,
      likes: { where: { user: access.activeUnblockedUserWhere(viewerId) } },
      comments: { where: { contentStatus: "VISIBLE" as const, author: access.activeUnblockedUserWhere(viewerId) } },
    } },
  } satisfies Prisma.PollInclude;
}

type PollCardRow = Prisma.PollGetPayload<{ include: ReturnType<typeof pollCardInclude> }>;

// Her oylamada en çok oy alan seçenek; eşitlikte önce gelen sıra kazanır.
// Profil kapağı içindir; sonuç görünürlüğü presentPollCard'da denetlenir.
export async function leadingOptions(tx: Prisma.TransactionClient, pollIds: string[]) {
  if (!pollIds.length) return new Map<string, string>();
  const counts = await tx.pollVote.groupBy({ by: ["pollId", "optionId"], where: { pollId: { in: pollIds } }, _count: { _all: true } });
  const options = await tx.pollOption.findMany({ where: { pollId: { in: pollIds } }, select: { id: true, pollId: true, position: true } });
  const votes = new Map(counts.map((row) => [row.optionId, row._count._all]));
  const best = new Map<string, { id: string; votes: number; position: number }>();
  for (const option of options) {
    const row = { id: option.id, votes: votes.get(option.id) ?? 0, position: option.position };
    const current = best.get(option.pollId);
    if (!current || row.votes > current.votes || (row.votes === current.votes && row.position < current.position)) best.set(option.pollId, row);
  }
  return new Map([...best].filter(([, row]) => row.votes > 0).map(([pollId, row]) => [pollId, row.id]));
}

// Yalnız yetkilendirilmiş kayıtları sunar; erişim kontrolü çağıran servistedir.
// Önde giden seçenek yalnız sonucu görebilen izleyiciye verilir.
export function presentPollCard(poll: PollCardRow, viewerId: string, now: Date, leading?: Map<string, string>) {
  const card = presentPoll(poll, viewerId, now, poll.votes[0]?.optionId ?? null);
  return {
    ...card,
    coverOptionId: card.canViewResults ? leading?.get(poll.id) ?? null : null,
    totalVotes: poll._count.votes, commentCount: poll._count.comments, isSaved: poll.saves.length > 0,
    likeCount: poll._count.likes, isLiked: poll.likes.length > 0,
  };
}
