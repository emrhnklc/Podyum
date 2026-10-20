import assert from "node:assert/strict";
import { test } from "node:test";
import {
  manualProduct,
  productTagInputs,
  type ProductTagDraft,
} from "../src/features/polls/product-tags";
const catalog: ProductTagDraft = {
  kind: "catalog",
  product: {
    id: "product-id",
    title: "Katalog adı",
    brand: "Marka",
    category: "OUTFIT",
    canonicalUrl: "https://example.com/p/1",
    version: 1,
    priceMinor: 200,
    currency: "TRY",
    priceRecordedAt: null,
    store: null,
  },
  externalUrl: "https://example.com/p/1?utm_source=keep",
};
test("katalog seçimi yalnız kimlik ve özgün link gönderir; katalog alanları taşınmaz", () => {
  assert.deepEqual(productTagInputs([catalog]), [
    { catalogProductId: "product-id", externalUrl: catalog.externalUrl },
  ]);
});
test("elle ürün fiyatı kuruşa çevrilir, boş fiyat null ve özgün link korunur", () => {
  const fields = {
    title: " Gömlek ",
    brand: " Marka ",
    url: "https://example.com/p?aff=x",
    price: "1299,95",
    currency: "TRY",
  };
  assert.equal(manualProduct(fields).priceMinor, 129995);
  assert.equal(manualProduct(fields).externalUrl, fields.url);
  assert.equal(manualProduct({ ...fields, price: "" }).priceMinor, null);
  for (const price of ["-1", "1.999", "1e3", "99999999"])
    assert.throws(() => manualProduct({ ...fields, price }));
  assert.throws(() => manualProduct({ ...fields, url: "javascript:alert(1)" }));
  assert.throws(() => manualProduct({ ...fields, title: "\u0000" }));
});
test("seçenek başına katalog tekrarı ve 10 ürün sınırı uygulanır", () => {
  assert.throws(() => productTagInputs([catalog, catalog]));
  assert.throws(() =>
    productTagInputs(Array.from({ length: 11 }, () => catalog)),
  );
  const manual = manualProduct({
    title: "Gömlek",
    brand: "",
    price: "",
    currency: "TRY",
    url: "https://example.com/p",
  });
  assert.throws(() =>
    productTagInputs([
      { kind: "manual", ...manual },
      { kind: "manual", ...manual },
    ]),
  );
});
