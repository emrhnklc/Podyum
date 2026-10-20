import { Injectable } from "@nestjs/common";
import { lockCatalog } from "./catalog-lock.js";
import { createHash } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { PrismaService } from "../../database/prisma.service.js";
import { AdminAccessService } from "../auth/admin-access.service.js";
import type {
  Prisma,
  CatalogProduct,
  CatalogStore,
} from "../../generated/prisma/client.js";
import {
  catalogDomain,
  normalizeCatalogUrl,
  normalizedName,
} from "./catalog-normalization.js";
import type {
  AdminCatalogQueryDto,
  CatalogAliasDto,
  CatalogMergeDto,
  CatalogProductCreateDto,
  CatalogProductUpdateDto,
  CatalogQueryDto,
  CatalogResolveDto,
  CatalogStoreCreateDto,
  CatalogStoreUpdateDto,
  CatalogSuggestionCreateDto,
  CatalogSuggestionDecisionDto,
  SuggestionQueryDto,
} from "./dto/catalog.dto.js";

type Tx = Prisma.TransactionClient;
type ProductRow = CatalogProduct & { store: CatalogStore | null };
const missing = () =>
  new ApiError(404, "RESOURCE_NOT_FOUND", "Katalog kaydı bulunamadı.");
const version = (actual: number, expected: number) => {
  if (actual !== expected)
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      "Katalog kaydı değişmiş; güncel sürümü al.",
    );
};
const uniqueError = (error: unknown): never => {
  if ((error as { code?: string })?.code === "P2002")
    throw new ApiError(
      409,
      "CATALOG_DUPLICATE",
      "Bu ürün kimliği, bağlantı veya mağaza zaten kayıtlı.",
    );
  throw error;
};
const activeWhere: Prisma.CatalogProductWhereInput = {
  status: "ACTIVE",
  OR: [{ storeId: null }, { store: { active: true } }],
};
const present = (row: ProductRow) => ({
  id: row.id,
  title: row.title,
  brand: row.brand,
  category: row.category,
  store: row.store
    ? { id: row.store.id, name: row.store.name, domain: row.store.domain }
    : null,
  externalId: row.externalId,
  variantKey: row.variantKey,
  canonicalUrl: row.canonicalUrl,
  source: row.source,
  status: row.status,
  priceMinor: row.priceMinor,
  currency: row.currency,
  priceRecordedAt: row.priceRecordedAt,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly admin: AdminAccessService,
    private readonly idem: IdempotencyService,
  ) {}
  stores(includeInactive = false) {
    return this.db.catalogStore
      .findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: { domain: "asc" },
        take: 200,
        select: {
          id: true,
          name: true,
          domain: true,
          active: true,
          version: true,
          trackingParameters: true,
        },
      })
      .then((items) => ({ items }));
  }

  async products(
    actor: string,
    query: CatalogQueryDto | AdminCatalogQueryDto,
    admin = false,
  ) {
    const q = query.q ? normalizedName(query.q) : null;
    const status = admin
      ? ((query as AdminCatalogQueryDto).status ?? null)
      : "ACTIVE";
    const context = {
      resource: admin ? "catalog-admin-products" : "catalog-products",
      actor,
      q,
      status,
      category: query.category ?? null,
    };
    const cursor = query.cursor ? decodeCursor(query.cursor, context) : null;
    const rows = await this.db.catalogProduct.findMany({
      where: {
        AND: [
          admin ? { ...(status ? { status } : {}) } : activeWhere,
          ...(q
            ? [
                {
                  OR: [
                    { normalizedTitle: { contains: q } },
                    {
                      brand: {
                        contains: query.q,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(query.category ? [{ category: query.category }] : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: new Date(cursor.createdAt) } },
                    {
                      createdAt: new Date(cursor.createdAt),
                      id: { lt: cursor.id },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: { store: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit),
      last = items.at(-1);
    return {
      items: items.map(present),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor(
              { id: last.id, createdAt: last.createdAt.toISOString() },
              context,
            )
          : null,
    };
  }
  private async terminal(tx: Tx, id: string): Promise<ProductRow> {
    const seen = new Set<string>();
    for (let depth = 0; depth < 50; depth++) {
      if (seen.has(id))
        throw new ApiError(
          409,
          "CATALOG_MERGE_CYCLE",
          "Katalog birleştirme kaydı incelenmeli.",
        );
      seen.add(id);
      const row = await tx.catalogProduct.findUnique({
        where: { id },
        include: { store: true },
      });
      if (!row) throw missing();
      if (row.status !== "MERGED" || !row.mergedIntoId) return row;
      id = row.mergedIntoId;
    }
    throw new ApiError(
      409,
      "CATALOG_MERGE_DEPTH",
      "Katalog birleştirme zinciri incelenmeli.",
    );
  }
  async product(id: string, admin = false) {
    return this.db.$transaction(async (tx) => {
      const row = admin
        ? await tx.catalogProduct.findUnique({
            where: { id },
            include: { store: true },
          })
        : await this.terminal(tx, id);
      if (
        !row ||
        (!admin &&
          (row.status !== "ACTIVE" || (row.store && !row.store.active)))
      )
        throw missing();
      return { ...present(row), redirectedFromId: row.id !== id ? id : null };
    });
  }
  private async url(tx: Tx, url: string) {
    const base = normalizeCatalogUrl(url);
    const store = await tx.catalogStore.findUnique({
      where: { domain: base.domain },
    });
    return {
      ...normalizeCatalogUrl(url, store?.trackingParameters ?? []),
      store,
    };
  }
  async resolve(dto: CatalogResolveDto) {
    if (!dto.url && !dto.query)
      throw new ApiError(
        400,
        "CATALOG_INPUT_REQUIRED",
        "Bir ürün linki veya isim gir.",
      );
    return this.db.$transaction(async (tx) => {
      const url = dto.url ? await this.url(tx, dto.url) : null;
      const alias = url
        ? await tx.catalogProductUrl.findUnique({
            where: { normalizedUrl: url.normalizedUrl },
          })
        : null;
      const product = alias ? await this.terminal(tx, alias.productId) : null;
      const candidates = dto.query
        ? await tx.catalogProduct.findMany({
            where: {
              AND: [
                activeWhere,
                { normalizedTitle: { contains: normalizedName(dto.query) } },
                ...(dto.brand
                  ? [
                      {
                        brand: {
                          equals: dto.brand,
                          mode: "insensitive" as const,
                        },
                      },
                    ]
                  : []),
              ],
            },
            include: { store: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 10,
          })
        : [];
      const exact =
        product?.status === "ACTIVE" && (!product.store || product.store.active)
          ? product
          : null;
      return {
        match: exact ? "EXACT" : candidates.length ? "CANDIDATES" : "UNMATCHED",
        matchedBy: exact ? "CANONICAL_URL" : null,
        product: exact ? present(exact) : null,
        candidates: exact ? [] : candidates.map(present),
        originalUrl: url?.originalUrl ?? null,
        normalizedUrl: url?.normalizedUrl ?? null,
        storeSupported: !!url?.store?.active,
        canSuggest: true,
      };
    });
  }
  createSuggestion(
    actor: string,
    dto: CatalogSuggestionCreateDto,
    key: unknown,
  ) {
    return this.idem.execute(
      actor,
      "catalog.suggest",
      key,
      dto,
      201,
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor}::uuid FOR UPDATE`;
        if (!(await tx.user.count({ where: { id: actor, status: "ACTIVE" } })))
          throw new ApiError(401, "INVALID_SESSION", "Aktif oturum gerekli.");
        const link = dto.url ? await this.url(tx, dto.url) : null;
        const data = {
          title: dto.title,
          brand: dto.brand ?? null,
          category: dto.category,
          originalUrl: link?.originalUrl ?? null,
          normalizedUrl: link?.normalizedUrl ?? null,
          priceMinor: dto.priceMinor ?? null,
          currency: dto.currency,
        };
        const fingerprint = createHash("sha256")
          .update(JSON.stringify(data))
          .digest("hex");
        const previous = await tx.catalogSuggestion.findUnique({
          where: {
            submittedById_fingerprint: { submittedById: actor, fingerprint },
          },
        });
        if (previous) return this.suggestionView(previous, false);
        const [{ now }] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS "now"`;
        if (
          (await tx.catalogSuggestion.count({
            where: {
              submittedById: actor,
              createdAt: { gte: new Date(now.getTime() - 86_400_000) },
            },
          })) >= 20
        )
          throw new ApiError(
            429,
            "CATALOG_SUGGESTION_LIMIT",
            "Son 24 saatteki ürün önerisi sınırına ulaştın.",
          );
        const row = await tx.catalogSuggestion.create({
          data: {
            ...data,
            submittedById: actor,
            fingerprint,
            priceRecordedAt: dto.priceMinor == null ? null : now,
          },
        });
        return this.suggestionView(row, false);
      },
    );
  }
  private suggestionView(
    row: {
      id: string;
      submittedById: string;
      title: string;
      brand: string | null;
      category: string;
      originalUrl: string | null;
      normalizedUrl: string | null;
      priceMinor: number | null;
      currency: string;
      priceRecordedAt: Date | null;
      status: string;
      resolvedProductId: string | null;
      decisionReason: string | null;
      version: number;
      createdAt: Date;
    },
    admin: boolean,
  ) {
    const { submittedById, ...safe } = row;
    // Parmak izi veya gönderen kimliği normal kullanıcı yanıtına girmez.
    return {
      id: safe.id,
      title: safe.title,
      brand: safe.brand,
      category: safe.category,
      originalUrl: safe.originalUrl,
      normalizedUrl: safe.normalizedUrl,
      priceMinor: safe.priceMinor,
      currency: safe.currency,
      priceRecordedAt: safe.priceRecordedAt,
      status: safe.status,
      resolvedProductId: safe.resolvedProductId,
      decisionReason: safe.decisionReason,
      version: safe.version,
      createdAt: safe.createdAt,
      ...(admin ? { submittedById } : {}),
    };
  }
  async suggestions(actor: string, query: SuggestionQueryDto, admin = false) {
    const context = {
      resource: admin ? "catalog-admin-suggestions" : "catalog-my-suggestions",
      actor,
      status: query.status ?? null,
    };
    const cursor = query.cursor ? decodeCursor(query.cursor, context) : null;
    const rows = await this.db.catalogSuggestion.findMany({
      where: {
        ...(admin ? {} : { submittedById: actor }),
        ...(query.status ? { status: query.status } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit),
      last = items.at(-1);
    return {
      items: items.map((row) => this.suggestionView(row, admin)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor(
              { id: last.id, createdAt: last.createdAt.toISOString() },
              context,
            )
          : null,
    };
  }
  async suggestion(actor: string, id: string) {
    const row = await this.db.catalogSuggestion.findFirst({
      where: { id, submittedById: actor },
    });
    if (!row) throw missing();
    return this.suggestionView(row, false);
  }
  createStore(actor: string, dto: CatalogStoreCreateDto, key: unknown) {
    return this.idem
      .execute(actor, "catalog.store.create", key, dto, 201, async (tx) => {
        await lockCatalog(tx);
        await this.admin.lockActors(tx, actor);
        const row = await tx.catalogStore.create({
          data: {
            name: dto.name,
            domain: catalogDomain(dto.domain),
            trackingParameters: dto.trackingParameters,
          },
        });
        await this.audit(
          tx,
          actor,
          "CATALOG_STORE_CREATED",
          "CATALOG_STORE",
          row.id,
          dto.reason,
          {},
          { version: 0, active: true },
        );
        return row;
      })
      .catch(uniqueError);
  }
  updateStore(
    actor: string,
    id: string,
    dto: CatalogStoreUpdateDto,
    key: unknown,
  ) {
    return this.idem.execute(
      actor,
      `catalog.store.update:${id}`,
      key,
      dto,
      200,
      async (tx) => {
        await lockCatalog(tx);
        await tx.$queryRaw`SELECT "id" FROM "CatalogStore" WHERE "id" = ${id}::uuid FOR UPDATE`;
        await this.admin.lockActors(tx, actor);
        const row = await tx.catalogStore.findUnique({ where: { id } });
        if (!row) throw missing();
        version(row.version, dto.expectedVersion);
        const saved = await tx.catalogStore.update({
          where: { id },
          data: {
            name: dto.name,
            active: dto.active,
            version: { increment: 1 },
          },
        });
        await this.audit(
          tx,
          actor,
          "CATALOG_STORE_UPDATED",
          "CATALOG_STORE",
          id,
          dto.reason,
          { version: row.version, active: row.active },
          { version: saved.version, active: saved.active },
        );
        return saved;
      },
    );
  }
  createProduct(actor: string, dto: CatalogProductCreateDto, key: unknown) {
    return this.idem
      .execute(actor, "catalog.product.create", key, dto, 201, async (tx) => {
        await lockCatalog(tx);
        await this.admin.lockActors(tx, actor);
        const link = dto.url ? await this.url(tx, dto.url) : null;
        const storeId = dto.storeId ?? link?.store?.id ?? null;
        const store = storeId
          ? await tx.catalogStore.findUnique({ where: { id: storeId } })
          : null;
        if (
          (storeId && !store?.active) ||
          (link && (!store || link.domain !== store.domain)) ||
          (dto.externalId && !store)
        )
          throw new ApiError(
            422,
            "CATALOG_STORE_REQUIRED",
            "Link veya harici ürün kimliği için doğru ve etkin mağazayı seç.",
          );
        const [{ now }] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS "now"`;
        const row = await tx.catalogProduct.create({
          data: {
            storeId,
            externalId: dto.externalId ?? null,
            variantKey: dto.variantKey,
            title: dto.title,
            normalizedTitle: normalizedName(dto.title),
            brand: dto.brand ?? null,
            category: dto.category,
            canonicalUrl: link?.normalizedUrl ?? null,
            priceMinor: dto.priceMinor ?? null,
            currency: dto.currency,
            priceRecordedAt: dto.priceMinor == null ? null : now,
            ...(link
              ? { urls: { create: { normalizedUrl: link.normalizedUrl } } }
              : {}),
          },
          include: { store: true },
        });
        await this.audit(
          tx,
          actor,
          "CATALOG_PRODUCT_CREATED",
          "CATALOG_PRODUCT",
          row.id,
          dto.reason,
          {},
          { version: 0, status: row.status },
        );
        return present(row);
      })
      .catch(uniqueError);
  }
  updateProduct(
    actor: string,
    id: string,
    dto: CatalogProductUpdateDto,
    key: unknown,
  ) {
    return this.idem.execute(
      actor,
      `catalog.product.update:${id}`,
      key,
      dto,
      200,
      async (tx) => {
        await lockCatalog(tx);
        await tx.$queryRaw`SELECT "id" FROM "CatalogProduct" WHERE "id" = ${id}::uuid FOR UPDATE`;
        await this.admin.lockActors(tx, actor);
        const row = await tx.catalogProduct.findUnique({ where: { id } });
        if (!row) throw missing();
        version(row.version, dto.expectedVersion);
        if (row.status === "MERGED")
          throw new ApiError(
            409,
            "CATALOG_PRODUCT_MERGED",
            "Birleştirilmiş ürün değiştirilemez; hedef ürünü düzenle.",
          );
        const [{ now }] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS "now"`;
        const saved = await tx.catalogProduct.update({
          where: { id },
          data: {
            title: dto.title,
            normalizedTitle: normalizedName(dto.title),
            brand: dto.brand,
            category: dto.category,
            priceMinor: dto.priceMinor,
            currency: dto.currency,
            priceRecordedAt: dto.priceMinor === null ? null : now,
            status: dto.status,
            version: { increment: 1 },
          },
          include: { store: true },
        });
        await this.audit(
          tx,
          actor,
          "CATALOG_PRODUCT_UPDATED",
          "CATALOG_PRODUCT",
          id,
          dto.reason,
          { version: row.version, status: row.status },
          { version: saved.version, status: saved.status },
        );
        return present(saved);
      },
    );
  }
  addAlias(actor: string, id: string, dto: CatalogAliasDto, key: unknown) {
    return this.idem
      .execute(
        actor,
        `catalog.product.alias:${id}`,
        key,
        dto,
        200,
        async (tx) => {
          await lockCatalog(tx);
          await tx.$queryRaw`SELECT "id" FROM "CatalogProduct" WHERE "id" = ${id}::uuid FOR UPDATE`;
          await this.admin.lockActors(tx, actor);
          const row = await tx.catalogProduct.findUnique({
            where: { id },
            include: { store: true },
          });
          if (!row) throw missing();
          version(row.version, dto.expectedVersion);
          if (row.status !== "ACTIVE")
            throw new ApiError(
              409,
              "CATALOG_PRODUCT_INACTIVE",
              "Etkin bir ürüne link ekle.",
            );
          const link = await this.url(tx, dto.url);
          if (!row.store?.active || row.store.domain !== link.domain)
            throw new ApiError(
              422,
              "CATALOG_STORE_REQUIRED",
              "Aynı etkin mağazanın bağlantısını kullan.",
            );
          const previous = await tx.catalogProductUrl.findUnique({
            where: { normalizedUrl: link.normalizedUrl },
          });
          if (previous && previous.productId !== id)
            throw new ApiError(
              409,
              "CATALOG_DUPLICATE",
              "Bu link başka bir ürüne ait.",
            );
          if (previous) return present(row);
          await tx.catalogProductUrl.create({
            data: { productId: id, normalizedUrl: link.normalizedUrl },
          });
          const saved = await tx.catalogProduct.update({
            where: { id },
            data: { version: { increment: 1 } },
            include: { store: true },
          });
          await this.audit(
            tx,
            actor,
            "CATALOG_PRODUCT_UPDATED",
            "CATALOG_PRODUCT",
            id,
            dto.reason,
            { version: row.version },
            { version: saved.version },
          );
          return present(saved);
        },
      )
      .catch(uniqueError);
  }
  merge(actor: string, id: string, dto: CatalogMergeDto, key: unknown) {
    if (id === dto.targetId)
      throw new ApiError(
        422,
        "CATALOG_SELF_MERGE",
        "Ürün kendisiyle birleştirilemez.",
      );
    return this.idem.execute(
      actor,
      `catalog.product.merge:${id}`,
      key,
      dto,
      200,
      async (tx) => {
        await lockCatalog(tx);
        for (const target of [id, dto.targetId].sort())
          await tx.$queryRaw`SELECT "id" FROM "CatalogProduct" WHERE "id" = ${target}::uuid FOR UPDATE`;
        await this.admin.lockActors(tx, actor);
        const source = await tx.catalogProduct.findUnique({ where: { id } });
        const target = await tx.catalogProduct.findUnique({
          where: { id: dto.targetId },
          include: { store: true },
        });
        if (!source || !target) throw missing();
        version(source.version, dto.expectedVersion);
        version(target.version, dto.targetVersion);
        if (
          source.status === "MERGED" ||
          target.status !== "ACTIVE" ||
          (target.store && !target.store.active)
        )
          throw new ApiError(
            409,
            "CATALOG_INVALID_MERGE",
            "Etkin hedef seç; daha önce birleştirilmiş kaynak tekrar değişmez.",
          );
        if (
          source.storeId !== target.storeId ||
          source.variantKey !== target.variantKey
        )
          throw new ApiError(
            422,
            "CATALOG_VARIANT_MISMATCH",
            "Farklı mağaza veya varyantları otomatik birleştirme.",
          );
        await tx.catalogProductUrl.updateMany({
          where: { productId: id },
          data: { productId: target.id },
        });
        await tx.catalogProduct.update({
          where: { id },
          data: {
            status: "MERGED",
            mergedIntoId: target.id,
            version: { increment: 1 },
          },
        });
        const saved = await tx.catalogProduct.update({
          where: { id: target.id },
          data: { version: { increment: 1 } },
          include: { store: true },
        });
        await this.audit(
          tx,
          actor,
          "CATALOG_PRODUCT_MERGED",
          "CATALOG_PRODUCT",
          id,
          dto.reason,
          { version: source.version, status: source.status },
          {
            version: source.version + 1,
            status: "MERGED",
            targetId: target.id,
          },
        );
        return { sourceId: id, product: present(saved) };
      },
    );
  }
  decide(
    actor: string,
    id: string,
    dto: CatalogSuggestionDecisionDto,
    key: unknown,
  ) {
    return this.idem.execute(
      actor,
      `catalog.suggestion.decide:${id}`,
      key,
      dto,
      200,
      async (tx) => {
        await lockCatalog(tx);
        await tx.$queryRaw`SELECT "id" FROM "CatalogSuggestion" WHERE "id" = ${id}::uuid FOR UPDATE`;
        await this.admin.lockActors(tx, actor);
        const row = await tx.catalogSuggestion.findUnique({ where: { id } });
        if (!row) throw missing();
        version(row.version, dto.expectedVersion);
        if (row.status !== "PENDING")
          throw new ApiError(
            409,
            "CATALOG_ALREADY_REVIEWED",
            "Öneri zaten incelenmiş.",
          );
        let productId: string | null = null;
        if (dto.decision === "APPROVE") {
          if (!dto.productId)
            throw new ApiError(
              422,
              "CATALOG_PRODUCT_REQUIRED",
              "Onay için incelenmiş ortak ürün seç.",
            );
          const product = await this.terminal(tx, dto.productId);
          if (
            product.status !== "ACTIVE" ||
            (product.store && !product.store.active)
          )
            throw missing();
          productId = product.id;
        } else if (dto.productId)
          throw new ApiError(
            422,
            "CATALOG_REJECT_TARGET",
            "Reddedilen öneri ürüne bağlanamaz.",
          );
        const saved = await tx.catalogSuggestion.update({
          where: { id },
          data: {
            status: dto.decision === "APPROVE" ? "APPROVED" : "REJECTED",
            resolvedProductId: productId,
            decisionReason: dto.reason,
            version: { increment: 1 },
          },
        });
        await this.audit(
          tx,
          actor,
          "CATALOG_SUGGESTION_REVIEWED",
          "CATALOG_SUGGESTION",
          id,
          dto.reason,
          { version: row.version, status: row.status },
          { version: saved.version, status: saved.status },
        );
        return this.suggestionView(saved, true);
      },
    );
  }
  private async audit(
    tx: Tx,
    actorId: string,
    action:
      | "CATALOG_STORE_CREATED"
      | "CATALOG_STORE_UPDATED"
      | "CATALOG_PRODUCT_CREATED"
      | "CATALOG_PRODUCT_UPDATED"
      | "CATALOG_PRODUCT_MERGED"
      | "CATALOG_SUGGESTION_REVIEWED",
    resourceType: "CATALOG_STORE" | "CATALOG_PRODUCT" | "CATALOG_SUGGESTION",
    resourceId: string,
    reason: string,
    before: Prisma.InputJsonObject,
    after: Prisma.InputJsonObject,
  ) {
    await tx.moderationAudit.create({
      data: {
        actorId,
        action,
        resourceType,
        resourceId,
        reason,
        before,
        after,
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "catalog",
        aggregateId: resourceId,
        aggregateVersion: Number(after.version),
        type: `catalog.${action.toLowerCase()}`,
        payload: { schemaVersion: 1, resourceId, action, ...after },
      },
    });
  }
}
