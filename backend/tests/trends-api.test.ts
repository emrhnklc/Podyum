import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { Prisma } from "../src/generated/prisma/client.js";
import { domainApp, loadBackend, type Actor } from "./helpers/domain-app.js";

let f: Awaited<ReturnType<typeof domainApp>>;
let projection: any, store: any, brand: string;
const reason = "Trend API kabul testi";
beforeEach(async () => {
  f = await domainApp();
  brand = `Trend-${randomUUID()}`;
  store = undefined;
  const { TrendProjectionService } = await loadBackend(
    "modules/trends/trend-projection.service",
  );
  projection = f.app.get(TrendProjectionService);
  while (f.actors.length < 7) {
    const session = await f.ok("POST", "/auth/mock", undefined, {
      provider: "google",
      subject: `trend_api_${randomUUID()}`,
      acknowledgeMock: true,
    });
    const actor = { id: "", token: session.accessToken };
    actor.id = (await f.ok("GET", "/auth/me", actor)).user.id;
    f.actors.push(actor);
  }
});
afterEach(async () => {
  await f?.cleanup();
});

async function product(fields: Record<string, unknown> = {}) {
  if (!store)
    store = await f.ok("POST", "/admin/catalog/stores", f.actors[0], {
      name: "Trend API mağaza",
      domain: `trend-api-${randomUUID()}.com`,
      reason,
    });
  return f.ok("POST", "/admin/catalog/products", f.actors[0], {
    storeId: store.id,
    title: "Tercih edilen ayakkabı",
    brand,
    category: "SHOES",
    url: `https://${store.domain}/p/${randomUUID()}`,
    priceMinor: 12345,
    currency: "TRY",
    reason,
    ...fields,
  });
}
async function poll(products: any[], fields: Record<string, unknown> = {}) {
  const options = [];
  for (let position = 1; position <= 2; position++) {
    const id = randomUUID();
    await f.db.mediaAsset.create({
      data: {
        id,
        ownerId: f.actors[0].id,
        uploadKey: `${id}/source`,
        status: "READY",
        displayKey: `${id}/display.webp`,
        thumbnailKey: `${id}/thumbnail.webp`,
        previewAcceptedAt: new Date(),
      },
    });
    options.push({
      position,
      mediaId: id,
      products:
        position === 1 ? products.map((p) => ({ catalogProductId: p.id })) : [],
    });
  }
  const draft = await f.ok("POST", "/polls", f.actors[0], {
    question: "Hangisini seçerdin?",
    options,
    ...fields,
  });
  return f.ok("POST", `/polls/${draft.id}/publish`, f.actors[0], {
    expectedVersion: draft.version,
  });
}
async function project(p: any, voters = f.actors.slice(1, 6)) {
  await f.db.$transaction((tx) =>
    projection.synchronize(
      tx,
      voters.map((voter) => ({ pollId: p.id, voterId: voter.id })),
    ),
  );
}
async function prefer(p: any, voters = f.actors.slice(1, 6), apply = true) {
  for (const actor of voters)
    await f.ok("PUT", `/polls/${p.id}/vote`, actor, {
      optionId: p.options[0].id,
    });
  if (apply) await project(p, voters);
}
async function moveTo(p: any, time: string) {
  const date = new Date(time),
    publishedAt = new Date(date.getTime() - 60000);
  await f.db.poll.update({
    where: { id: p.id },
    data: {
      status: "CLOSED",
      publishedAt,
      closesAt: new Date(date.getTime() + 3600000),
    },
  });
  for (const tag of await f.db.productTag.findMany({
    where: { option: { pollId: p.id } },
  })) {
    await f.db.productTag.update({
      where: { id: tag.id },
      data: {
        catalogSnapshot: {
          ...(tag.catalogSnapshot as object),
          capturedAt: publishedAt.toISOString(),
        },
      },
    });
  }
  await f.db.pollVote.updateMany({
    where: { pollId: p.id },
    data: { createdAt: date },
  });
  await project(p, f.actors.slice(1));
}
const query = (fields: Record<string, string | number> = {}) =>
  `/trends?${new URLSearchParams({ brand, ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)])) })}`;
const list = (
  fields: Record<string, string | number> = {},
  actor = f.actors[0],
) => f.ok("GET", query(fields), actor);
const edit = (p: any, fields: Record<string, unknown>) => ({
  expectedVersion: p.version,
  title: p.title,
  brand: p.brand,
  category: p.category,
  priceMinor: p.priceMinor,
  currency: p.currency,
  status: p.status,
  reason,
  ...fields,
});
async function consent(actor: Actor, fields: Record<string, unknown> = {}) {
  await f.ok("PATCH", "/me/private", actor, {
    analyticsConsent: true,
    gender: "WOMAN",
    ageBand: "AGE_18_24",
    ...fields,
  });
}
async function visibility(p: any, contentStatus: "HIDDEN" | "VISIBLE") {
  const current = await f.db.poll.findUniqueOrThrow({ where: { id: p.id } });
  return f.ok("PUT", `/admin/polls/${p.id}/visibility`, f.actors[0], {
    expectedVersion: current.version,
    contentStatus,
    reason,
  });
}

test("trend ucu oturum ister; ham katkı açılmaz, boş/yetersiz veri farklı ve şema belgeli", async () => {
  assert.equal((await f.http("GET", query(), null)).status, 401);
  assert.equal((await f.http("GET", "/trends/contributions")).status, 404);
  const empty = await list();
  assert.equal(empty.status, "NO_DATA");
  assert.deepEqual(empty.items, []);
  assert.equal(empty.nextCursor, null);
  const p = await poll([await product()]);
  await prefer(p, f.actors.slice(1, 5));
  const small = await list();
  assert.equal(small.status, "INSUFFICIENT_SAMPLE");
  assert.deepEqual(small.items, []);
  assert.equal("distinctVoters" in small, false);
  const response = await fetch(`${await f.app.getUrl()}/v1${query()}`, {
    headers: { Authorization: `Bearer ${f.actors[0].token}` },
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  await response.json();
  const docs = await f.ok("GET", "/openapi.json");
  assert.ok(docs.paths["/v1/trends"]?.get);
  assert.ok(docs.components.schemas.TrendsPageDto);
});

test("ürün başına 5 ayrı hesap eşiği: nadir ürün kimliği ve sayısı yayımlanmaz", async () => {
  const a = await product(),
    b = await product();
  const common = await poll([a]),
    rare = await poll([b]);
  await prefer(common);
  await prefer(rare, f.actors.slice(1, 5));
  const page = await list();
  assert.equal(page.status, "READY");
  assert.deepEqual(
    page.items.map((x: any) => x.id),
    [a.id],
  );
  assert.equal(page.items[0].score, 5);
  assert.equal(page.items[0].distinctVoters, 5);
  assert.equal(page.policy.minimumDistinctVoters, 5);
  assert.equal(page.policy.measurement, "PRODUCTS_IN_PREFERRED_OUTFITS");
  assert.equal(JSON.stringify(page).includes(b.id), false);
  for (const key of [
    "voterId",
    "pollId",
    "genderAtVote",
    "analyticsConsentAtVote",
    "catalogSnapshot",
    "email",
  ])
    assert.equal(JSON.stringify(page).includes(`"${key}"`), false);
});

test("aynı gün tekrar seçmek puanı şişirmez; raw tercihler korunur", async () => {
  const a = await product(),
    first = await poll([a]),
    second = await poll([a]);
  await prefer(first);
  await prefer(second);
  assert.equal((await list()).items[0].score, 5);
  assert.equal(
    await f.db.pollVote.count({
      where: { pollId: { in: [first.id, second.id] } },
    }),
    10,
  );
});

test("çok günlük yüksek puan 5 ayrı kişi yerine geçmez", async () => {
  const a = await product(),
    first = await poll([a]),
    second = await poll([a]);
  await prefer(first, f.actors.slice(1, 5), false);
  await prefer(second, f.actors.slice(1, 5), false);
  await moveTo(first, "2026-10-14T12:00:00.000Z");
  await moveTo(second, "2026-10-15T12:00:00.000Z");
  assert.equal(
    (await list({ period: "WEEK", date: "2026-10-15" })).status,
    "INSUFFICIENT_SAMPLE",
  );
});

test("İstanbul günü/gece yarısı, pazartesi haftası ve takvim ayı gerçek oyları doğru toplar", async () => {
  const a = await product();
  for (const date of ["2026-10-18T20:59:59.000Z", "2026-10-18T21:00:00.000Z"]) {
    const p = await poll([a]);
    await prefer(p, undefined, false);
    await moveTo(p, date);
  }
  const sunday = await list({ period: "DAY", date: "2026-10-18" });
  const monday = await list({ period: "DAY", date: "2026-10-19" });
  assert.equal(sunday.items[0].score, 5);
  assert.equal(monday.items[0].score, 5);
  assert.equal(monday.period.startsAt, "2026-10-18T21:00:00.000Z");
  const week = await list({ period: "WEEK", date: "2026-10-19" });
  assert.equal(week.items[0].score, 5);
  assert.equal(week.period.startDate, "2026-10-19");
  const month = await list({ period: "MONTH", date: "2026-10-19" });
  assert.equal(month.items[0].score, 10);
  assert.equal(month.items[0].distinctVoters, 5);
  assert.equal(month.period.startDate, "2026-10-01");
  assert.equal(month.period.endDate, "2026-11-01");
});

test("kategori/marka/fiyat yayın snapshot'ını filtreler; kart güncel katalog bilgisini ayrı taşır", async () => {
  const a = await product(),
    p = await poll([a]);
  await prefer(p);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${a.id}`,
    f.actors[0],
    edit(a, { brand: "Yeni marka", category: "BAG", priceMinor: 99999 }),
  );
  const page = await list({
    category: "SHOES",
    minPriceMinor: 12345,
    maxPriceMinor: 12345,
  });
  assert.equal(page.items[0].score, 5);
  assert.equal(page.items[0].product.priceMinor, 99999);
  assert.equal(page.items[0].product.brand, "Yeni marka");
  assert.equal(page.priceBasis, "PUBLICATION_SNAPSHOT");
  assert.equal(page.productBasis, "CURRENT_CATALOG");
  assert.equal((await list({ category: "BAG" })).status, "NO_DATA");
  assert.equal((await list({ minPriceMinor: 12346 })).status, "NO_DATA");
  assert.equal((await list({ brand: "Yeni marka" })).status, "NO_DATA");
});

test("para birimleri karışmaz; fiyatı bilinmeyen ürün aralık filtresine girmez", async () => {
  const a = await product({ priceMinor: null }),
    b = await product({ currency: "EUR", priceMinor: 12345 });
  const p = await poll([a, b]);
  await prefer(p);
  assert.deepEqual(
    (await list()).items.map((x: any) => x.id),
    [a.id],
  );
  assert.equal((await list({ minPriceMinor: 0 })).status, "NO_DATA");
  const euros = await list({ currency: "EUR" });
  assert.deepEqual(
    euros.items.map((x: any) => x.id),
    [b.id],
  );
  assert.equal(euros.items[0].product.currency, "EUR");
});

test("izinli yaş/cinsiyet oy anından gelir; geri alma ve yeniden izin eski bağlamı diriltmez", async () => {
  for (const actor of f.actors.slice(1, 6)) await consent(actor);
  const p = await poll([await product()]);
  await prefer(p);
  const filters = { gender: "WOMAN", ageBand: "AGE_18_24" };
  assert.equal((await list(filters)).items[0].score, 5);
  assert.equal((await list(filters)).population, "CONSENTED_VOTER_SNAPSHOT");
  await consent(f.actors[1], { gender: "MAN", ageBand: "AGE_35_PLUS" });
  assert.equal((await list(filters)).items[0].score, 5);
  assert.equal((await list({ gender: "MAN" })).status, "NO_DATA");
  await f.ok("PATCH", "/me/private", f.actors[1], { analyticsConsent: false });
  assert.equal((await list(filters)).status, "INSUFFICIENT_SAMPLE");
  assert.equal((await list()).items[0].score, 5);
  await consent(f.actors[1]);
  assert.equal((await list(filters)).status, "INSUFFICIENT_SAMPLE");
});

test("günün ilk izinsiz tercihi sonraki izinli tercih üzerinden demografik hale gelmez", async () => {
  const a = await product(),
    first = await poll([a]);
  await prefer(first);
  for (const actor of f.actors.slice(1, 6)) await consent(actor);
  const second = await poll([a]);
  await prefer(second);
  assert.equal((await list()).items[0].score, 5);
  assert.equal((await list({ gender: "WOMAN" })).status, "NO_DATA");
});

test("PUBLIC içeriğin gizlenmesi ve ürün arşivi mevcut toplamı hemen kapatır", async () => {
  const a = await product(),
    p = await poll([a]);
  await prefer(p);
  assert.equal((await list()).status, "READY");
  await visibility(p, "HIDDEN");
  assert.equal((await list()).status, "NO_DATA");
  await visibility(p, "VISIBLE");
  assert.equal((await list()).status, "READY");
  await f.ok(
    "PUT",
    `/admin/catalog/products/${a.id}`,
    f.actors[0],
    edit(a, { status: "ARCHIVED" }),
  );
  assert.equal((await list()).status, "NO_DATA");
});

test("birleşen ürünler tek kimlik ve günlük tek katkı olur; hedef metadata gösterilir", async () => {
  const a = await product(),
    b = await product(),
    p = await poll([a, b]);
  await prefer(p);
  await f.ok("POST", `/admin/catalog/products/${a.id}/merge`, f.actors[0], {
    expectedVersion: a.version,
    targetId: b.id,
    targetVersion: b.version,
    reason,
  });
  const page = await list();
  assert.deepEqual(
    page.items.map((x: any) => x.id),
    [b.id],
  );
  assert.equal(page.items[0].score, 5);
  assert.equal(page.items[0].product.id, b.id);
});

test("eşit puanda hesap sayısı ve UUID sırası kararlı; cursor filtreye ve hesaba bağlı", async () => {
  const products = [await product(), await product(), await product()];
  const p = await poll(products);
  await prefer(p);
  const expected = products.map((x) => x.id).sort();
  const first = await list({ limit: 1 });
  assert.equal(first.items[0].id, expected[0]);
  assert.equal(first.items[0].rank, 1);
  assert.ok(first.nextCursor);
  assert.equal(
    (await f.http("GET", query({ cursor: first.nextCursor, currency: "EUR" })))
      .status,
    400,
  );
  assert.equal(
    (await f.http("GET", query({ cursor: first.nextCursor }), f.actors[1]))
      .status,
    400,
  );
  const second = await list({ cursor: first.nextCursor, limit: 1 });
  assert.equal(second.items[0].id, expected[1]);
  assert.equal(second.items[0].rank, 2);
  const third = await list({ cursor: second.nextCursor, limit: 10 });
  assert.equal(third.items[0].id, expected[2]);
  assert.equal(third.items[0].rank, 3);
  assert.equal(third.nextCursor, null);
  assert.equal(first.asOf, third.asOf);
});

test("yeni oy sayfalama kesitini değiştirmez; ilk sayfa yenilenince eklenir", async () => {
  const a = await product(),
    b = await product(),
    p = await poll([a, b]);
  await prefer(p);
  const first = await list({ limit: 1 });
  await prefer(p, [f.actors[6]]);
  const second = await list({ cursor: first.nextCursor });
  assert.equal(second.items[0].score, 5);
  assert.equal((await list()).items[0].score, 6);
});

test("sayfa arasında izin veya görünürlük değişirse eski cohort toplamıyla devam edilmez", async () => {
  for (const actor of f.actors.slice(1, 6)) await consent(actor);
  const p = await poll([await product(), await product()]);
  await prefer(p);
  const filters = { gender: "WOMAN", limit: 1 },
    first = await list(filters);
  await f.ok("PATCH", "/me/private", f.actors[1], { analyticsConsent: false });
  const changed = await f.http(
    "GET",
    query({ ...filters, cursor: first.nextCursor }),
  );
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error.code, "TREND_RESULTS_CHANGED");
  const general = await list({ limit: 1 });
  await visibility(p, "HIDDEN");
  assert.equal(
    (await f.http("GET", query({ cursor: general.nextCursor }))).status,
    409,
  );
});

test("sıkı filtre doğrulama: gerçek tarih, sayı/para birimi/enum ve fiyat sırası", async () => {
  const invalid: Record<string, string | number>[] = [
    { date: "2026-02-30" },
    { date: "2099-01-01" },
    { date: "2016-12-31" },
    { date: "garbage" },
    { period: "YEAR" },
    { currency: "USD,TRY" },
    { minPriceMinor: "NaN" },
    { minPriceMinor: "1.5" },
    { minPriceMinor: -1 },
    { maxPriceMinor: 2147483648 },
    { minPriceMinor: 2, maxPriceMinor: 1 },
    { gender: "ANY" },
    { ageBand: "18-24" },
    { category: "OTHER" },
    { limit: 51 },
    { brand: " " },
    { brand: "a\u0000b" },
    { unknown: "field" },
    { cursor: "broken" },
  ];
  for (const fields of invalid)
    assert.equal(
      (await f.http("GET", query(fields))).status,
      400,
      JSON.stringify(fields),
    );
});

test("dönem ve cursor sınırları: şubat/yıl geçişi, TTL, ileri tarih ve bozuk puan", async () => {
  const { trendPeriod } = await loadBackend("modules/trends/trend-period");
  const { encodeTrendPage, decodeTrendPage } = await loadBackend(
    "modules/trends/trend-page-cursor",
  );
  const now = new Date("2026-10-20T12:00:00.000Z");
  assert.equal(trendPeriod("MONTH", "2024-02-29", now).endDate, "2024-03-01");
  assert.equal(trendPeriod("WEEK", "2026-01-01", now).startDate, "2025-12-29");
  const context = { userId: f.actors[0].id };
  const cursor = (fields: object) =>
    encodeTrendPage(
      {
        id: randomUUID(),
        score: 5,
        distinctVoters: 5,
        asOf: now.toISOString(),
        fingerprint: "a".repeat(32),
        ...fields,
      },
      context,
    );
  assert.throws(
    () =>
      decodeTrendPage(
        cursor({ asOf: "2026-10-20T11:44:59.000Z" }),
        context,
        now,
      ),
    (e: any) => e.getStatus() === 409,
  );
  assert.throws(() =>
    decodeTrendPage(cursor({ asOf: "2026-10-20T12:00:01.000Z" }), context, now),
  );
  assert.throws(() => decodeTrendPage(cursor({ score: 4 }), context, now));
  assert.throws(() =>
    decodeTrendPage(cursor({ distinctVoters: 6 }), context, now),
  );
});

test("puan azalan, eşitte farklı hesap sayısı azalan; sıralama dönem boyunca korunur", async () => {
  const a = await product(),
    b = await product(),
    c = await product();
  const first = await poll([a, b, c]);
  await prefer(first, undefined, false);
  await moveTo(first, "2026-10-14T12:00:00.000Z");
  const moreA = await poll([a]);
  await prefer(moreA, undefined, false);
  await moveTo(moreA, "2026-10-15T12:00:00.000Z");
  const moreB = await poll([b]);
  await prefer(moreB, f.actors.slice(2, 7), false);
  await moveTo(moreB, "2026-10-15T12:00:00.000Z");
  const page = await list({ period: "WEEK", date: "2026-10-15" });
  assert.deepEqual(
    page.items.map((x: any) => [x.id, x.score, x.distinctVoters, x.rank]),
    [
      [b.id, 10, 6, 1],
      [a.id, 10, 5, 2],
      [c.id, 5, 5, 3],
    ],
  );
});

test("gerçek sıralama sorgusu EXPLAIN ANALYZE: plan/buffer kaydı, kaynak ve tek aggregation", async (t) => {
  const p = await poll([await product(), await product(), await product()]);
  await prefer(p);
  const { trendRankingQuery } = await loadBackend(
    "modules/trends/trend-ranking.query",
  );
  const { trendPeriod } = await loadBackend("modules/trends/trend-period");
  const { TrendsQueryDto } = await loadBackend("modules/trends/dto/trends.dto");
  const now = new Date(),
    query = Object.assign(new TrendsQueryDto(), { brand });
  const sql = trendRankingQuery(
    query,
    trendPeriod("WEEK", undefined, now),
    now,
    null,
  );
  const rows = await f.db.$queryRaw<any[]>(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
  );
  const plan = rows[0]["QUERY PLAN"][0];
  assert.ok(plan["Execution Time"] >= 0);
  assert.ok(JSON.stringify(plan).includes("TrendContribution"));
  t.diagnostic(
    JSON.stringify({
      fixtureContributions: 15,
      planningMs: plan["Planning Time"],
      executionMs: plan["Execution Time"],
      sharedHitBlocks: plan.Plan["Shared Hit Blocks"],
      sharedReadBlocks: plan.Plan["Shared Read Blocks"],
    }),
  );
});
