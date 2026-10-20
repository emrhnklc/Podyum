import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/lib/api/client";
import { trendsPath } from "../src/features/trends/api/trends";
import {
  catalogLink,
  catalogPrice,
} from "../src/features/catalog/catalog-product";
import { TrendList } from "../src/features/trends/trend-list";
import {
  DEFAULT_TREND_FILTERS,
  type TrendItem,
  type TrendsPage,
} from "../src/features/trends/types";

function page(
  ids = ["a"],
  cursor: string | null = null,
  status: TrendsPage["status"] = "READY",
): TrendsPage {
  return {
    status,
    nextCursor: cursor,
    items: ids.map((id, index): TrendItem => ({
      id,
      rank: index + 1,
      score: 5,
      distinctVoters: 5,
      latestSignalAt: "2026-10-20T00:00:00.000Z",
      product: {
        id,
        title: id,
        brand: "Marka",
        category: "SHOES",
        canonicalUrl: "https://example.test/p",
        version: 0,
        priceMinor: 12345,
        currency: "TRY",
        priceRecordedAt: null,
        store: null,
      },
    })),
    period: {
      period: "WEEK",
      anchorDate: "2026-10-20",
      startDate: "2026-10-19",
      endDate: "2026-10-26",
      startsAt: "2026-10-18T21:00:00.000Z",
      endsAt: "2026-10-25T21:00:00.000Z",
      timeZone: "Europe/Istanbul",
    },
    filters: {
      category: null,
      brand: null,
      gender: null,
      ageBand: null,
      currency: "TRY",
      minPriceMinor: null,
      maxPriceMinor: null,
    },
    population: "GENERAL_PREFERENCES",
    policy: {
      version: 1,
      measurement: "PRODUCTS_IN_PREFERRED_OUTFITS",
      timeZone: "Europe/Istanbul",
      day: "CALENDAR",
      weekStartsOn: "MONDAY",
      month: "CALENDAR",
      score: "FIRST_ELIGIBLE_VOTE_PER_VOTER_PRODUCT_DAY",
      minimumDistinctVoters: 5,
    },
    priceBasis: "PUBLICATION_SNAPSHOT",
    productBasis: "CURRENT_CATALOG",
    consistency: "EVENTUAL",
    asOf: "2026-10-20T00:00:00.000Z",
    computedAt: "2026-10-20T00:00:00.000Z",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const path = trendsPath(DEFAULT_TREND_FILTERS);

test("filtreler sunucuya gider; özel karakterli marka yeni parametre ekleyemez", () => {
  const value = new URL(
    trendsPath(
      {
        ...DEFAULT_TREND_FILTERS,
        period: "DAY",
        category: "BAG",
        voter: "WOMAN",
        age: "AGE_18_24",
        currency: "EUR",
        brand: " A&B + Çanta ",
        price: "FROM_750_TO_2000",
      },
      "a+/=",
    ),
    "http://localhost",
  );
  assert.equal(value.searchParams.get("period"), "DAY");
  assert.equal(value.searchParams.get("gender"), "WOMAN");
  assert.equal(value.searchParams.get("ageBand"), "AGE_18_24");
  assert.equal(value.searchParams.get("category"), "BAG");
  assert.equal(value.searchParams.get("brand"), "A&B + Çanta");
  assert.equal(value.searchParams.get("currency"), "EUR");
  assert.equal(value.searchParams.get("minPriceMinor"), "75000");
  assert.equal(value.searchParams.get("maxPriceMinor"), "200000");
  assert.equal(value.searchParams.get("cursor"), "a+/=");
  assert.equal(value.searchParams.get("limit"), "20");
  const general = new URL(path, "http://localhost");
  for (const key of [
    "gender",
    "ageBand",
    "brand",
    "category",
    "minPriceMinor",
    "maxPriceMinor",
  ])
    assert.equal(general.searchParams.has(key), false);
});
test("fiyat aralıklarının kuruş sınırları çakışmaz; para birimi korunur", () => {
  const under = new URL(
    trendsPath({ ...DEFAULT_TREND_FILTERS, price: "UNDER_750" }),
    "http://localhost",
  );
  assert.equal(under.searchParams.get("maxPriceMinor"), "74999");
  const over = new URL(
    trendsPath({ ...DEFAULT_TREND_FILTERS, price: "OVER_2000" }),
    "http://localhost",
  );
  assert.equal(over.searchParams.get("minPriceMinor"), "200001");
  assert.equal(catalogPrice(null, "TRY"), "Fiyat belirtilmedi");
  assert.match(catalogPrice(12345, "EUR"), /123,45/);
  assert.notEqual(catalogPrice(12345, "EUR"), catalogPrice(12345, "TRY"));
  assert.equal(
    catalogLink("https://shop.example/p?aff=keep"),
    "https://shop.example/p?aff=keep",
  );
  for (const url of [
    null,
    "javascript:alert(1)",
    "file:///tmp/photo",
    "https://user:password@example.test",
    "not-a-link",
  ])
    assert.equal(catalogLink(url), null);
});
test("sayı/sıra uydurmadan sayfalar birleştirilir; aynı anda iki sonraki istek gönderilmez", async () => {
  const next = deferred<TrendsPage>();
  const urls: string[] = [];
  const list = new TrendList(async (url) => {
    urls.push(url);
    return urls.length === 1 ? page(["a"], "opaque+/=") : next.promise;
  }, path);
  await list.refresh();
  const loading = list.loadMore();
  await list.loadMore();
  assert.equal(urls.length, 2);
  assert.equal(
    new URL(urls[1], "http://localhost").searchParams.get("cursor"),
    "opaque+/=",
  );
  const second = page(["b"]);
  second.items[0].rank = 2;
  second.items[0].score = 9;
  next.resolve(second);
  await loading;
  assert.deepEqual(
    list.snapshot().page?.items.map((x) => [x.id, x.rank, x.score]),
    [
      ["a", 1, 5],
      ["b", 2, 9],
    ],
  );
  await list.loadMore();
  assert.equal(urls.length, 2);
});
test("boş ve yetersiz örneklem sunucudan olduğu gibi gelir; demo satır eklenmez", async () => {
  for (const status of ["NO_DATA", "INSUFFICIENT_SAMPLE"] as const) {
    const list = new TrendList(async () => page([], null, status), path);
    await list.refresh();
    assert.equal(list.snapshot().page?.status, status);
    assert.deepEqual(list.snapshot().page?.items, []);
  }
});
test("yenileme eski sayfayı anında siler; geç gelen eski yanıt yeni veriye karışmaz", async () => {
  const old = deferred<TrendsPage>(),
    current = deferred<TrendsPage>();
  let calls = 0;
  const list = new TrendList(
    async () => (++calls === 1 ? old.promise : current.promise),
    path,
  );
  const first = list.refresh();
  const second = list.refresh();
  current.resolve(page(["new"]));
  await second;
  old.resolve(page(["stale"]));
  await first;
  assert.equal(list.snapshot().page?.items[0].id, "new");
});
test("ekran/hesap/filtre kapandığında abort ve anında temizlik; geç yanıt yok sayılır", async () => {
  const next = deferred<TrendsPage>();
  let signal: AbortSignal | undefined;
  const list = new TrendList(async (_path, options) => {
    signal = options?.signal as AbortSignal;
    return next.promise;
  }, path);
  const work = list.refresh();
  list.cancel();
  assert.equal(signal?.aborted, true);
  assert.equal(list.snapshot().page, null);
  next.resolve(page(["private-old"]));
  await work;
  assert.equal(list.snapshot().page, null);
  assert.equal(list.snapshot().loading, false);
});
for (const code of ["TREND_RESULTS_CHANGED", "TREND_PAGE_EXPIRED"]) {
  test(`${code}: eski toplamlar temizlenir ve cursorsuz tek yenileme yapılır`, async () => {
    let calls = 0;
    const next = deferred<TrendsPage>();
    const urls: string[] = [];
    const list = new TrendList(async (url) => {
      urls.push(url);
      calls++;
      if (calls === 1) return page(["old"], "next");
      if (calls === 2) throw new ApiError(409, code, "Yenile");
      return next.promise;
    }, path);
    await list.refresh();
    const work = list.loadMore();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(list.snapshot().page, null);
    assert.equal(urls[2], path);
    next.resolve(page(["current"]));
    await work;
    assert.deepEqual(
      list.snapshot().page?.items.map((x) => x.id),
      ["current"],
    );
    assert.equal(list.snapshot().error, null);
  });
}
test("yeniden yükleme başarısızsa eski veriye dönülmez; tekrar butonu yeni ilk sayfa ister", async () => {
  let calls = 0;
  const list = new TrendList(async () => {
    calls++;
    if (calls === 1) return page(["old"], "next");
    if (calls === 2) throw new ApiError(409, "TREND_RESULTS_CHANGED", "Yenile");
    if (calls === 3) throw new ApiError(0, "NETWORK_ERROR", "Ağ yok");
    return page(["new"]);
  }, path);
  await list.refresh();
  await list.loadMore();
  assert.equal(list.snapshot().page, null);
  assert.equal(list.snapshot().error, "Ağ yok");
  await list.refresh();
  assert.equal(list.snapshot().page?.items[0].id, "new");
});
test("409 yenilenirken filtre değişimi/iptal eski kesiti tekrar göstermez", async () => {
  let calls = 0;
  const next = deferred<TrendsPage>();
  const list = new TrendList(async () => {
    if (++calls === 1) return page(["old"], "next");
    if (calls === 2) throw new ApiError(409, "TREND_RESULTS_CHANGED", "Yenile");
    return next.promise;
  }, path);
  await list.refresh();
  const work = list.loadMore();
  await new Promise((resolve) => setImmediate(resolve));
  list.cancel();
  next.resolve(page(["stale"]));
  await work;
  assert.equal(list.snapshot().page, null);
});
