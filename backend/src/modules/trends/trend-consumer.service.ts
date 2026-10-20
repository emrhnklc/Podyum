import { Injectable, type OnModuleInit } from "@nestjs/common";
import { OutboxRegistry } from "../../common/outbox/outbox-dispatcher.js";
import type {
  OutboxHandler,
  OutboxTx,
} from "../../common/outbox/outbox.types.js";
import type { OutboxEvent } from "../../generated/prisma/client.js";
import { TrendProjectionService } from "./trend-projection.service.js";
import { trendUuid } from "./trend-rebuild-cursor.js";
@Injectable()
export class TrendConsumer implements OnModuleInit, OutboxHandler {
  readonly name = "trend-contributions";
  readonly types = ["poll.vote.cast"];
  constructor(
    private readonly registry: OutboxRegistry,
    private readonly projection: TrendProjectionService,
  ) {}
  onModuleInit() {
    this.registry.register(this);
  }
  async project(tx: OutboxTx, event: OutboxEvent) {
    if (event.aggregateType !== "poll") return;
    const payload = event.payload as Record<string, unknown> | null;
    if (
      !payload ||
      payload.schemaVersion !== 1 ||
      !trendUuid(event.aggregateId) ||
      !trendUuid(payload.voterId) ||
      payload.pollId !== event.aggregateId
    )
      throw new Error("Geçersiz trend kaynak olayı.");
    const result = await this.projection.synchronize(tx, [
      { pollId: event.aggregateId, voterId: payload.voterId },
    ]);
    if (result.invalidSnapshots)
      throw new Error(
        "Trend kaynağında geçersiz yayın snapshot'ı var; onarım gerekli.",
      );
  }
}
