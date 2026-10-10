import type { Prisma } from "../../generated/prisma/client.js";
import { effectivePollStatus } from "./polls-internals.js";

export const pollDetailInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarMediaId: true } },
  options: { orderBy: { position: "asc" as const }, include: {
    media: { select: { id: true, status: true, width: true, height: true, displayKey: true, thumbnailKey: true, previewAcceptedAt: true } },
    products: { orderBy: { id: "asc" as const } },
  } },
} satisfies Prisma.PollInclude;

type PollRow = Prisma.PollGetPayload<{ include: typeof pollDetailInclude }>;

// Yalnız yetkilendirilmiş kayıtları sunar; erişim kontrolü çağıran servistedir.
export function presentPoll(poll: PollRow, viewerId: string, now: Date, myOptionId: string | null = null) {
  const status = effectivePollStatus(poll, now);
  const isOwner = poll.authorId === viewerId;
  const published = poll.contentStatus === "VISIBLE" && ["OPEN", "CLOSED"].includes(poll.status);
  const { avatarMediaId, ...author } = poll.author;
  return {
    id: poll.id, author: { ...author, avatarPath: avatarMediaId ? `/v1/media/${avatarMediaId}/content` : null },
    question: poll.question, category: poll.category, occasion: poll.occasion, visibility: poll.visibility,
    audienceGender: poll.audienceGender, audienceAgeBand: poll.audienceAgeBand, styleMatchRequired: poll.styleMatchRequired,
    commentsEnabled: poll.commentsEnabled, status: poll.status, effectiveStatus: status, contentStatus: poll.contentStatus,
    durationSeconds: poll.durationSeconds, version: poll.version, publishedAt: poll.publishedAt, closesAt: poll.closesAt, closedAt: poll.closedAt,
    createdAt: poll.createdAt, updatedAt: poll.updatedAt, serverNow: now,
    remainingSeconds: status === "OPEN" && poll.closesAt ? Math.max(0, Math.ceil((poll.closesAt.getTime() - now.getTime()) / 1000)) : 0,
    isOwner, canEditDraft: isOwner && poll.status === "DRAFT" && poll.contentStatus === "VISIBLE",
    canCancel: isOwner && (status === "DRAFT" || status === "OPEN"),
    myOptionId,
    canVote: published && status === "OPEN" && !isOwner && !myOptionId
      && poll.audienceGender === "ANY" && poll.audienceAgeBand === null && !poll.styleMatchRequired,
    canViewResults: published && (isOwner || !!myOptionId || status === "CLOSED"),
    options: poll.options.map((option) => ({
      id: option.id, position: option.position, label: String.fromCharCode(64 + option.position), mediaId: option.mediaId,
      media: { id: option.media.id, status: option.media.status, width: option.media.width, height: option.media.height,
        previewAccepted: option.media.previewAcceptedAt !== null,
        displayPath: option.media.status === "READY" && option.media.displayKey ? `/v1/media/${option.mediaId}/content` : null,
        thumbnailPath: option.media.status === "READY" && option.media.thumbnailKey ? `/v1/media/${option.mediaId}/content?variant=thumbnail` : null },
      products: option.products.map((product) => ({
        id: product.id, title: product.title, brand: product.brand, priceMinor: product.priceMinor,
        currency: product.currency, externalUrl: product.externalUrl, priceRecordedAt: product.priceRecordedAt,
        source: "USER_ENTERED" as const,
      })),
    })),
  };
}
