import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import type { OutboxEvent } from "../../generated/prisma/client.js";
import type { OutboxHandler } from "./outbox.types.js";

// Bu sayıdan sonra olay kuyrukta bekler ama otomatik denenmez; elle incelenir.
export const OUTBOX_MAX_ATTEMPTS = 12;
const LEASE_SECONDS = 60;
const retryDelaySeconds = (attempts: number) => Math.min(3600, 5 * 2 ** Math.min(attempts, 10));

@Injectable()
export class OutboxRegistry {
  private readonly handlers: OutboxHandler[] = [];

  register(handler: OutboxHandler) {
    if (!handler.project && !handler.deliver) throw new Error(`${handler.name}: project veya deliver gerekli.`);
    if (!this.handlers.includes(handler)) this.handlers.push(handler);
  }

  for(type: string) { return this.handlers.filter((handler) => handler.types.includes(type)); }
}

// Transaction'larla aynı anda yazılmış olayları sırayla tüketir. Tüketicisi
// olmayan tür de yayınlandı işaretlenir; kuyruk yalnız bekleyen işi tutar.
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(private readonly prisma: PrismaService, private readonly registry: OutboxRegistry) {}

  // Kısa transaction: uygun olaylar başka işçiyle çakışmadan kiralanır.
  private async claim(limit: number) {
    const rows = await this.prisma.$queryRaw<OutboxEvent[]>`
      UPDATE "OutboxEvent" SET "leaseUntil" = clock_timestamp() + (${LEASE_SECONDS} * interval '1 second'), "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "OutboxEvent"
        WHERE "publishedAt" IS NULL AND "availableAt" <= clock_timestamp() AND "attempts" < ${OUTBOX_MAX_ATTEMPTS}
          AND ("leaseUntil" IS NULL OR "leaseUntil" < clock_timestamp())
        ORDER BY "createdAt", "aggregateVersion", "id" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
      RETURNING *`;
    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.aggregateVersion - b.aggregateVersion || a.id.localeCompare(b.id));
  }

  private async process(event: OutboxEvent) {
    const handlers = this.registry.for(event.type);
    try {
      for (const handler of handlers) if (handler.deliver) await handler.deliver(event);
      await this.prisma.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw<{ publishedAt: Date | null }[]>`SELECT "publishedAt" FROM "OutboxEvent" WHERE "id" = ${event.id}::uuid FOR UPDATE`;
        if (!row || row.publishedAt) return;
        for (const handler of handlers) if (handler.project) await handler.project(tx, event);
        await tx.$executeRaw`UPDATE "OutboxEvent" SET "publishedAt" = clock_timestamp(), "leaseUntil" = NULL WHERE "id" = ${event.id}::uuid`;
      }, { maxWait: 10_000, timeout: 30_000 });
      return true;
    } catch {
      const delay = retryDelaySeconds(event.attempts);
      await this.prisma.$executeRaw`UPDATE "OutboxEvent" SET "leaseUntil" = NULL, "availableAt" = clock_timestamp() + (${delay} * interval '1 second')
        WHERE "id" = ${event.id}::uuid AND "publishedAt" IS NULL`.catch(() => {});
      // Payload ve hata metni günlüğe yazılmaz; olay kimliği yeterlidir.
      this.logger.error(`Olay işlenemedi: ${event.type} ${event.id}, deneme ${event.attempts}; ${delay} sn sonra yeniden denenecek.`);
      return false;
    }
  }

  // Kuyruk boşalana veya tur sınırına gelene kadar işler; işlenen olay sayısını döndürür.
  async drain(batchSize = 50, maxBatches = 20) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("Olay tarama sınırı 1–500 olmalı.");
    let processed = 0;
    for (let batch = 0; batch < maxBatches; batch++) {
      const events = await this.claim(batchSize);
      if (!events.length) break;
      for (const event of events) if (await this.process(event)) processed++;
    }
    return processed;
  }
}
