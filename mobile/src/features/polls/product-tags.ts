import type { CatalogProduct } from "../catalog/api/catalog";

export type ManualProductInput = {
  title: string;
  brand?: string | null;
  priceMinor?: number | null;
  currency: string;
  externalUrl: string;
};
export type ProductTagDraft =
  | { kind: "catalog"; product: CatalogProduct; externalUrl?: string }
  | ({ kind: "manual" } & ManualProductInput);

export function productTitle(tag: ProductTagDraft) {
  return tag.kind === "catalog" ? tag.product.title : tag.title;
}

export function manualProduct(fields: {
  title: string;
  brand: string;
  url: string;
  price: string;
  currency: string;
}): ManualProductInput {
  const title = fields.title.trim(),
    brand = fields.brand.trim(),
    externalUrl = fields.url.trim();
  if (
    !title ||
    title.length > 150 ||
    /\u0000/.test(title) ||
    brand.length > 100 ||
    /\u0000/.test(brand)
  )
    throw new Error("Ürün adı 1–150, marka en fazla 100 karakter olmalı.");
  let url: URL;
  try {
    url = new URL(externalUrl);
  } catch {
    throw new Error("Geçerli bir ürün bağlantısı gir.");
  }
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    /\s|[\u0000-\u001f\u007f]/.test(externalUrl) ||
    externalUrl.length > 2048
  )
    throw new Error(
      "Ürün bağlantısı http/https olmalı ve boşluk veya giriş bilgisi içermemeli.",
    );
  if (!["TRY", "EUR", "USD", "GBP"].includes(fields.currency))
    throw new Error("Para birimini seç.");
  const price = fields.price.trim().replace(",", ".");
  if (price && !/^\d{1,8}(?:\.\d{1,2})?$/.test(price))
    throw new Error("Fiyatı en fazla iki ondalık basamakla gir.");
  const priceMinor = price ? Math.round(Number(price) * 100) : null;
  if (priceMinor !== null && priceMinor > 2147483647)
    throw new Error("Fiyat çok yüksek.");
  return {
    title,
    brand: brand || null,
    externalUrl,
    priceMinor,
    currency: fields.currency,
  };
}

export function productTagInputs(tags: ProductTagDraft[]) {
  if (tags.length > 10)
    throw new Error("Bir kombine en fazla 10 ürün ekleyebilirsin.");
  const seen = new Set<string>();
  return tags.map((tag) => {
    const identity =
      tag.kind === "catalog"
        ? `catalog:${tag.product.id}`
        : `url:${new URL(tag.externalUrl).toString()}`;
    if (seen.has(identity)) throw new Error("Bu ürün kombine zaten eklenmiş.");
    seen.add(identity);
    // Katalog alanlarını istemciden sunucuya kopyalamayız.
    return tag.kind === "catalog"
      ? {
          catalogProductId: tag.product.id,
          ...(tag.externalUrl ? { externalUrl: tag.externalUrl } : {}),
        }
      : {
          title: tag.title,
          brand: tag.brand ?? null,
          priceMinor: tag.priceMinor ?? null,
          currency: tag.currency,
          externalUrl: tag.externalUrl,
        };
  });
}
