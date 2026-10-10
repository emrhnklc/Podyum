import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { createDb } from "../src/database/prisma-client.js";
import { readEnvironment } from "../src/common/config/environment.js";
import { SessionManager } from "../../mobile/src/features/auth/session-manager.js";
import { apiFetch, apiRequest, apiBaseUrl } from "../../mobile/src/lib/api/client.js";
import type { Session } from "../../mobile/src/features/auth/types.js";

type Account = { email: string; password: string; userId: string };
type Fixture = { viewer: Account; author: Account; pollIds: string[] };
const url = new URL(apiBaseUrl ?? "http://127.0.0.1:3000/v1");
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/v1") throw new Error("Önizleme yalnız yerel API'de /v1 adresine çalışır.");
if (!apiBaseUrl) throw new Error("EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/v1 ile çalıştır.");
await assertProjectDatabase();
const env = readEnvironment();
const directory = resolve(".local");
const configPath = resolve(directory, "mobile-preview.json");
const db = createDb();
const request = <T = any>(path: `/${string}`, token?: string, method = "GET", body?: unknown, key?: string) => apiRequest<T>(path, { method, accessToken: token, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(key ? { headers: { "Idempotency-Key": key } } : {}) });
const login = (account: Account) => request<Session>("/auth/login", undefined, "POST", { email: account.email, password: account.password });
async function account(kind: string): Promise<Account> {
  const suffix = randomBytes(4).toString("hex");
  const email = `preview_${kind}_${suffix}@example.test`, password = randomBytes(20).toString("base64url");
  await request("/auth/register", undefined, "POST", { email, password, username: `preview_${kind}_${suffix}`, displayName: kind === "viewer" ? "Önizleme" : "Podyum Stil" });
  let token: string | null = null;
  for (const name of await readdir(resolve(env.localMailboxDir))) {
    if (!name.endsWith(".json")) continue;
    const mail = JSON.parse(await readFile(resolve(env.localMailboxDir, name), "utf8"));
    if (mail.email === email && mail.kind === "VERIFY_EMAIL") token = mail.token;
  }
  if (!token) throw new Error("Önizleme doğrulama postası bulunamadı.");
  await request("/auth/email-verification/confirm", undefined, "POST", { token });
  const session = await request<Session>("/auth/login", undefined, "POST", { email, password });
  const me = await request("/auth/me", session.accessToken);
  await request("/auth/logout", session.accessToken, "POST");
  return { email, password, userId: me.user.id };
}
async function upload(token: string, file: string) {
  const bytes = await readFile(resolve("../mobile/assets/images/auth", file));
  const grant = await request("/media/uploads", token, "POST", { purpose: "POLL", mimeType: "image/jpeg", byteSize: bytes.length, blurRequested: false });
  const form = new FormData(); form.append("file", new Blob([bytes], { type: "image/jpeg" }), file);
  await apiFetch(grant.upload.path, { method: "POST", accessToken: token, headers: { "X-Upload-Token": grant.upload.token }, body: form });
  await request(`/media/${grant.asset.id}/complete`, token, "POST", {});
  await request(`/media/${grant.asset.id}/accept-preview`, token, "POST", { confirmed: true });
  return grant.asset.id as string;
}

try {
  let fixture: Fixture | null = null;
  try { fixture = JSON.parse(await readFile(configPath, "utf8")); } catch { /* İlk çalıştırma. */ }
  if (fixture && await db.user.count({ where: { id: { in: [fixture.viewer.userId, fixture.author.userId] }, status: "ACTIVE" } }) !== 2) throw new Error("Önizleme hesapları değişmiş; kayıt dosyasını inceleyip yeni fixture oluştur.");
  if (!fixture) {
    fixture = { viewer: await account("viewer"), author: await account("author"), pollIds: [] };
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(configPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  }
  const viewer = await login(fixture.viewer), author = await login(fixture.author);
  const pair = [fixture.viewer.userId, fixture.author.userId].sort();
  const friendship = await db.friendship.findUnique({ where: { userAId_userBId: { userAId: pair[0], userBId: pair[1] } } });
  if (!friendship) {
    await request("/friend-requests", author.accessToken, "POST", { targetUserId: fixture.viewer.userId });
    await request(`/friend-requests/${fixture.author.userId}/accept`, viewer.accessToken, "POST");
  } else assert.equal(friendship.status, "ACCEPTED", "Mevcut ilişkiyi keyfî değiştirme; önizleme hesaplarını kontrol et.");
  const feed = await request("/feed?scope=friends&limit=50", viewer.accessToken);
  const available = feed.items.filter((poll: any) => fixture!.pollIds.includes(poll.id)).length;
  if (available < 3) {
    const mediaA = await upload(author.accessToken, "woman.jpg"), mediaB = await upload(author.accessToken, "man.jpg");
    for (let index = available; index < 3; index++) {
      const poll = await request("/polls", author.accessToken, "POST", {
        question: ["Akşam için hangi kombin?", "Hafta sonu stilin hangisi?", "Arkadaşlar, hangisini seçelim?"][index],
        category: ["OUTFIT", "SHOES", "BAG"][index], visibility: index === 2 ? "FRIENDS" : "PUBLIC", durationSeconds: 86400,
        options: [{ position: 1, mediaId: mediaA, products: [{ title: "Örnek kombin A", brand: "Önizleme", priceMinor: 125000, currency: "TRY", externalUrl: "https://example.com/preview/a" }] }, { position: 2, mediaId: mediaB, products: [{ title: "Örnek kombin B", externalUrl: "https://example.com/preview/b" }] }],
      }, randomUUID());
      await request(`/polls/${poll.id}/publish`, author.accessToken, "POST", { expectedVersion: poll.version }, randomUUID());
      fixture.pollIds.push(poll.id);
      await writeFile(configPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
    }
  }
  // Gerçek mobil istemci ve oturum yöneticisiyle salt okuma entegrasyon kontrolü.
  const client = new SessionManager(apiFetch, { read: async () => null, write: async () => {} });
  await client.restore(); await client.login(fixture.viewer.email, fixture.viewer.password);
  const fresh = await client.request<any>("/feed?scope=friends&limit=50");
  const card = fresh.items.find((poll: any) => fixture!.pollIds.includes(poll.id)); assert.ok(card);
  assert.equal(card.canVote, true); assert.ok(card.options.length >= 2); assert.equal(card.myOptionId, null);
  const image = await client.response(card.options[0].media.displayPath);
  assert.ok(image.headers.get("content-type")?.includes("image/webp")); assert.ok((await image.arrayBuffer()).byteLength > 0);
  await client.logout();
  await request("/auth/logout", viewer.accessToken, "POST"); await request("/auth/logout", author.accessToken, "POST");
  console.log(JSON.stringify({ ready: true, availablePolls: fresh.items.filter((poll: any) => fixture!.pollIds.includes(poll.id)).length, loginEmail: fixture.viewer.email, credentialsFile: configPath, note: "Yalnız yeni yerel önizleme hesapları; gerçek API/medya/arkadaş akışı doğrulandı." }, null, 2));
} finally { await db.$disconnect(); }
