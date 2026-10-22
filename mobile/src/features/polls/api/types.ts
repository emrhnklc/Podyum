import type { PollCategory } from "@/constants/poll-categories";
export type PollAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
};
export type ProductTag = {
  id: string;
  title: string;
  brand: string | null;
  priceMinor: number | null;
  currency: string;
  externalUrl: string;
  source: "USER_ENTERED" | "CATALOG";
  catalogProductId: string | null;
  catalogSnapshot: {
    id: string;
    version: number;
    capturedAt: string;
    source: string;
  } | null;
  priceRecordedAt: string | null;
};
export type PollOption = {
  id: string;
  position: number;
  label: string;
  media: { displayPath: string | null; thumbnailPath: string | null };
  products: ProductTag[];
};
export type ApiPoll = {
  id: string;
  author: PollAuthor;
  question: string;
  category: PollCategory;
  occasion: string | null;
  effectiveStatus: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  contentStatus: "VISIBLE" | "HIDDEN" | "REMOVED";
  commentsEnabled: boolean;
  version: number;
  serverNow: string;
  closesAt: string | null;
  remainingSeconds: number;
  isOwner: boolean;
  canVote: boolean;
  canViewResults: boolean;
  canCancel?: boolean;
  canEditDraft?: boolean;
  myOptionId: string | null;
  options: PollOption[];
  totalVotes?: number;
  commentCount?: number;
  isSaved?: boolean;
  likeCount?: number;
  isLiked?: boolean;
  // En çok oy alan seçenek; yalnız sonucu görebilen izleyiciye gelir.
  coverOptionId?: string | null;
};
export type PollResults = {
  pollId: string;
  status: string;
  isFinal: boolean;
  totalVotes: number;
  myOptionId: string | null;
  options: { id: string; label: string; votes: number; percentage: number }[];
};
export type FeedPage = {
  items: ApiPoll[];
  serverNow: string;
  nextCursor: string | null;
};
export type ApiComment = {
  id: string;
  pollId: string;
  body: string;
  createdAt: string;
  author: PollAuthor;
  isMine: boolean;
  canRemove: boolean;
};
export type CommentPage = {
  items: ApiComment[];
  commentsEnabled: boolean;
  canComment: boolean;
  nextCursor: string | null;
  serverNow: string;
};
