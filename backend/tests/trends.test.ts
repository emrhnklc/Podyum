import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { domainApp, loadBackend, type Actor } from "./helpers/domain-app.js";
let f: Awaited<ReturnType<typeof domainApp>>;
let projection: any, consumer: any, store: any;
beforeEach(async () => {
  f = await domainApp();
  store = undefined;
  const { TrendProjectionService } = await loadBackend(
    "modules/trends/trend-projection.service",
  );
  const { TrendConsumer } = await loadBackend(
    "modules/trends/trend-consumer.service",
  );
  projection = f.app.get(TrendProjectionService);
  consumer = f.app.get(TrendConsumer);
});
afterEach(async () => {
  await f?.cleanup();
});
const reason = "Trend kaynak testi";
async function product(fields: Record<string, unknown> = {}) {
  if (!store)
    store = await f.ok("POST", "/admin/catalog/stores", f.actors[0], {
      name: "Trend test mağazası",
      domain: `trend-${randomUUID()}.com`,
      reason,
    });
  return f.ok("POST", "/admin/catalog/products", f.actors[0], {
    storeId: store.id,
    title: "Katalog ürünü",
    brand: "Yayın markası",
    category: "SHOES",
    url: `https://${store.domain}/p/${randomUUID()}`,
    priceMinor: 12345,
    currency: "TRY",
    reason,
    ...fields,
  });
}
const edit = (p: any, fields: Record<string, unknown> = {}) => ({
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
async function poll(
  products: any[],
  fields: Record<string, unknown> = {},
  author = f.actors[0],
) {
  const options = [];
  for (let i = 1; i <= 2; i++) {
    const id = randomUUID();
    await f.db.mediaAsset.create({
      data: {
        id,
        ownerId: author.id,
        uploadKey: `${id}/source`,
        status: "READY",
        displayKey: `${id}/display.webp`,
        thumbnailKey: `${id}/thumbnail.webp`,
        previewAcceptedAt: new Date(),
      },
    });
    options.push({
      position: i,
      mediaId: id,
      products: i === 1 ? products : [],
    });
  }
  const d = await f.ok("POST", "/polls", author, {
    question: "Trend için hangisi?",
    options,
    ...fields,
  });
  return f.ok("POST", `/polls/${d.id}/publish`, author, {
    expectedVersion: d.version,
  });
}
const tag = (p: any) => ({ catalogProductId: p.id });
async function vote(p: any, actor = f.actors[1], index = 0) {
  await f.ok("PUT", `/polls/${p.id}/vote`, actor, {
    optionId: p.options[index].id,
  });
  return f.db.outboxEvent.findFirstOrThrow({
    where: { aggregateId: p.id, type: "poll.vote.cast" },
    orderBy: { createdAt: "desc" },
  });
}
async function project(event: any) {
  await f.db.$transaction((tx) => consumer.project(tx, event));
}
async function signals(pollId?: string, daily = false) {
  return daily
    ? pollId
      ? f.db.$queryRaw<
          any[]
        >`SELECT *, "trendDay"::text AS day FROM "TrendDailySignal" WHERE "pollId" = ${pollId}::uuid ORDER BY "voterId"`
      : f.db.$queryRaw<
          any[]
        >`SELECT *, "trendDay"::text AS day FROM "TrendDailySignal" WHERE "voterId" IN (${f.actors[0].id}::uuid, ${f.actors[1].id}::uuid, ${f.actors[2].id}::uuid) ORDER BY "votedAt", "pollId"`
    : f.db.$queryRaw<
        any[]
      >`SELECT *, "trendDay"::text AS day FROM "TrendEligibleContribution" WHERE "pollId" = ${pollId}::uuid ORDER BY "voterId", "catalogProductId"`;
}
async function privacy(actor: Actor, fields: Record<string, unknown>) {
  return f.ok("PATCH", "/me/private", actor, fields);
}

test("yalnız seçilen seçenekteki katalog ürünleri katkı olur; manual ve seçilmeyen ürün sayılmaz", async () => {
  const a = await product(),
    b = await product();
  const p = await poll([
    tag(a),
    tag(b),
    { title: "Elle", externalUrl: "https://example.com/manual" },
  ]);
  await project(await vote(p));
  const rows = await signals(p.id);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, "SHOES");
  assert.equal(rows[0].priceMinor, 12345);
  assert.equal(rows[0].demographicsAllowed, false);
  assert.equal(rows[0].genderAtVote, null);
  await project(await vote(p, f.actors[2], 1));
  assert.equal((await signals(p.id)).length, 2);
});

test("tekrar ve sırasız olay gerçek tercihi okur, yeni katkı veya yanlış seçenek üretmez", async () => {
  const a = await product(),
    p = await poll([tag(a)]),
    event = await vote(p);
  await project(event);
  const before = await f.db.trendContribution.findMany({
    where: { pollId: p.id },
  });
  for (let i = 0; i < 3; i++)
    await project({
      ...event,
      id: randomUUID(),
      aggregateVersion: 0,
      payload: {
        ...(event.payload as object),
        optionId: p.options[1].id,
        votedAt: "2000-01-01T00:00:00.000Z",
      },
    });
  assert.deepEqual(
    await f.db.trendContribution.findMany({ where: { pollId: p.id } }),
    before,
  );
  assert.equal((await signals(p.id)).length, 1);
  await assert.rejects(
    f.db.$transaction((tx) =>
      consumer.project(tx, {
        ...event,
        payload: { schemaVersion: 1, voterId: "invalid" },
      }),
    ),
  );
});

test("fiyat/marka/kategori yayın snapshot'ından gelir; trend ham link veya demografi kopyalamaz", async () => {
  const a = await product(),
    p = await poll([tag(a)]);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${a.id}`,
    f.actors[0],
    edit(a, { priceMinor: 99999, brand: "Bugünkü marka", category: "BAG" }),
  );
  await project(await vote(p));
  const row = (await signals(p.id))[0];
  assert.equal(row.priceMinor, 12345);
  assert.equal(row.brand, "Yayın markası");
  assert.equal(row.category, "SHOES");
  const stored = await f.db.trendContribution.findFirstOrThrow({
    where: { pollId: p.id },
  });
  for (const key of [
    "externalUrl",
    "email",
    "genderAtVote",
    "ageBandAtVote",
    "analyticsConsentAtVote",
  ])
    assert.equal(key in stored, false);
});

test("FRIENDS, elle ürün ve izinsiz/olmayan kaynaklar genel katkı yaratmaz", async () => {
  const a = await product(),
    hidden = await poll([tag(a)], { visibility: "FRIENDS" });
  assert.equal(
    (
      await f.http("PUT", `/polls/${hidden.id}/vote`, f.actors[1], {
        optionId: hidden.options[0].id,
      })
    ).status,
    404,
  );
  await f.db.pollVote.create({
    data: {
      pollId: hidden.id,
      voterId: f.actors[1].id,
      optionId: hidden.options[0].id,
    },
  });
  await f.db.$transaction((tx) =>
    projection.synchronize(tx, [
      { pollId: hidden.id, voterId: f.actors[1].id },
    ]),
  );
  assert.equal(
    await f.db.trendContribution.count({ where: { pollId: hidden.id } }),
    0,
  );
  const manual = await poll([
    { title: "Manual", externalUrl: "https://example.com/product" },
  ]);
  await project(await vote(manual));
  assert.equal((await signals(manual.id)).length, 0);
});

test("oy anı demografisi korunur; sonradan izin vermek eski tercihi zenginleştirmez", async () => {
  const a = await product(),
    first = await poll([tag(a)]);
  await project(await vote(first));
  await privacy(f.actors[1], {
    analyticsConsent: true,
    gender: "WOMAN",
    ageBand: "AGE_18_24",
  });
  assert.equal((await signals(first.id))[0].genderAtVote, null);
  const second = await poll([tag(a)]);
  await project(await vote(second));
  await privacy(f.actors[1], { gender: "MAN", ageBand: "AGE_25_34" });
  const row = (await signals(second.id))[0];
  assert.equal(row.genderAtVote, "WOMAN");
  assert.equal(row.ageBandAtVote, "AGE_18_24");
  assert.equal(row.demographicsAllowed, true);
});

test("izni geri alma kuyruğu beklemeden demografiyi kapatır; genel sayı kalır ve yeniden izin eskiyi diriltmez", async () => {
  const a = await product();
  await privacy(f.actors[1], {
    analyticsConsent: true,
    gender: "WOMAN",
    ageBand: "AGE_18_24",
  });
  const p = await poll([tag(a)]),
    event = await vote(p);
  await project(event);
  assert.equal((await signals(p.id))[0].genderAtVote, "WOMAN");
  await privacy(f.actors[1], { analyticsConsent: false });
  const immediate = await signals(p.id);
  assert.equal(immediate.length, 1);
  assert.equal(immediate[0].genderAtVote, null);
  assert.equal(immediate[0].ageBandAtVote, null);
  await privacy(f.actors[1], { analyticsConsent: true });
  await project(event);
  assert.equal((await signals(p.id))[0].demographicsAllowed, false);
});

test("gizleme/geri açma ve iptal anında sayıya yansır; eski olay gizliyi diriltemez", async () => {
  const a = await product(),
    p = await poll([tag(a)]),
    event = await vote(p);
  await project(event);
  let current = await f.ok("GET", `/polls/${p.id}`);
  await f.ok("PUT", `/admin/polls/${p.id}/visibility`, f.actors[0], {
    expectedVersion: current.version,
    contentStatus: "HIDDEN",
    reason,
  });
  assert.equal((await signals(p.id)).length, 0);
  await project(event);
  assert.equal((await signals(p.id)).length, 0);
  current = await f.db.poll.findUniqueOrThrow({ where: { id: p.id } });
  await f.ok("PUT", `/admin/polls/${p.id}/visibility`, f.actors[0], {
    expectedVersion: current.version,
    contentStatus: "VISIBLE",
    reason,
  });
  assert.equal((await signals(p.id)).length, 1);
  current = await f.ok("GET", `/polls/${p.id}`);
  await f.ok("POST", `/polls/${p.id}/cancel`, f.actors[0], {
    expectedVersion: current.version,
  });
  assert.equal((await signals(p.id)).length, 0);
  await project(event);
  assert.equal((await signals(p.id)).length, 0);
  assert.equal(await f.db.pollVote.count({ where: { pollId: p.id } }), 1);
});

test("katılımcı hesabı silinince genel geçmiş anonim kalır; demografi hemen kapanır", async () => {
  const a = await product();
  await privacy(f.actors[1], {
    analyticsConsent: true,
    gender: "WOMAN",
    ageBand: "AGE_18_24",
  });
  const p = await poll([tag(a)]);
  await project(await vote(p));
  await f.ok("DELETE", "/me/account", f.actors[1], { confirmDeletion: true });
  const row = (await signals(p.id))[0];
  assert.ok(row);
  assert.equal(row.genderAtVote, null);
  assert.equal(row.demographicsAllowed, false);
  assert.equal(await f.db.pollVote.count({ where: { pollId: p.id } }), 1);
});

test("yazar silinince içerik anında trendden çıkar; fiziksel etiket temizliği katkıyı cascade siler", async () => {
  const a = await product(),
    p = await poll([tag(a)], {}, f.actors[1]);
  await project(await vote(p, f.actors[2]));
  await f.ok("DELETE", "/me/account", f.actors[1], { confirmDeletion: true });
  assert.equal((await signals(p.id)).length, 0);
  const { AccountErasureService } = await loadBackend(
    "modules/accounts/account-erasure.service",
  );
  await f.app.get(AccountErasureService).erase(f.actors[1].id);
  assert.equal(
    await f.db.trendContribution.count({ where: { pollId: p.id } }),
    0,
  );
  assert.equal(await f.db.pollVote.count({ where: { pollId: p.id } }), 1);
});

test("askıya alma ve geri açma güncel kullanıcı durumundan okunur", async () => {
  const a = await product(),
    p = await poll([tag(a)]);
  await project(await vote(p));
  await f.ok("PUT", `/admin/users/${f.actors[1].id}/status`, f.actors[0], {
    status: "SUSPENDED",
    reason,
  });
  assert.equal((await signals(p.id)).length, 0);
  await f.ok("PUT", `/admin/users/${f.actors[1].id}/status`, f.actors[0], {
    status: "ACTIVE",
    reason,
  });
  assert.equal((await signals(p.id)).length, 1);
});

test("katalog birleşmesi zinciri tek kimlikte sayılır; eski fiyat ve kaynak kimliği değişmez", async () => {
  const a = await product(),
    b = await product(),
    target = await product(),
    p = await poll([tag(a), tag(b)]);
  await project(await vote(p));
  assert.equal((await signals(p.id)).length, 2);
  await f.ok("POST", `/admin/catalog/products/${a.id}/merge`, f.actors[0], {
    expectedVersion: 0,
    targetId: b.id,
    targetVersion: 0,
    reason,
  });
  assert.equal((await signals(p.id)).length, 1);
  await f.ok("POST", `/admin/catalog/products/${b.id}/merge`, f.actors[0], {
    expectedVersion: 1,
    targetId: target.id,
    targetVersion: 0,
    reason,
  });
  const row = (await signals(p.id))[0];
  assert.equal(row.catalogProductId, target.id);
  assert.equal(row.priceMinor, 12345);
  assert.equal(
    await f.db.trendContribution.count({ where: { pollId: p.id } }),
    2,
  );
  assert.equal((await signals(undefined, true)).length, 1);
});

test("arşiv/mağaza kapatma kuyruğu beklemeden dışlar; geri açma eski snapshot'ı korur", async () => {
  const a = await product(),
    p = await poll([tag(a)]);
  await project(await vote(p));
  let current = await f.ok(
    "PUT",
    `/admin/catalog/products/${a.id}`,
    f.actors[0],
    edit(a, { status: "ARCHIVED" }),
  );
  assert.equal((await signals(p.id)).length, 0);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${a.id}`,
    f.actors[0],
    edit(current, { status: "ACTIVE", priceMinor: 99999 }),
  );
  assert.equal((await signals(p.id))[0].priceMinor, 12345);
  await f.ok("PUT", `/admin/catalog/stores/${store.id}`, f.actors[0], {
    expectedVersion: 0,
    name: store.name,
    active: false,
    reason,
  });
  assert.equal((await signals(p.id)).length, 0);
});

test("kişi/ürün/İstanbul günü başına ilk tercih tek sinyaldir; ham farklı tercihler korunur", async () => {
  const a = await product(),
    first = await poll([tag(a)]),
    second = await poll([tag(a)]);
  await project(await vote(first));
  await project(await vote(second));
  assert.equal(
    (await signals(first.id)).length + (await signals(second.id)).length,
    2,
  );
  assert.equal((await signals(undefined, true)).length, 1);
  await project(await vote(second, f.actors[2]));
  const daily = await signals(undefined, true);
  assert.equal(daily.length, 2);
  assert.equal(daily[0].pollId, first.id);
});

test("İstanbul gece yarısı UTC gününden bağımsızdır; sonraki gün yeniden katkı olabilir", async () => {
  const a = await product(),
    first = await poll([tag(a)]),
    second = await poll([tag(a)]);
  await vote(first);
  await vote(second);
  for (const [p, date] of [
    [first, "2026-10-18T20:59:59.000Z"],
    [second, "2026-10-18T21:00:00.000Z"],
  ] as const) {
    const publishedAt = new Date("2026-10-18T20:00:00.000Z");
    await f.db.poll.update({
      where: { id: p.id },
      data: { publishedAt, closesAt: new Date("2026-10-19T20:00:00.000Z") },
    });
    const t = await f.db.productTag.findFirstOrThrow({
      where: { option: { pollId: p.id } },
    });
    await f.db.productTag.update({
      where: { id: t.id },
      data: {
        catalogSnapshot: {
          ...(t.catalogSnapshot as object),
          capturedAt: publishedAt.toISOString(),
        },
      },
    });
    await f.db.pollVote.update({
      where: { pollId_voterId: { pollId: p.id, voterId: f.actors[1].id } },
      data: { createdAt: new Date(date) },
    });
    await f.db.$transaction((tx) =>
      projection.synchronize(tx, [{ pollId: p.id, voterId: f.actors[1].id }]),
    );
  }
  const rows = await signals(undefined, true);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((x) => x.day),
    ["2026-10-18", "2026-10-19"],
  );
});

test("onarım varsayılan rapordur; kaçan olaylar apply ile yeniden oluşur ve tekrar aynı sonucu verir", async () => {
  const a = await product(),
    p = await poll([tag(a)]);
  await vote(p);
  await vote(p, f.actors[2]);
  const preview = await projection.rebuildBatch({ pollId: p.id, batchSize: 1 });
  assert.equal(preview.mode, "dry-run");
  assert.equal(preview.contributionCount, 1);
  assert.equal(preview.hasMore, true);
  assert.equal(
    await f.db.trendContribution.count({ where: { pollId: p.id } }),
    0,
  );
  const one = await projection.rebuildBatch({
    apply: true,
    pollId: p.id,
    batchSize: 1,
  });
  const two = await projection.rebuildBatch({
    apply: true,
    pollId: p.id,
    batchSize: 1,
    cursor: one.nextCursor,
  });
  assert.equal(two.hasMore, false);
  assert.equal(
    await f.db.trendContribution.count({ where: { pollId: p.id } }),
    2,
  );
  const before = await f.db.trendContribution.findMany({
    where: { pollId: p.id },
    orderBy: { voterId: "asc" },
  });
  await projection.rebuildBatch({ apply: true, pollId: p.id });
  assert.deepEqual(
    await f.db.trendContribution.findMany({
      where: { pollId: p.id },
      orderBy: { voterId: "asc" },
    }),
    before,
  );
  await assert.rejects(
    projection.rebuildBatch({ pollId: randomUUID(), cursor: one.nextCursor }),
  );
  await assert.rejects(projection.rebuildBatch({ batchSize: 101 }));
});

test("bozuk/eski snapshot bugünkü katalogla doldurulmaz; onarım eksik veriyi raporlar", async () => {
  const a = await product(),
    p = await poll([tag(a)]);
  const event = await vote(p);
  const tagId = p.options[0].products[0].id;
  await f.db.productTag.update({
    where: { id: tagId },
    data: { catalogSnapshot: { schemaVersion: 1, id: a.id } },
  });
  await assert.rejects(project(event));
  const result = await projection.rebuildBatch({ apply: true, pollId: p.id });
  assert.equal(result.invalidSnapshots, 1);
  assert.equal(result.contributionCount, 0);
  assert.equal((await signals(p.id)).length, 0);
});

test("outbox başarısızlığı katkı ve yayınlandı işaretini geri alır; sonraki teslim güvenlidir", async () => {
  const a = await product(),
    p = await poll([tag(a)]),
    event = await vote(p);
  const { OutboxDispatcher, OutboxRegistry } = await loadBackend(
    "common/outbox/outbox-dispatcher",
  );
  const registry = f.app.get(OutboxRegistry),
    dispatcher = f.app.get(OutboxDispatcher);
  assert.ok(
    registry.for("poll.vote.cast").some((x: any) => x.name === consumer.name),
  );
  let fail = true;
  registry.register({
    name: "test-after-trend",
    types: ["poll.vote.cast"],
    project: async () => {
      if (fail) throw new Error("test after projection");
    },
  });
  await f.db.outboxEvent.update({
    where: { id: event.id },
    data: { createdAt: new Date(0), availableAt: new Date(0) },
  });
  assert.equal(await dispatcher.drain(1, 1), 0);
  assert.equal(
    await f.db.trendContribution.count({ where: { pollId: p.id } }),
    0,
  );
  assert.equal(
    (await f.db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } }))
      .publishedAt,
    null,
  );
  fail = false;
  await f.db.outboxEvent.update({
    where: { id: event.id },
    data: { availableAt: new Date(0) },
  });
  assert.equal(await dispatcher.drain(1, 1), 1);
  assert.equal((await signals(p.id)).length, 1);
});

test("trend ham kaynakları HTTP'ye açılmaz; FK/tekillik ve veri sınırları DB'de korunur", async () => {
  const a = await product(),
    p = await poll([tag(a)]);
  await project(await vote(p));
  const row = await f.db.trendContribution.findFirstOrThrow({
    where: { pollId: p.id },
  });
  await assert.rejects(f.db.trendContribution.create({ data: row }));
  await assert.rejects(
    f.db.trendContribution.update({
      where: {
        pollId_voterId_sourceCatalogProductId: {
          pollId: row.pollId,
          voterId: row.voterId,
          sourceCatalogProductId: row.sourceCatalogProductId,
        },
      },
      data: { priceMinor: -1 },
    }),
  );
  assert.equal(
    (await f.http("GET", "/trends/contributions", f.actors[1])).status,
    404,
  );
});
