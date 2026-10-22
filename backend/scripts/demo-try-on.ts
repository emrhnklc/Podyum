import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { createDb } from "../src/database/prisma-client.js";
import { ApiError, apiFetch, apiRequest, apiBaseUrl } from "../../mobile/src/lib/api/client.js";
import type { Session } from "../../mobile/src/features/auth/types.js";

// "Üzerimde dene" yatırımcı demosu: önizleme hesabına kendi kombin fotoğrafını
// paylaşır, Zara polo ürününü kataloğa ekler ve trendlere girecek kadar oy
// toplar. Yalnız yerel geliştirme veritabanı içindir; tekrar çalıştırılabilir.
// Kullanım: npm run demo:try-on -- <kombin-fotoğrafı.jpg>

type Account = { email: string; password: string; userId: string };
type Fixture = { viewer: Account; author: Account; pollIds: string[] };
type DemoState = { admin?: Account; voters: Account[]; outfitPollId?: string; trendPollId?: string; productId?: string };

export const DEMO_PRODUCT = {
  title: "Çizgili dokulu relaxed fit polo t-shirt",
  brand: "Zara",
  url: "https://www.zara.com/tr/tr/cizgili-dokulu-relaxed-fit-polo-t-shirt-p00526325.html?v1=548761372&v2=2731450",
  externalId: "p00526325",
  variantKey: "548761372",
};
// Mobil demo eşleşmesi bu soruyu arar: aynı metin mobile/src/features/try-on/data/demo-results.ts içinde.
export const DEMO_OUTFIT_QUESTION = "Bugünkü kombinim nasıl?";
const VOTERS = 6;

const url = new URL(apiBaseUrl ?? "http://127.0.0.1:3000/v1");
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/v1") throw new Error("Demo yalnız yerel API'de /v1 adresine çalışır.");
if (process.env.NODE_ENV === "production") throw new Error("Bu araç yalnız yerel geliştirme içindir.");
const photoPath = process.argv[2];
if (!photoPath) throw new Error("Kullanım: npm run demo:try-on -- <kombin-fotoğrafı.jpg>");
await assertProjectDatabase();
const db = createDb();
const directory = resolve(".local");
const previewPath = resolve(directory, "mobile-preview.json");
const statePath = resolve(directory, "demo-try-on.json");
// Giriş uçları IP başına dakikada 30 istekle sınırlı; sınıra takılınca beklenip tekrar denenir.
async function request<T = any>(path: `/${string}`, token?: string, method = "GET", body?: unknown, key?: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiRequest<T>(path, { method, accessToken: token, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(key ? { headers: { "Idempotency-Key": key } } : {}) });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 429 || attempt >= 5) throw error;
      await new Promise((done) => setTimeout(done, 20_000));
    }
  }
}
const login = async (account: Account) => (await request<Session>("/auth/login", undefined, "POST", { email: account.email, password: account.password })).accessToken;

async function account(kind: string, displayName: string): Promise<Account> {
  const suffix = randomBytes(4).toString("hex");
  const email = `demo_${kind}_${suffix}@example.test`, password = randomBytes(20).toString("base64url");
  await request("/auth/register", undefined, "POST", { email, password, username: `demo_${kind}_${suffix}`, displayName });
  const token = await login({ email, password, userId: "" });
  const me = await request("/auth/me", token);
  await request("/auth/logout", token, "POST");
  return { email, password, userId: me.user.id };
}

async function upload(token: string, bytes: Buffer, name: string) {
  const grant = await request("/media/uploads", token, "POST", { purpose: "POLL", mimeType: "image/jpeg", byteSize: bytes.length, blurRequested: false });
  const form = new FormData(); form.append("file", new Blob([bytes], { type: "image/jpeg" }), name);
  await apiFetch(grant.upload.path, { method: "POST", accessToken: token, headers: { "X-Upload-Token": grant.upload.token }, body: form });
  await request(`/media/${grant.asset.id}/complete`, token, "POST", {});
  await request(`/media/${grant.asset.id}/accept-preview`, token, "POST", { confirmed: true });
  return grant.asset.id as string;
}

async function publish(token: string, body: unknown) {
  const poll = await request("/polls", token, "POST", body, randomUUID());
  await request(`/polls/${poll.id}/publish`, token, "POST", { expectedVersion: poll.version }, randomUUID());
  return poll.id as string;
}

try {
  const fixture: Fixture = JSON.parse(await readFile(previewPath, "utf8").catch(() => {
    throw new Error("Önce önizleme hesaplarını oluştur: npm run preview:mobile");
  }));
  let state: DemoState = { voters: [] };
  try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { /* İlk çalıştırma. */ }
  const save = async () => { await mkdir(directory, { recursive: true, mode: 0o700 }); await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 }); };

  // Katalog yönetimi ADMIN ister; yerel demo yöneticisi grant-admin ile aynı denetim kaydını yazar.
  if (!state.admin) { state.admin = await account("admin", "Demo Yönetici"); await save(); }
  const adminId = state.admin.userId;
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: adminId } });
    if (user.role === "ADMIN") return;
    await tx.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
    const audit = await tx.moderationAudit.create({ data: { action: "ROLE_GRANTED", resourceType: "USER", resourceId: adminId,
      reason: "Yerel üzerimde dene demosu", before: { role: user.role }, after: { role: "ADMIN", source: "LOCAL_DEMO" } } });
    await tx.outboxEvent.create({ data: { aggregateType: "moderation-audit", aggregateId: audit.id, aggregateVersion: 1, type: "moderation.action.applied",
      payload: { schemaVersion: 1, auditId: audit.id, action: "ROLE_GRANTED", resourceType: "USER", resourceId: adminId } } });
  });
  const admin = await login(state.admin);

  if (!state.productId) {
    const stores = await request<any>("/admin/catalog/stores", admin);
    let store = (stores.items ?? stores).find((row: any) => row.domain === "zara.com");
    if (!store) store = await request("/admin/catalog/stores", admin, "POST",
      { name: "Zara", domain: "zara.com", trackingParameters: [], reason: "Demo: kullanıcının paylaştığı ürün bağlantısı" }, randomUUID());
    // Fiyat bilinmiyor: uydurmak yerine boş bırakılır.
    const product = await request("/admin/catalog/products", admin, "POST", {
      storeId: store.id, externalId: DEMO_PRODUCT.externalId, variantKey: DEMO_PRODUCT.variantKey, title: DEMO_PRODUCT.title,
      brand: DEMO_PRODUCT.brand, category: "OUTFIT", url: DEMO_PRODUCT.url, priceMinor: null, currency: "TRY",
      reason: "Demo: kullanıcının paylaştığı ürün bağlantısı",
    }, randomUUID());
    state.productId = product.id; await save();
  }

  // Kullanıcının kendi kombini: profilde görünür, "Üzerimde dene" bunu seçer.
  const viewer = await login(fixture.viewer);
  if (!state.outfitPollId) {
    const mine = await upload(viewer, await readFile(resolve(photoPath)), "kombinim.jpg");
    const other = await upload(viewer, await readFile(resolve("../mobile/assets/images/auth/man.jpg")), "alternatif.jpg");
    state.outfitPollId = await publish(viewer, { question: DEMO_OUTFIT_QUESTION, category: "OUTFIT", visibility: "PUBLIC", durationSeconds: 86400,
      options: [{ position: 1, mediaId: mine, products: [] }, { position: 2, mediaId: other, products: [] }] });
    await save();
  }

  // Trend: ürünü içeren kombini en az 5 farklı hesap seçmeli.
  const author = await login(fixture.author);
  if (!state.trendPollId) {
    const a = await upload(author, await readFile(resolve("../mobile/assets/images/auth/man.jpg")), "polo.jpg");
    const b = await upload(author, await readFile(resolve("../mobile/assets/images/auth/woman.jpg")), "diger.jpg");
    state.trendPollId = await publish(author, { question: "Sonbahar için çizgili polo mu?", category: "OUTFIT", visibility: "PUBLIC", durationSeconds: 86400,
      options: [{ position: 1, mediaId: a, products: [{ catalogProductId: state.productId }] }, { position: 2, mediaId: b, products: [] }] });
    await save();
  }
  const poll = await request<any>(`/polls/${state.trendPollId}`, author);
  const tagged = poll.options.find((option: any) => option.position === 1);
  while (state.voters.length < VOTERS) {
    state.voters.push(await account(`voter${state.voters.length + 1}`, `Oy veren ${state.voters.length + 1}`)); await save();
  }
  for (const voter of state.voters) {
    const token = await login(voter);
    const current = await request<any>(`/polls/${state.trendPollId}`, token);
    if (!current.myOptionId) await request(`/polls/${state.trendPollId}/vote`, token, "PUT", { optionId: tagged.id });
    await request("/auth/logout", token, "POST");
  }

  // Trend katkıları outbox işçisiyle yazılır; çalışan backend'in işlemesi beklenir.
  let found = false;
  for (let attempt = 0; attempt < 20 && !found; attempt++) {
    const trends = await request<any>("/trends?period=WEEK&limit=50", viewer);
    found = trends.items.some((item: any) => item.product.id === state.productId);
    if (!found) await new Promise((done) => setTimeout(done, 1500));
  }
  for (const token of [viewer, author, admin]) await request("/auth/logout", token, "POST");
  console.log(JSON.stringify({ ready: found, productId: state.productId, outfitPollId: state.outfitPollId, trendPollId: state.trendPollId,
    loginEmail: fixture.viewer.email, note: found ? "Ürün trendlerde." : "Ürün henüz trendde değil: backend OUTBOX_WORKER_ENABLED=true ile çalışıyor mu?" }, null, 2));
} finally { await db.$disconnect(); }
