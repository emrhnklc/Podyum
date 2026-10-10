import { createHash } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import type { GameSession, Prisma } from "../../generated/prisma/client.js";

export type GameTx = Prisma.TransactionClient;
export const gameTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const gameConflict = (code: string, message: string) => new ApiError(409, code, message);

export async function gameNow(tx: GameTx) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  return row.now;
}

export async function lockGameUsers(tx: GameTx, userIds: string[]) {
  for (const userId of [...new Set(userIds)].sort()) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
}

export async function gameEvent(tx: GameTx, session: GameSession, type: string, extra: Record<string, Prisma.InputJsonValue> = {}) {
  await tx.outboxEvent.create({ data: { aggregateType: "game-session", aggregateId: session.id, aggregateVersion: session.version,
    type, payload: { schemaVersion: 1, sessionId: session.id, kind: session.kind, phase: session.phase, version: session.version, ...extra },
  } });
}

export function checkGameVersion(session: GameSession, expected: number) {
  if (session.version !== expected) throw gameConflict("VERSION_CONFLICT", "Oyun değişmiş; güncel durumu alıp tekrar dene.");
}
