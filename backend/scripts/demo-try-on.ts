import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { createDb } from "../src/database/prisma-client.js";
import { ApiError, apiFetch, apiRequest, apiBaseUrl } from "../../mobile/src/lib/api/client.js";
import type { Session } from "../../mobile/src/features/auth/types.js";

// "Üzerimde dene" yatırımcı demosu: önizleme hesabına iki fotoğraflı kendi
// kombin oylamasını paylaşır, Zara polo ve jean ürünlerini kataloğa ekler ve
// trendlere girecek kadar oy toplar. Yalnız yerel geliştirme veritabanı
// içindir; tekrar çalıştırılabilir. Fotoğraflar backend/demo/try-on altındadır.
// Kullanım: npm run demo:try-on [-- <A fotoğrafı> <B fotoğrafı>]

type Account = { email: string; password: string; userId: string };
type Fixture = { viewer: Account; author: Account; pollIds: string[] };
type DemoState = {
  admin?: Account; voters: Account[]; outfitPollId?: string; outfitVersion?: number;
  products?: Record<string, string>; trendPolls?: Record<string, string>;
  // İlk sürümün tek ürünlü alanları; okunup products/trendPolls'a taşınır.
  productId?: string; trendPollId?: string;
};

// Fiyatlar bilinmiyor: uydurmak yerine boş bırakılır.
export const DEMO_PRODUCTS = [
  { key: "polo", title: "Çizgili dokulu relaxed fit polo t-shirt", externalId: "p00526325", variantKey: "548761372",
    url: "https://www.zara.com/tr/tr/cizgili-dokulu-relaxed-fit-polo-t-shirt-p00526325.html?v1=548761372&v2=2731450",
    trendQuestion: "Sonbahar için çizgili polo mu?" },
  { key: "jean", title: "Çan paça fit jean", externalId: "p00840333", variantKey: "556171480",
    url: "https://www.zara.com/tr/tr/can-paca-fit-jean-p00840333.html?v1=556171480&v2=2432131",
    trendQuestion: "Gri çan paça jean nasıl duruyor?" },
] as const;
// Kombin oylaması sürümü: fotoğraflar değişince eski oylama iptal edilip yenisi açılır.
const OUTFIT_VERSION = 2;
// Mobil demo eşleşmesi bu soruyu arar: aynı metin mobile/src/features/try-on/data/demo-results.ts içinde.
export const DEMO_OUTFIT_QUESTION = "Bugünkü kombinim nasıl?";
const VOTERS = 6;

const url = new URL(apiBaseUrl ?? "http://127.0.0.1:3000/v1");
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/v1") throw new Error("Demo yalnız yerel API'de /v1 adresine çalışır.");
if (process.env.NODE_ENV === "production") throw new Error("Bu araç yalnız yerel geliştirme içindir.");
const photos = [process.argv[2] ?? "demo/try-on/outfit-a.jpg", process.argv[3] ?? "demo/try-on/outfit-b.jpg"].map((path) => resolve(path));
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
  const form = new FormData(); form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), name);
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
  const [photoA, photoB] = await Promise.all(photos.map((path) => readFile(path).catch(() => {
    throw new Error(`Kombin fotoğrafı bulunamadı: ${path}`);
  })));
  let state: DemoState = { voters: [] };
  try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { /* İlk çalıştırma. */ }
  state.products ??= state.productId ? { polo: state.productId } : {};
  state.trendPolls ??= state.trendPollId ? { polo: state.trendPollId } : {};
  delete state.productId; delete state.trendPollId;
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

  const stores = await request<any>("/admin/catalog/stores", admin);
  let store = (stores.items ?? stores).find((row: any) => row.domain === "zara.com");
  if (!store) store = await request("/admin/catalog/stores", admin, "POST",
    { name: "Zara", domain: "zara.com", trackingParameters: [], reason: "Demo: kullanıcının paylaştığı ürün bağlantısı" }, randomUUID());
  for (const product of DEMO_PRODUCTS) {
    if (state.products[product.key]) continue;
    const created = await request("/admin/catalog/products", admin, "POST", {
      storeId: store.id, externalId: product.externalId, variantKey: product.variantKey, title: product.title,
      brand: "Zara", category: "OUTFIT", url: product.url, priceMinor: null, currency: "TRY",
      reason: "Demo: kullanıcının paylaştığı ürün bağlantısı",
    }, randomUUID());
    state.products[product.key] = created.id; await save();
  }

  // Kullanıcının kendi kombin oylaması: A ve B kendi fotoğrafları. "Üzerimde dene" A'yı kullanır.
  const viewer = await login(fixture.viewer);
  if (state.outfitPollId && state.outfitVersion !== OUTFIT_VERSION) {
    const old = await request<any>(`/polls/${state.outfitPollId}`, viewer);
    if (old.effectiveStatus === "OPEN") await request(`/polls/${state.outfitPollId}/cancel`, viewer, "POST", { expectedVersion: old.version }, randomUUID());
    delete state.outfitPollId; await save();
  }
  if (!state.outfitPollId) {
    const a = await upload(viewer, photoA, "kombin-a.jpg");
    const b = await upload(viewer, photoB, "kombin-b.jpg");
    state.outfitPollId = await publish(viewer, { question: DEMO_OUTFIT_QUESTION, category: "OUTFIT", visibility: "PUBLIC", durationSeconds: 86400,
      options: [{ position: 1, mediaId: a, products: [] }, { position: 2, mediaId: b, products: [] }] });
    state.outfitVersion = OUTFIT_VERSION; await save();
  }

  // Trend: her ürünü içeren kombini en az 5 farklı hesap seçmeli.
  const author = await login(fixture.author);
  const [man, woman] = await Promise.all(["man.jpg", "woman.jpg"].map((file) => readFile(resolve("../mobile/assets/images/auth", file))));
  for (const product of DEMO_PRODUCTS) {
    if (state.trendPolls[product.key]) continue;
    const a = await upload(author, man, `${product.key}.jpg`);
    const b = await upload(author, woman, "diger.jpg");
    state.trendPolls[product.key] = await publish(author, { question: product.trendQuestion, category: "OUTFIT", visibility: "PUBLIC", durationSeconds: 86400,
      options: [{ position: 1, mediaId: a, products: [{ catalogProductId: state.products[product.key] }] }, { position: 2, mediaId: b, products: [] }] });
    await save();
  }
  while (state.voters.length < VOTERS) {
    state.voters.push(await account(`voter${state.voters.length + 1}`, `Oy veren ${state.voters.length + 1}`)); await save();
  }
  for (const voter of state.voters) {
    const token = await login(voter);
    for (const pollId of Object.values(state.trendPolls)) {
      const current = await request<any>(`/polls/${pollId}`, token);
      const tagged = current.options.find((option: any) => option.position === 1);
      if (!current.myOptionId && current.canVote) await request(`/polls/${pollId}/vote`, token, "PUT", { optionId: tagged.id });
    }
    await request("/auth/logout", token, "POST");
  }

  // Trend katkıları outbox işçisiyle yazılır; çalışan backend'in işlemesi beklenir.
  const wanted = Object.values(state.products);
  let missing = wanted;
  for (let attempt = 0; attempt < 20 && missing.length; attempt++) {
    const trends = await request<any>("/trends?period=WEEK&limit=50", viewer);
    missing = wanted.filter((id) => !trends.items.some((item: any) => item.product.id === id));
    if (missing.length) await new Promise((done) => setTimeout(done, 1500));
  }
  for (const token of [viewer, author, admin]) await request("/auth/logout", token, "POST");
  console.log(JSON.stringify({ ready: !missing.length, products: state.products, outfitPollId: state.outfitPollId, trendPolls: state.trendPolls,
    loginEmail: fixture.viewer.email, note: missing.length ? "Bazı ürünler henüz trendde değil: backend OUTBOX_WORKER_ENABLED=true ile çalışıyor mu?" : "Ürünler trendlerde." }, null, 2));
} finally { await db.$disconnect(); }
