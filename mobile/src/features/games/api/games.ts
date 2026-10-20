import * as Crypto from "expo-crypto";
import type { SessionManager } from "@/features/auth/session-manager";
import { acceptPreview, uploadMedia } from "@/features/profile/api/avatar";
import { readPhoto, type PickedPhoto } from "@/features/polls/api/publish-poll";

export type GamePhase =
  "SCHEDULED" | "WAITING" | "SUBMISSION" | "VOTING" | "COMPLETED" | "CANCELLED";

export type GameSummary = {
  id: string;
  kind: "DAILY" | "PRIVATE";
  phase: GamePhase;
  themeTitle: string;
  version: number;
  maxMembers: number | null;
  isPublic: boolean;
  submissionSeconds: number;
  votingSeconds: number;
  startsAt: string | null;
  votingStartsAt: string | null;
  phaseEndsAt: string | null;
  serverNow: string;
  remainingSeconds: number;
  cancelReason: string | null;
};

export type GameState = GameSummary & {
  membershipStatus: string;
  memberCount: number;
  submissionCount: number;
  isHost: boolean;
  canSubmit: boolean;
  canVote: boolean;
  mySubmission: { id: string; mediaId: string; status: string } | null;
};

export const getGame = (client: SessionManager, id: string) =>
  client.request<GameState>(`/games/${id}`);

export const joinOpen = (client: SessionManager, id: string) =>
  client.request<GameState>(`/games/${id}/join`, {
    method: "POST",
    headers: { "Idempotency-Key": Crypto.randomUUID() },
    body: "{}",
  });

// Hızlı eşleş: önce günün defilesi, yoksa yer olan herkese açık bir oda.
// Katılınacak bir şey yoksa null döner.
export async function quickMatch(client: SessionManager) {
  const daily = await client.request<{
    scheduleConfigured: boolean;
    event: GameSummary | null;
  }>("/games/daily");
  if (daily.event && ["SCHEDULED", "SUBMISSION"].includes(daily.event.phase))
    return joinOpen(client, daily.event.id);
  const rooms = await client.request<GameSummary[]>("/games/open");
  return rooms.length ? joinOpen(client, rooms[0].id) : null;
}

export type LobbyInput = {
  themeTitle: string;
  maxMembers: number;
  submissionSeconds: number;
  votingSeconds: number;
  startsAt: string | null;
  isPublic: boolean;
};

export const createLobby = (
  client: SessionManager,
  input: LobbyInput,
  key: string,
) =>
  client.request<GameState>("/games/lobbies", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(input),
  });

export type GameInvite = { token: string; deepLink: string; expiresAt: string };

// Yeni davet eskisini geçersiz kılar; ham token yalnız bu yanıtta görünür.
export const rotateInvite = (client: SessionManager, game: GameState) =>
  client.request<GameInvite>(`/games/${game.id}/invite`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: game.version }),
  });

export const previewInvite = (client: SessionManager, token: string) =>
  client.request<GameSummary>("/games/invites/preview", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const joinByInvite = (client: SessionManager, token: string) =>
  client.request<GameState>("/games/join", {
    method: "POST",
    headers: { "Idempotency-Key": Crypto.randomUUID() },
    body: JSON.stringify({ token }),
  });

export const startNow = (client: SessionManager, game: GameState) =>
  client.request<GameState>(`/games/${game.id}/start`, {
    method: "POST",
    headers: { "Idempotency-Key": Crypto.randomUUID() },
    body: JSON.stringify({ expectedVersion: game.version }),
  });

export const endSubmission = (client: SessionManager, game: GameState) =>
  client.request<GameState>(`/games/${game.id}/end-submission`, {
    method: "POST",
    headers: { "Idempotency-Key": Crypto.randomUUID() },
    body: JSON.stringify({ expectedVersion: game.version }),
  });

export const leaveGame = (client: SessionManager, game: GameState) =>
  client.request(`/games/${game.id}/leave`, {
    method: "POST",
    headers: { "Idempotency-Key": Crypto.randomUUID() },
    body: "{}",
  });

// Önce sunucudaki son görüntü gösterilir; teslim ayrı kullanıcı onayıyla yapılır.
export async function prepareGamePhoto(
  client: SessionManager,
  photo: PickedPhoto,
) {
  const { file, byteSize, mimeType } = await readPhoto(photo);
  return uploadMedia(client, file, byteSize, mimeType, "GAME");
}

export async function submitPreparedGamePhoto(
  client: SessionManager,
  gameId: string,
  mediaId: string,
) {
  await acceptPreview(client, mediaId);
  return client.request<{ mediaId: string }>(`/games/${gameId}/submission`, {
    method: "PUT",
    body: JSON.stringify({ mediaId }),
  });
}

export type BallotCard = {
  id: string;
  number: number;
  mediaId: string;
  displayPath: string;
};

// Değerlendirme tek ve değişmezdir; son oy ise sonuçlar hemen açılabilir.
export const rateSubmission = (
  client: SessionManager,
  id: string,
  submissionId: string,
  stars: number,
) =>
  client.request(`/games/${id}/submissions/${submissionId}/rating`, {
    method: "PUT",
    body: JSON.stringify({ stars }),
  });

export type LeagueInfo = {
  name: string;
  nextName: string | null;
  current: number;
  span: number | null;
  remaining: number | null;
};

export type GameResultItem = BallotCard & {
  rank: number;
  awardedPoints: number;
  ratingCount: number;
  averageStars: number | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarPath: string | null;
  };
};

export type GameResults = GameSummary & {
  // true: herkese açık defile, lig puanı verilir. false: davetli oda.
  official: boolean;
  awardedPoints: number;
  myRank: number | null;
  totalPoints: number | null;
  league: LeagueInfo | null;
  items: GameResultItem[];
};

export const getResults = (client: SessionManager, id: string) =>
  client.request<GameResults>(`/games/${id}/results?limit=50`);

export const sendFriendRequest = (client: SessionManager, userId: string) =>
  client.request("/friend-requests", {
    method: "POST",
    body: JSON.stringify({ targetUserId: userId }),
  });

export type GameTurn = {
  index: number;
  total: number;
  turnSeconds: number;
  cycle: number;
  votingEndsAt: string;
  remainingSeconds: number;
  serverNow: string;
  turnEndsAt: string;
  current: (BallotCard & { mine: boolean; myStars: number | null }) | null;
  votedCount: number;
  voterCount: number;
  myTurnIn: number | null;
  nextNumber: number | null;
};

// Podyum Turu: o an herkese gösterilen yarışmacı.
export const getTurn = (client: SessionManager, id: string) =>
  client.request<GameTurn>(`/games/${id}/turn`);
