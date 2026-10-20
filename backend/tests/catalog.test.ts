import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { domainApp, loadBackend } from "./helpers/domain-app.js";
let f: Awaited<ReturnType<typeof domainApp>>;
beforeEach(async () => {
  f = await domainApp();
});
afterEach(async () => {
  await f?.cleanup();
});
const reason = "Test için incelendi";
async function store() {
  return f.ok("POST", "/admin/catalog/stores", f.actors[0], {
    name: "Deneme mağazası",
    domain: `shop-${randomUUID()}.com`,
    trackingParameters: ["affid"],
    reason,
  });
}
async function product(fields: Record<string, unknown> = {}) {
  return f.ok("POST", "/admin/catalog/products", f.actors[0], {
    title: "Siyah saten gömlek",
    brand: "Deneme",
    category: "OUTFIT",
    reason,
    ...fields,
  });
}
const edit = (row: any, fields: Record<string, unknown> = {}) => ({
  expectedVersion: row.version,
  title: row.title,
  brand: row.brand,
  category: row.category,
  priceMinor: row.priceMinor,
  currency: row.currency,
  status: row.status,
  reason,
  ...fields,
});

test("katalog kimlik ve katı DTO ister; normal kullanıcı ortak kaydı yönetemez", async () => {
  assert.equal((await f.http("GET", "/catalog/products", null)).status, 401);
  assert.equal(
    (
      await f.http("POST", "/admin/catalog/stores", f.actors[1], {
        name: "X",
        domain: "shop.com",
        reason,
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.http("POST", "/catalog/resolve", f.actors[1], {})).status,
    400,
  );
  assert.equal(
    (
      await f.http("POST", "/catalog/suggestions", f.actors[1], {
        title: "Ürün",
        category: "OUTFIT",
        status: "APPROVED",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.http(
        "POST",
        "/catalog/suggestions",
        f.actors[1],
        { title: "Ürün", category: "OUTFIT" },
        null,
      )
    ).status,
    400,
  );
  for (const url of [
    "file:///etc/passwd",
    "http://127.0.0.1/item",
    "https://localhost/item",
    "https://user:pass@store.com/item",
    "https://store.com:8443/item",
  ])
    assert.equal(
      (await f.http("POST", "/catalog/resolve", f.actors[1], { url })).status,
      422,
    );
  for (const title of ["ab\u0000cd", "   "]) {
    assert.equal(
      (
        await f.http("POST", "/catalog/suggestions", f.actors[1], {
          title,
          category: "OUTFIT",
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await f.http("POST", "/admin/catalog/stores", f.actors[0], {
        name: "Store",
        domain: "store.com",
        reason: "   ",
      })
    ).status,
    400,
  );
  const p = await product();
  assert.equal(
    (
      await f.http(
        "PUT",
        `/admin/catalog/products/${p.id}`,
        f.actors[1],
        edit(p),
      )
    ).status,
    403,
  );
});

test("link kesin eşleşir; özgün affiliate URL korunur, ürün/varyant parametreleri silinmez", async () => {
  const s = await store(),
    canonical = `https://${s.domain}/p/123?color=red&size=m`;
  const p = await product({
    storeId: s.id,
    url: canonical,
    externalId: "123",
    variantKey: "red-m",
    priceMinor: 250099,
    currency: "TRY",
  });
  const original = `https://www.${s.domain}/p/123?size=m&utm_source=test&color=red&affid=creator-1`;
  const r = await f.ok("POST", "/catalog/resolve", f.actors[1], {
    url: original,
  });
  assert.equal(r.match, "EXACT");
  assert.equal(r.product.id, p.id);
  assert.equal(r.originalUrl, original);
  assert.equal(r.normalizedUrl, canonical);
  assert.equal(r.product.priceMinor, 250099);
  assert.ok(r.product.priceRecordedAt);
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[1], {
        url: canonical.replace("red", "blue"),
      })
    ).match,
    "UNMATCHED",
  );
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[1], {
        url: `https://${s.domain}/#/product/123`,
      })
    ).match,
    "UNMATCHED",
  );
});

test("isim ve marka yalnız aday verir; aynı adlı farklı ürünler otomatik birleştirilmez", async () => {
  const a = await product(),
    b = await product({ brand: "Başka" });
  const result = await f.ok("POST", "/catalog/resolve", f.actors[1], {
    query: "siyah saten gömlek",
  });
  assert.equal(result.match, "CANDIDATES");
  assert.equal(result.product, null);
  assert.deepEqual(
    new Set(result.candidates.map((p: any) => p.id)),
    new Set([a.id, b.id]),
  );
  const narrow = await f.ok("POST", "/catalog/resolve", f.actors[1], {
    query: "saten gömlek",
    brand: "Deneme",
  });
  assert.equal(narrow.match, "CANDIDATES");
  assert.equal(narrow.candidates.length, 1);
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[1], {
        query: `yok-${randomUUID()}`,
      })
    ).match,
    "UNMATCHED",
  );
});

test("kullanıcı önerisi özeldir, tekrar tek kayıt üretir ve ortak katalog yaratmaz", async () => {
  const input = {
    title: "Öneri kıyafet",
    category: "SHOES",
    url: "https://unknown-store.com/p/a?affid=private-id",
    priceMinor: 9900,
    currency: "EUR",
  };
  const key = randomUUID(),
    a = await f.ok("POST", "/catalog/suggestions", f.actors[1], input, key),
    replay = await f.ok(
      "POST",
      "/catalog/suggestions",
      f.actors[1],
      input,
      key,
    );
  const repeated = await f.ok(
    "POST",
    "/catalog/suggestions",
    f.actors[1],
    input,
  );
  assert.equal(a.id, replay.id);
  assert.equal(a.id, repeated.id);
  assert.equal(a.status, "PENDING");
  assert.equal(a.originalUrl, input.url);
  assert.equal("fingerprint" in a, false);
  assert.equal("submittedById" in a, false);
  assert.equal(
    (await f.http("GET", `/catalog/suggestions/${a.id}`, f.actors[2])).status,
    404,
  );
  assert.equal(
    (await f.ok("GET", "/catalog/suggestions", f.actors[2])).items.length,
    0,
  );
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[2], {
        query: input.title,
      })
    ).match,
    "UNMATCHED",
  );
  assert.equal(
    await f.db.catalogProduct.count({ where: { title: input.title } }),
    0,
  );
  assert.equal(
    (
      await f.http(
        "POST",
        "/catalog/suggestions",
        f.actors[1],
        { ...input, priceMinor: 1 },
        key,
      )
    ).status,
    409,
  );
});

test("yönetici öneriyi doğrulanmış ürüne onaylar veya gerekçeyle reddeder; sürüm ve audit atomiktir", async () => {
  const suggestion = await f.ok("POST", "/catalog/suggestions", f.actors[1], {
    title: "Öneri",
    category: "BAG",
  });
  assert.equal(
    (
      await f.http(
        "PUT",
        `/admin/catalog/suggestions/${suggestion.id}/decision`,
        f.actors[0],
        { expectedVersion: 0, decision: "APPROVE", reason },
      )
    ).status,
    422,
  );
  const p = await product();
  const body = {
      expectedVersion: 0,
      decision: "APPROVE",
      productId: p.id,
      reason,
    },
    key = randomUUID();
  const approved = await f.ok(
    "PUT",
    `/admin/catalog/suggestions/${suggestion.id}/decision`,
    f.actors[0],
    body,
    key,
  );
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.resolvedProductId, p.id);
  assert.deepEqual(
    await f.ok(
      "PUT",
      `/admin/catalog/suggestions/${suggestion.id}/decision`,
      f.actors[0],
      body,
      key,
    ),
    approved,
  );
  assert.equal(
    (
      await f.http(
        "PUT",
        `/admin/catalog/suggestions/${suggestion.id}/decision`,
        f.actors[0],
        { ...body, expectedVersion: 1 },
      )
    ).status,
    409,
  );
  assert.equal(
    await f.db.moderationAudit.count({ where: { resourceId: suggestion.id } }),
    1,
  );
  const second = await f.ok("POST", "/catalog/suggestions", f.actors[1], {
    title: "Diğer öneri",
    category: "BAG",
  });
  const denied = await f.ok(
    "PUT",
    `/admin/catalog/suggestions/${second.id}/decision`,
    f.actors[0],
    { expectedVersion: 0, decision: "REJECT", reason },
  );
  assert.equal(denied.status, "REJECTED");
  assert.equal(denied.resolvedProductId, null);
});

test("fiyat ve para birimi ayrı kalır, bayat sürüm ortak ürünü değiştiremez", async () => {
  const p = await product({ priceMinor: 12345, currency: "USD" });
  const saved = await f.ok(
    "PUT",
    `/admin/catalog/products/${p.id}`,
    f.actors[0],
    edit(p, { priceMinor: 9988, currency: "EUR" }),
  );
  assert.equal(saved.currency, "EUR");
  assert.equal(saved.priceMinor, 9988);
  assert.equal(
    (
      await f.http(
        "PUT",
        `/admin/catalog/products/${p.id}`,
        f.actors[0],
        edit(p),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.http("POST", "/admin/catalog/products", f.actors[0], {
        title: "X",
        category: "BAG",
        priceMinor: -1,
        reason,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.http("POST", "/admin/catalog/products", f.actors[0], {
        title: "X",
        category: "BAG",
        currency: "XXX",
        reason,
      })
    ).status,
    400,
  );
  assert.equal(
    (await f.ok("GET", `/catalog/products/${p.id}`, f.actors[1])).priceMinor,
    9988,
  );
});

test("tekil mağaza/ürün kimliği ve alias korunur, hata 500 yerine çatışmadır", async () => {
  const s = await store();
  const p = await product({
    storeId: s.id,
    externalId: "sku-1",
    url: `https://${s.domain}/sku-1`,
  });
  assert.equal(
    (
      await f.http("POST", "/admin/catalog/products", f.actors[0], {
        title: "Kopya",
        category: "OUTFIT",
        storeId: s.id,
        externalId: "sku-1",
        reason,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.http("POST", "/admin/catalog/stores", f.actors[0], {
        name: "Kopya",
        domain: s.domain,
        reason,
      })
    ).status,
    409,
  );
  const aliased = await f.ok(
    "POST",
    `/admin/catalog/products/${p.id}/urls`,
    f.actors[0],
    { expectedVersion: p.version, url: `https://${s.domain}/new-path`, reason },
  );
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[1], {
        url: `https://${s.domain}/new-path`,
      })
    ).product.id,
    p.id,
  );
  const b = await product({ storeId: s.id });
  assert.equal(
    (
      await f.http(
        "POST",
        `/admin/catalog/products/${b.id}/urls`,
        f.actors[0],
        {
          expectedVersion: b.version,
          url: `https://${s.domain}/new-path`,
          reason,
        },
      )
    ).status,
    409,
  );
  assert.equal(aliased.version, p.version + 1);
});

test("birleştirme eski ID ve bağlantıları hedefe taşır; döngü ve farklı varyant reddedilir", async () => {
  const s = await store(),
    a = await product({ storeId: s.id, url: `https://${s.domain}/a` }),
    b = await product({ storeId: s.id, url: `https://${s.domain}/b` });
  const merged = await f.ok(
    "POST",
    `/admin/catalog/products/${a.id}/merge`,
    f.actors[0],
    {
      expectedVersion: a.version,
      targetId: b.id,
      targetVersion: b.version,
      reason,
    },
  );
  const redirected = await f.ok(
    "GET",
    `/catalog/products/${a.id}`,
    f.actors[1],
  );
  assert.equal(redirected.id, b.id);
  assert.equal(redirected.redirectedFromId, a.id);
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[1], {
        url: `https://${s.domain}/a`,
      })
    ).product.id,
    b.id,
  );
  assert.equal(
    (
      await f.http(
        "POST",
        `/admin/catalog/products/${b.id}/merge`,
        f.actors[0],
        {
          expectedVersion: merged.product.version,
          targetId: a.id,
          targetVersion: 1,
          reason,
        },
      )
    ).status,
    409,
  );
  const variant = await product({ storeId: s.id, variantKey: "red" });
  assert.equal(
    (
      await f.http(
        "POST",
        `/admin/catalog/products/${variant.id}/merge`,
        f.actors[0],
        {
          expectedVersion: 0,
          targetId: b.id,
          targetVersion: merged.product.version,
          reason,
        },
      )
    ).status,
    422,
  );
});

test("arşiv veya kapalı mağaza genel arama/çözümlemede görünmez; cursor filtreye bağlıdır", async () => {
  const s = await store(),
    a = await product({ storeId: s.id, url: `https://${s.domain}/a` }),
    b = await product({ storeId: s.id });
  const list = await f.ok(
    "GET",
    "/catalog/products?q=saten&limit=1",
    f.actors[1],
  );
  assert.ok(list.nextCursor);
  assert.equal(
    (
      await f.http(
        "GET",
        `/catalog/products?q=başka&cursor=${list.nextCursor}`,
        f.actors[1],
      )
    ).status,
    400,
  );
  const archived = await f.ok(
    "PUT",
    `/admin/catalog/products/${a.id}`,
    f.actors[0],
    edit(a, { status: "ARCHIVED" }),
  );
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(
    (await f.http("GET", `/catalog/products/${a.id}`, f.actors[1])).status,
    404,
  );
  await f.ok("PUT", `/admin/catalog/stores/${s.id}`, f.actors[0], {
    expectedVersion: 0,
    name: s.name,
    active: false,
    reason,
  });
  assert.equal(
    (await f.http("GET", `/catalog/products/${b.id}`, f.actors[1])).status,
    404,
  );
  assert.equal(
    (
      await f.ok("POST", "/catalog/resolve", f.actors[1], {
        url: `https://${s.domain}/a`,
      })
    ).match,
    "UNMATCHED",
  );
});

test("hesap silme özel katalog önerisini temizler; ortak ürüne dokunmaz", async () => {
  const p = await product();
  await f.ok("POST", "/catalog/suggestions", f.actors[1], {
    title: "Özel öneri",
    category: "BAG",
    url: "https://unknown-store.com/p?affid=deleted-user",
  });
  await f.ok("DELETE", "/me/account", f.actors[1], { confirmDeletion: true });
  const { AccountErasureService } = await loadBackend(
    "modules/accounts/account-erasure.service",
  );
  await f.app.get(AccountErasureService).erase(f.actors[1].id);
  assert.equal(
    await f.db.catalogSuggestion.count({
      where: { submittedById: f.actors[1].id },
    }),
    0,
  );
  assert.ok(await f.db.catalogProduct.findUnique({ where: { id: p.id } }));
});

test("audit/olay hatasında ürün ve işlem makbuzu rollback olur; OpenAPI sözleşmesi vardır", async () => {
  const original = f.db.$transaction.bind(f.db),
    title = `rollback-${randomUUID()}`;
  (f.db as any).$transaction = (work: any, options: any) =>
    original(async (tx: any) => {
      tx.outboxEvent.create = async () => {
        throw new Error("test");
      };
      return work(tx);
    }, options);
  const response = await f.http(
    "POST",
    "/admin/catalog/products",
    f.actors[0],
    { title, category: "BAG", reason },
  );
  assert.equal(response.status, 500);
  (f.db as any).$transaction = original;
  assert.equal(await f.db.catalogProduct.count({ where: { title } }), 0);
  const schema = await f.ok("GET", "/openapi.json");
  assert.ok(schema.paths["/v1/catalog/resolve"]);
  assert.ok(schema.paths["/v1/admin/catalog/products/{id}/merge"]);
});

test("öneri kotası ve kullanıcı/filtreye bağlı cursor korunur", async () => {
  const a = await f.ok("POST", "/catalog/suggestions", f.actors[1], {
    title: "Kota önerisi A",
    category: "BAG",
  });
  await f.ok("POST", "/catalog/suggestions", f.actors[1], {
    title: "Kota önerisi B",
    category: "BAG",
  });
  const page = await f.ok("GET", "/catalog/suggestions?limit=1", f.actors[1]);
  assert.ok(page.nextCursor);
  assert.equal(
    (
      await f.http(
        "GET",
        `/catalog/suggestions?cursor=${page.nextCursor}`,
        f.actors[2],
      )
    ).status,
    400,
  );
  await f.db.catalogSuggestion.createMany({
    data: Array.from({ length: 18 }, (_, i) => ({
      submittedById: f.actors[1].id,
      fingerprint: `${i}`.padStart(64, "0"),
      title: `Kota ${i}`,
      category: "BAG" as const,
    })),
  });
  assert.equal(
    (
      await f.http("POST", "/catalog/suggestions", f.actors[1], {
        title: "Kota aşıldı",
        category: "BAG",
      })
    ).status,
    429,
  );
  assert.equal(
    (
      await f.ok("POST", "/catalog/suggestions", f.actors[1], {
        title: "Kota önerisi A",
        category: "BAG",
      })
    ).id,
    a.id,
  );
  assert.equal(
    (
      await f.http("POST", "/catalog/resolve", f.actors[1], {
        query: "ab\u0000cd",
      })
    ).status,
    400,
  );
});

test("fiyat-tarih çifti DB seviyesinde korunur", async () => {
  for (const [priceMinor, priceRecordedAt] of [
    [null, new Date()],
    [100, null],
    [-100, new Date()],
  ] as const) {
    await assert.rejects(
      f.db.catalogProduct.create({
        data: {
          title: "DB test",
          normalizedTitle: "db test",
          category: "BAG",
          priceMinor,
          priceRecordedAt,
        },
      }),
      (error: unknown) =>
        String((error as Error).message).includes("CatalogProduct_price"),
    );
    await assert.rejects(
      f.db.catalogSuggestion.create({
        data: {
          submittedById: f.actors[1].id,
          fingerprint: randomUUID().replaceAll("-", "").padEnd(64, "0"),
          title: "DB test",
          category: "BAG",
          priceMinor,
          priceRecordedAt,
        },
      }),
      (error: unknown) =>
        String((error as Error).message).includes("CatalogSuggestion_price"),
    );
  }
});
