import type { OutboxEvent, Prisma } from "../../generated/prisma/client.js";

export type OutboxTx = Prisma.TransactionClient;

// Bir olay türünü tüketen modül. İki yoldan en az biri uygulanır:
// - project: DB işi. Olayın yayınlandı işaretiyle aynı transaction'da çalışır,
//   bu yüzden aynı olay ikinci kez uygulanmaz.
// - deliver: dış sağlayıcıya teslim. Başarıdan sonra olay yayınlandı sayılır;
//   teslimden hemen sonra çöküş olursa aynı olay yeniden gelebilir.
export interface OutboxHandler {
  readonly name: string;
  readonly types: readonly string[];
  project?(tx: OutboxTx, event: OutboxEvent): Promise<void>;
  deliver?(event: OutboxEvent): Promise<void>;
}
