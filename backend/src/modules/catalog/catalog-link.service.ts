import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { normalizeCatalogUrl } from "./catalog-normalization.js";
import { lockCatalog } from "./catalog-lock.js";

@Injectable()
export class CatalogLinkService {
  async capture(
    tx: Prisma.TransactionClient,
    id: string,
    externalUrl: string | undefined,
    now: Date,
  ) {
    await lockCatalog(tx);
    const visited = new Set<string>();
    for (let depth = 0; depth < 50; depth++) {
      if (visited.has(id))
        throw new ApiError(
          409,
          "CATALOG_MERGE_CYCLE",
          "Ürün birleştirmesi incelenmeli.",
        );
      visited.add(id);
      const product = await tx.catalogProduct.findUnique({
        where: { id },
        include: { store: true },
      });
      if (!product)
        throw new ApiError(
          422,
          "CATALOG_PRODUCT_UNAVAILABLE",
          "Seçilen ürün bulunamadı; ürünü yeniden seç.",
        );
      if (product.status === "MERGED" && product.mergedIntoId) {
        id = product.mergedIntoId;
        continue;
      }
      if (
        product.status !== "ACTIVE" ||
        (product.store && !product.store.active)
      )
        throw new ApiError(
          422,
          "CATALOG_PRODUCT_UNAVAILABLE",
          "Seçilen ürün şu anda kullanılamıyor; ürünü değiştir veya kaldır.",
        );
      const link = externalUrl ?? product.canonicalUrl;
      if (!link)
        throw new ApiError(
          422,
          "PRODUCT_URL_REQUIRED",
          "Bu ürünün doğrulanmış bağlantısı bulunmuyor.",
        );
      const normalized = normalizeCatalogUrl(
        link,
        product.store?.trackingParameters ?? [],
      );
      const alias = await tx.catalogProductUrl.findUnique({
        where: { normalizedUrl: normalized.normalizedUrl },
      });
      if (!alias || alias.productId !== product.id)
        throw new ApiError(
          422,
          "PRODUCT_URL_MISMATCH",
          "Bağlantı seçtiğin katalog ürününe ait olmalı.",
        );
      return {
        catalogProductId: product.id,
        title: product.title,
        brand: product.brand,
        priceMinor: product.priceMinor,
        currency: product.currency,
        priceRecordedAt: product.priceRecordedAt,
        externalUrl: normalized.originalUrl,
        source: "CATALOG",
        catalogSnapshot: {
          schemaVersion: 1,
          id: product.id,
          version: product.version,
          capturedAt: now.toISOString(),
          title: product.title,
          brand: product.brand,
          category: product.category,
          store: product.store
            ? {
                id: product.store.id,
                name: product.store.name,
                domain: product.store.domain,
              }
            : null,
          externalId: product.externalId,
          variantKey: product.variantKey,
          canonicalUrl: product.canonicalUrl,
          source: product.source,
          priceMinor: product.priceMinor,
          currency: product.currency,
          priceRecordedAt: product.priceRecordedAt?.toISOString() ?? null,
        } satisfies Prisma.InputJsonObject,
      };
    }
    throw new ApiError(
      409,
      "CATALOG_MERGE_DEPTH",
      "Ürün birleştirme zinciri incelenmeli.",
    );
  }
}
