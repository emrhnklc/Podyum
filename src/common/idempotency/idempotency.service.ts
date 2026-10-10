import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ApiError } from "../errors/api-error.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, field]) => [key, canonical(field)]));
  }
  return value;
}

export function requireIdempotencyKey(value: unknown): string {
  if (value === undefined) throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key başlığı gerekli.");
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,99}$/.test(value)) {
    throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "İşlem anahtarı 8–100 karakter olmalı; harf, rakam, _, ., : veya - kullan.");
  }
  return value;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(userId: string, scope: string, rawKey: unknown, payload: unknown, responseCode: number,
    work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const key = requireIdempotencyKey(rawKey);
    const requestHash = createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      // Olmayan idempotency satırı da kilitlenir. Kullanıcı satırını kilitlemek,
      // avatarın media → user kilit sırasıyla ters düşer; ayrı advisory anahtar kullanılır.
      const lock = JSON.stringify(["idempotency-v1", userId, scope, key]);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text`;
      const unique = { userId_scope_key: { userId, scope, key } };
      const existing = await tx.idempotencyRecord.findUnique({ where: unique });
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      if (existing && existing.expiresAt > now) {
        if (existing.requestHash !== requestHash) throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Bu işlem anahtarı farklı bir istek için kullanılmış.");
        return existing.responseBody as T;
      }
      if (existing) await tx.idempotencyRecord.delete({ where: unique });
      const result = await work(tx);
      const snapshot = JSON.parse(JSON.stringify(result));
      const [{ savedAt }] = await tx.$queryRaw<{ savedAt: Date }[]>`SELECT clock_timestamp() AS "savedAt"`;
      await tx.idempotencyRecord.create({ data: {
        userId, scope, key, requestHash, responseCode, responseBody: snapshot as Prisma.InputJsonValue,
        expiresAt: new Date(savedAt.getTime() + 86_400_000),
      } });
      return snapshot as T;
    }, { maxWait: 5_000, timeout: 15_000 });
  }
}
