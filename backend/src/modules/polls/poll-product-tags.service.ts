import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { CatalogLinkService } from "../catalog/catalog-link.service.js";
import type { ProductTagInputDto } from "./dto/polls.dto.js";

@Injectable()
export class PollProductTagsService {
  constructor(private readonly catalog: CatalogLinkService) {}

  private duplicate() {
    return new ApiError(
      422,
      "DUPLICATE_PRODUCT_TAG",
      "Aynı ürünü bir seçeneğe yalnız bir kez ekleyebilirsin.",
    );
  }

  async prepare(
    tx: Prisma.TransactionClient,
    inputs: ProductTagInputDto[],
    now: Date,
  ) {
    const result: Prisma.ProductTagCreateWithoutOptionInput[] = [];
    const identities = new Set<string>(),
      links = new Set<string>();
    for (const input of inputs) {
      let data: Prisma.ProductTagCreateWithoutOptionInput;
      if (input.catalogProductId) {
        if (
          [input.title, input.brand, input.priceMinor, input.currency].some(
            (value) => value !== undefined,
          )
        )
          throw new ApiError(
            400,
            "CATALOG_FIELDS_READ_ONLY",
            "Katalog ürününün ad/marka/fiyatını değiştiremezsin; yalnız ürün kimliği ve varsa özgün bağlantıyı gönder.",
          );
        const { catalogProductId, ...snapshot } = await this.catalog.capture(
          tx,
          input.catalogProductId,
          input.externalUrl,
          now,
        );
        if (identities.has(catalogProductId)) throw this.duplicate();
        identities.add(catalogProductId);
        data = {
          ...snapshot,
          catalogProduct: { connect: { id: catalogProductId } },
        };
      } else {
        if (!input.title || !input.externalUrl)
          throw new ApiError(
            400,
            "PRODUCT_FIELDS_REQUIRED",
            "Ürün adı ve bağlantısı gerekli.",
          );
        data = {
          title: input.title,
          brand: input.brand ?? null,
          externalUrl: input.externalUrl,
          priceMinor: input.priceMinor ?? null,
          currency: input.currency ?? "TRY",
          priceRecordedAt: input.priceMinor != null ? now : null,
          source: "USER_ENTERED",
        };
      }
      const link = new URL(data.externalUrl).toString();
      if (links.has(link)) throw this.duplicate();
      links.add(link);
      result.push(data);
    }
    return result;
  }

  async freeze(tx: Prisma.TransactionClient, pollId: string, now: Date) {
    const tags = await tx.productTag.findMany({
      where: { option: { pollId }, catalogProductId: { not: null } },
      orderBy: { id: "asc" },
    });
    const identities = new Set<string>();
    const snapshots = [];
    for (const tag of tags) {
      const captured = await this.catalog.capture(
        tx,
        tag.catalogProductId!,
        tag.externalUrl,
        now,
      );
      const key = `${tag.optionId}:${captured.catalogProductId}`;
      if (identities.has(key)) throw this.duplicate();
      identities.add(key);
      snapshots.push({ id: tag.id, captured });
    }
    for (const { id, captured } of snapshots)
      await tx.productTag.update({ where: { id }, data: captured });
  }
}
