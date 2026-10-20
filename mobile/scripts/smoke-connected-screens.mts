import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  apiBaseUrl,
  apiFetch,
  apiRequest,
  ApiError,
} from "../src/lib/api/client";
import { SessionManager } from "../src/features/auth/session-manager";
import { uploadMedia, acceptPreview } from "../src/features/profile/api/avatar";
import type { ApiPoll } from "../src/features/polls/api/types";

const target = new URL(apiBaseUrl ?? "http://127.0.0.1:3000/v1");
assert.ok(
  apiBaseUrl &&
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
    target.pathname === "/v1",
  "Yalnız açıkça seçilmiş yerel API ile çalıştır.",
);
const clients: SessionManager[] = [];
const suffix = randomBytes(5).toString("hex");
const json = (method: string, body?: unknown, key?: string) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  ...(key ? { headers: { "Idempotency-Key": key } } : {}),
});
async function person(letter: string) {
  const client = new SessionManager(apiFetch, {
    read: async () => null,
    write: async () => {},
  });
  clients.push(client);
  const input = {
    username: `connect_${suffix}_${letter}`,
    email: `connect_${suffix}_${letter}@example.test`,
    displayName: `Bağlantı ${letter}`,
    password: randomBytes(6).toString("base64url"),
  };
  await apiRequest("/auth/register", json("POST", input));
  await client.login(input.email, input.password);
  assert.ok(client.state.me);
  return { client, id: client.state.me.user.id, username: input.username };
}
try {
  const a = await person("a"),
    b = await person("b");
  const search = await a.client.request<{ items: { user: { id: string } }[] }>(
    `/users/search?q=${b.username}&limit=20`,
  );
  assert.equal(search.items[0]?.user.id, b.id);
  await a.client.request(
    "/friend-requests",
    json("POST", { targetUserId: b.id }),
  );
  await b.client.request(`/friend-requests/${a.id}/accept`, json("POST"));
  assert.equal(
    (await a.client.request<{ state: string }>(`/users/${b.id}/relationship`))
      .state,
    "FRIENDS",
  );
  await a.client.request(
    "/me",
    json("PATCH", { bio: "Mobil bağlantı kontrolü" }),
  );
  assert.equal(
    (await a.client.request<{ profile: { bio: string } }>("/me")).profile.bio,
    "Mobil bağlantı kontrolü",
  );
  await a.client.request(
    "/me/settings",
    json("PATCH", {
      defaultPollVisibility: "FRIENDS",
      defaultCommentsEnabled: false,
    }),
  );
  await a.client.request(
    "/me/private",
    json("PATCH", {
      analyticsConsent: true,
      gender: "WOMAN",
      ageBand: "AGE_18_24",
      cityCode: "TR-34",
    }),
  );
  assert.equal(
    (await a.client.request<{ gender: string }>("/me/private")).gender,
    "WOMAN",
  );
  console.log(
    "PASS kişiler, arkadaşlık, profil, paylaşım ve gizlilik tercihleri.",
  );

  const bytes = await readFile(
    new URL("../assets/images/defile/autumn-layers.jpg", import.meta.url),
  );
  async function media(client: SessionManager, purpose: "POLL" | "GAME") {
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const asset = await uploadMedia(
      client,
      blob,
      blob.size,
      blob.type,
      purpose,
    );
    assert.ok(asset.displayPath);
    const preview = await client.response(asset.displayPath as `/${string}`);
    assert.ok((await preview.arrayBuffer()).byteLength > 0);
    await acceptPreview(client, asset.id);
    return asset.id;
  }
  const options = [];
  for (let position = 1; position <= 2; position++)
    options.push({ position, mediaId: await media(a.client, "POLL") });
  const draft = await a.client.request<ApiPoll>(
    "/polls",
    json(
      "POST",
      {
        question: `Bağlantı kontrolü ${suffix}`,
        category: "OUTFIT",
        durationSeconds: 1800,
        visibility: "FRIENDS",
        commentsEnabled: true,
        options,
      },
      randomUUID(),
    ),
  );
  await a.client.request(
    `/polls/${draft.id}/publish`,
    json("POST", { expectedVersion: draft.version }, randomUUID()),
  );
  let poll = await a.client.request<ApiPoll>(`/polls/${draft.id}`);
  const own = await a.client.request<{
    items: { id: string; thumbnailPath: string | null }[];
  }>("/me/polls?limit=20");
  assert.ok(own.items.some((row) => row.id === poll.id && row.thumbnailPath));
  await b.client.request(
    `/polls/${poll.id}/vote`,
    json("PUT", { optionId: poll.options[0].id }),
  );
  await b.client.request(
    `/polls/${poll.id}/reason`,
    json("PUT", { reason: "COLOR_HARMONY" }),
  );
  assert.equal(
    (await b.client.request<{ myReason: string }>(`/polls/${poll.id}/reasons`))
      .myReason,
    "COLOR_HARMONY",
  );
  const comment = await b.client.request<{ id: string }>(
    `/polls/${poll.id}/comments`,
    json("POST", { body: "Gerçek mobil yorum kontrolü" }, randomUUID()),
  );
  await a.client.request(
    "/reports",
    json("POST", {
      targetType: "COMMENT",
      targetId: comment.id,
      reason: "OTHER",
      note: "Yalnız entegrasyon test yorumu.",
    }),
  );
  await b.client.request(`/polls/${poll.id}/save`, json("PUT"));
  assert.ok(
    (
      await b.client.request<{ items: { id: string }[] }>("/me/saved-polls")
    ).items.some((row) => row.id === poll.id),
  );
  poll = await a.client.request<ApiPoll>(`/polls/${poll.id}`);
  await a.client.request(
    `/polls/${poll.id}/comment-settings`,
    json(
      "PATCH",
      { expectedVersion: poll.version, commentsEnabled: false },
      randomUUID(),
    ),
  );
  assert.equal(
    (
      await b.client.request<{ canComment: boolean }>(
        `/polls/${poll.id}/comments`,
      )
    ).canComment,
    false,
  );
  console.log(
    "PASS medya, yayın, profil grid sözleşmesi, oy/neden, yorum, şikâyet, kaydetme ve yorum yönetimi.",
  );

  type Game = { id: string; version: number; phase: string; isPublic: boolean };
  const room = await a.client.request<Game>(
    "/games/lobbies",
    json(
      "POST",
      {
        themeTitle: `Bağlantı defilesi ${suffix}`,
        maxMembers: 8,
        submissionSeconds: 600,
        votingSeconds: 600,
        startsAt: null,
        isPublic: false,
      },
      randomUUID(),
    ),
  );
  const invite = await a.client.request<{ token: string }>(
    `/games/${room.id}/invite`,
    json("POST", { expectedVersion: room.version }),
  );
  await b.client.request(
    "/games/invites/preview",
    json("POST", { token: invite.token }),
  );
  await b.client.request(
    "/games/join",
    json("POST", { token: invite.token }, randomUUID()),
  );
  const current = await a.client.request<Game>(`/games/${room.id}`);
  await a.client.request(
    `/games/${room.id}/start`,
    json("POST", { expectedVersion: current.version }, randomUUID()),
  );
  for (const person of [a, b])
    await person.client.request(
      `/games/${room.id}/submission`,
      json("PUT", { mediaId: await media(person.client, "GAME") }),
    );
  const ready = await a.client.request<Game>(`/games/${room.id}`);
  await a.client.request(
    `/games/${room.id}/end-submission`,
    json("POST", { expectedVersion: ready.version }, randomUUID()),
  );
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    if (
      (await a.client.request<Game>(`/games/${room.id}`)).phase === "COMPLETED"
    )
      break;
    for (const person of [a, b]) {
      try {
        const turn = await person.client.request<{
          current: { id: string; mine: boolean; myStars: number | null } | null;
        }>(`/games/${room.id}/turn`);
        if (turn.current && !turn.current.mine && !turn.current.myStars)
          await person.client.request(
            `/games/${room.id}/submissions/${turn.current.id}/rating`,
            json("PUT", { stars: 5 }),
          );
      } catch (error) {
        if (!(error instanceof ApiError && error.code === "VOTING_CLOSED"))
          throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const results = await a.client.request<{
    official: boolean;
    items: { ratingCount: number }[];
  }>(`/games/${room.id}/results`);
  assert.equal(results.official, false);
  assert.equal(results.items.length, 2);
  assert.ok(results.items.every((row) => row.ratingCount === 1));
  assert.ok(
    (
      await a.client.request<{ items: Game[] }>("/me/games?limit=20")
    ).items.some((game) => game.id === room.id),
  );
  await a.client.request("/me/league");
  console.log(
    "PASS QR daveti, katılım, başlatma, fotoğraf, erken bitirme, yıldızlar, sonuç ve geçmiş.",
  );

  const notifications = await a.client.request<{
    serverNow: string;
    unreadCount: number;
  }>("/me/notifications?limit=20");
  await a.client.request(
    "/me/notifications/read-all",
    json("POST", { before: notifications.serverNow }),
  );
  await a.client.request(`/blocks/${b.id}`, json("PUT"));
  await assert.rejects(
    a.client.request(`/users/${b.id}`),
    (error: ApiError) => error.status === 404,
  );
  await a.client.request(`/blocks/${b.id}`, json("DELETE"));
  await a.client.request(`/users/${b.id}`);
  console.log(
    "PASS bildirim okuma, engelleme ve engeli kaldırma. Tüm bağlı ekran sözleşmeleri geçti.",
  );
} finally {
  for (const client of clients)
    if (client.state.session) await client.logout().catch(() => {});
}
