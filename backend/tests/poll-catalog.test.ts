import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import { domainApp } from "./helpers/domain-app.js";
let f: Awaited<ReturnType<typeof domainApp>>;
let defaultStore: { id: string; domain: string } | undefined;
beforeEach(async () => {
  f = await domainApp();
  defaultStore = undefined;
});
afterEach(async () => {
  await f?.cleanup();
});
const reason = "Ürün etiketi testi";
async function product(fields: Record<string, unknown> = {}) {
  if (!fields.storeId && !defaultStore)
    defaultStore = await f.ok("POST", "/admin/catalog/stores", f.actors[0], {
      name: "Test mağazası",
      domain: `shop-${randomUUID()}.com`,
      reason,
    });
  return f.ok("POST", "/admin/catalog/products", f.actors[0], {
    title: "Katalog gömleği",
    category: "OUTFIT",
    priceMinor: 129900,
    currency: "TRY",
    ...(!fields.storeId
      ? {
          storeId: defaultStore!.id,
          url: `https://${defaultStore!.domain}/p/${randomUUID()}`,
        }
      : {}),
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
async function options(products: unknown[][]) {
  return Promise.all(
    products.map(async (items, i) => {
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
      return { position: i + 1, mediaId: id, products: items };
    }),
  );
}
async function draft(items: unknown[][], fields: Record<string, unknown> = {}) {
  return f.ok("POST", "/polls", f.actors[0], {
    question: "Hangisi?",
    options: await options(items),
    ...fields,
  });
}
async function publish(p: any, key?: string) {
  return f.ok(
    "POST",
    `/polls/${p.id}/publish`,
    f.actors[0],
    { expectedVersion: p.version },
    key,
  );
}
const tag = (p: any, fields: Record<string, unknown> = {}) => ({
  catalogProductId: p.id,
  ...fields,
});

test("katalog kimliği sunucudan ürün/fiyat bağlamı alır; eski elle etiketler çalışır", async () => {
  const p = await product();
  const manual = {
    title: "Kendi ürünüm",
    externalUrl: "https://example.com/manual?aff=kept",
    priceMinor: 100,
    currency: "EUR",
  };
  const d = await draft([[tag(p), manual], []]);
  const linked = d.options[0].products.find((x: any) => x.source === "CATALOG");
  assert.equal(linked.catalogProductId, p.id);
  assert.equal(linked.title, p.title);
  assert.equal(linked.priceMinor, p.priceMinor);
  assert.equal(linked.priceRecordedAt, p.priceRecordedAt);
  assert.equal(linked.catalogSnapshot.version, p.version);
  assert.equal(linked.catalogSnapshot.category, "OUTFIT");
  const own = d.options[0].products.find(
    (x: any) => x.source === "USER_ENTERED",
  );
  assert.equal(own.externalUrl, manual.externalUrl);
  assert.equal(own.catalogProductId, null);
  assert.equal(own.catalogSnapshot, null);
});

test("istemci katalog alanı/snapshot uyduramaz ve başka ürüne link veremez; hata atomiktir", async () => {
  const p = await product(),
    opts = await options([[], []]);
  for (const fields of [
    { title: "Sahte" },
    { priceMinor: 1 },
    { currency: "USD" },
    { brand: null },
    { catalogSnapshot: {} },
    { source: "CATALOG" },
    { externalUrl: "https://example.com/unrelated" },
  ]) {
    const response = await f.http("POST", "/polls", f.actors[0], {
      options: [{ ...opts[0], products: [tag(p, fields)] }, opts[1]],
    });
    assert.ok([400, 422].includes(response.status), JSON.stringify(response));
  }
  assert.equal(
    await f.db.poll.count({ where: { authorId: f.actors[0].id } }),
    0,
  );
  assert.equal(
    await f.db.idempotencyRecord.count({
      where: { userId: f.actors[0].id, scope: "polls.create" },
    }),
    0,
  );
});

test("yayın güncel katalog snapshot'ını sabitler; sonraki düzeltme ve oy eski bilgiyi değiştirmez", async () => {
  const p = await product(),
    d = await draft([[tag(p)], []]);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${p.id}`,
    f.actors[0],
    edit(p, { title: "Yeni ad", priceMinor: 150000 }),
  );
  const key = randomUUID(),
    published = await publish(d, key),
    frozen = published.options[0].products[0];
  assert.equal(frozen.title, "Yeni ad");
  assert.equal(frozen.priceMinor, 150000);
  assert.equal(frozen.catalogSnapshot.version, 1);
  const current = await f.ok("GET", `/admin/catalog/products/${p.id}`);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${p.id}`,
    f.actors[0],
    edit(current, { title: "Sonradan düzeltildi", priceMinor: 200000 }),
  );
  assert.deepEqual(await publish(d, key), published);
  await f.ok("PUT", `/polls/${d.id}/vote`, f.actors[1], {
    optionId: published.options[0].id,
  });
  const detail = await f.ok("GET", `/polls/${d.id}`, f.actors[1]);
  assert.deepEqual(detail.options[0].products[0], frozen);
  const feed = await f.ok("GET", "/feed", f.actors[2]);
  assert.deepEqual(
    feed.items.find((x: any) => x.id === d.id).options[0].products[0],
    frozen,
  );
  assert.equal(
    (await f.ok("GET", `/polls/${d.id}/results`, f.actors[1])).totalVotes,
    1,
  );
});

test("özgün affiliate bağlantısı korunur; kanonik kimlik tracking parametrelerinden bağımsızdır", async () => {
  const domain = `shop-${randomUUID()}.com`;
  const store = await f.ok("POST", "/admin/catalog/stores", f.actors[0], {
    name: "Mağaza",
    domain,
    trackingParameters: ["affid"],
    reason,
  });
  const p = await product({
    storeId: store.id,
    url: `https://${domain}/p/42?size=m`,
  });
  const original = `${p.canonicalUrl}&affid=creator&utm_source=podyum`;
  const published = await publish(
    await draft([[tag(p, { externalUrl: original })], []]),
  );
  assert.equal(published.options[0].products[0].externalUrl, original);
  assert.equal(
    published.options[0].products[0].catalogSnapshot.canonicalUrl,
    p.canonicalUrl,
  );
});

test("birleştirme eski yayını yeniden yazmaz; taslak yayınlanırken hedef kimliğe bağlanır", async () => {
  const a = await product(),
    b = await product({ title: "Hedef" });
  const published = await publish(await draft([[tag(a)], []])),
    pending = await draft([[tag(a)], []]);
  await f.ok("POST", `/admin/catalog/products/${a.id}/merge`, f.actors[0], {
    expectedVersion: 0,
    targetId: b.id,
    targetVersion: 0,
    reason,
  });
  const old = await f.ok("GET", `/polls/${published.id}`);
  assert.equal(old.options[0].products[0].catalogProductId, a.id);
  assert.equal(old.options[0].products[0].title, a.title);
  const newer = await publish(pending);
  assert.equal(newer.options[0].products[0].catalogProductId, b.id);
  assert.equal(newer.options[0].products[0].title, b.title);
  assert.equal(newer.options[0].products[0].externalUrl, a.canonicalUrl);
});

test("aynı ürün bir seçenekte tekrarlanamaz; farklı seçeneklerde kullanılabilir", async () => {
  const p = await product(),
    opts = await options([[tag(p), tag(p)], []]);
  const response = await f.http("POST", "/polls", f.actors[0], {
    options: opts,
  });
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "DUPLICATE_PRODUCT_TAG");
  const d = await draft([[tag(p)], [tag(p)]]);
  assert.equal(d.options[1].products[0].catalogProductId, p.id);
  const manual = {
    title: "Manual",
    externalUrl: "https://example.com/product",
  };
  assert.equal(
    (
      await f.http("POST", "/polls", f.actors[0], {
        options: await options([[manual, manual]]),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.http("POST", "/polls", f.actors[0], {
        options: await options([Array.from({ length: 11 }, () => tag(p))]),
      })
    ).status,
    400,
  );
});

test("birleşen iki taslak etiketi çift hedefe dönüşürse yayın 422 ile tamamen geri alınır", async () => {
  const a = await product(),
    b = await product(),
    d = await draft([[tag(a), tag(b)], []]);
  await f.ok("POST", `/admin/catalog/products/${a.id}/merge`, f.actors[0], {
    expectedVersion: 0,
    targetId: b.id,
    targetVersion: 0,
    reason,
  });
  const response = await f.http("POST", `/polls/${d.id}/publish`, f.actors[0], {
    expectedVersion: d.version,
  });
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "DUPLICATE_PRODUCT_TAG");
  const after = await f.ok("GET", `/polls/${d.id}`);
  assert.equal(after.status, "DRAFT");
  assert.deepEqual(after.options, d.options);
});

test("yayından önce arşivlenen ürün yayını durdurur; taslaktan kaldırılabilir", async () => {
  const p = await product(),
    d = await draft([[tag(p)], []]);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${p.id}`,
    f.actors[0],
    edit(p, { status: "ARCHIVED" }),
  );
  const response = await f.http("POST", `/polls/${d.id}/publish`, f.actors[0], {
    expectedVersion: d.version,
  });
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "CATALOG_PRODUCT_UNAVAILABLE");
  const fixed = await f.ok("PATCH", `/polls/${d.id}`, f.actors[0], {
    expectedVersion: d.version,
    options: d.options.map((o: any) => ({
      position: o.position,
      mediaId: o.mediaId,
      products: [],
    })),
  });
  assert.equal((await publish(fixed)).status, "OPEN");
});

test("FRIENDS paylaşımının ürün snapshot'ı dış kullanıcıya sızmaz; yayın sonrası etiket değişmez", async () => {
  const p = await product(),
    published = await publish(
      await draft([[tag(p)], []], { visibility: "FRIENDS" }),
    );
  assert.equal(
    (await f.http("GET", `/polls/${published.id}`, f.actors[1])).status,
    404,
  );
  const feed = await f.ok("GET", "/feed", f.actors[1]);
  assert.ok(!feed.items.some((x: any) => x.id === published.id));
  const response = await f.http(
    "PATCH",
    `/polls/${published.id}`,
    f.actors[0],
    { expectedVersion: published.version, options: [] },
  );
  assert.equal(response.status, 409);
});

test("olay hatası yayın snapshot'ını, sürümü ve işlem makbuzunu geri alır", async () => {
  const p = await product(),
    d = await draft([[tag(p)], []]);
  await f.ok(
    "PUT",
    `/admin/catalog/products/${p.id}`,
    f.actors[0],
    edit(p, { priceMinor: 999 }),
  );
  const original = f.db.$transaction.bind(f.db) as any;
  (f.db as any).$transaction = (work: any, opts: any) =>
    original(async (tx: any) => {
      tx.outboxEvent.create = async () => {
        throw new Error("test outbox failure");
      };
      return work(tx);
    }, opts);
  try {
    assert.equal(
      (
        await f.http("POST", `/polls/${d.id}/publish`, f.actors[0], {
          expectedVersion: d.version,
        })
      ).status,
      500,
    );
  } finally {
    (f.db as any).$transaction = original;
  }
  const after = await f.ok("GET", `/polls/${d.id}`);
  assert.equal(after.version, d.version);
  assert.equal(after.status, "DRAFT");
  assert.deepEqual(after.options, d.options);
  assert.equal(
    await f.db.idempotencyRecord.count({
      where: { scope: `polls.publish:${d.id}` },
    }),
    0,
  );
});

test("FK/snapshot çifti DB'de korunur; OpenAPI katalog etiket alanlarını içerir", async () => {
  const p = await product(),
    d = await draft([[tag(p)], []]),
    tagged = d.options[0].products[0];
  await assert.rejects(
    f.db
      .$executeRaw`UPDATE "ProductTag" SET "catalogProductId" = NULL WHERE "id" = ${tagged.id}::uuid`,
  );
  const spec = await f.ok("GET", "/openapi.json");
  assert.ok(
    spec.components.schemas.ProductTagInputDto.properties.catalogProductId,
  );
  assert.ok(
    spec.components.schemas.ProductTagResponseDto.properties.catalogSnapshot,
  );
});

test("gerçek fotoğraf yükle → katalog seç → yayınla → tercih → ürün ve fotoğraf erişimi", async () => {
  const p = await product();
  const origin = await f.app.getUrl();
  const png = await sharp({
    create: { width: 48, height: 64, channels: 3, background: "#789988" },
  })
    .png()
    .toBuffer();
  const opts = [];
  for (let i = 1; i <= 2; i++) {
    const grant = await f.ok("POST", "/media/uploads", f.actors[0], {
      purpose: "POLL",
      mimeType: "image/png",
      byteSize: png.length,
      blurRequested: false,
    });
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(png)], { type: "image/png" }),
      "outfit.png",
    );
    const response = await fetch(`${origin}${grant.upload.path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${f.actors[0].token}`,
        "X-Upload-Token": grant.upload.token,
      },
      body: form,
    });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    await f.ok("POST", `/media/${grant.asset.id}/complete`, f.actors[0], {});
    await f.ok("POST", `/media/${grant.asset.id}/accept-preview`, f.actors[0], {
      confirmed: true,
    });
    opts.push({
      position: i,
      mediaId: grant.asset.id,
      products: i === 1 ? [tag(p)] : [],
    });
  }
  const pending = await f.ok("POST", "/polls", f.actors[0], {
    question: "Katalog fotoğraf testi",
    options: opts,
  });
  const published = await publish(pending);
  await f.ok("PUT", `/polls/${published.id}/vote`, f.actors[1], {
    optionId: published.options[0].id,
  });
  const detail = await f.ok("GET", `/polls/${published.id}`, f.actors[1]);
  assert.equal(detail.options[0].products[0].catalogProductId, p.id);
  const photo = await fetch(`${origin}${detail.options[0].media.displayPath}`, {
    headers: { Authorization: `Bearer ${f.actors[1].token}` },
  });
  assert.equal(photo.status, 200);
  assert.ok((await photo.arrayBuffer()).byteLength > 0);
});
