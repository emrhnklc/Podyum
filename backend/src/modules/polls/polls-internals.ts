import type { Poll, Prisma } from "../../generated/prisma/client.js";

export async function pollServerNow(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  return row.now;
}

export function effectivePollStatus(poll: Pick<Poll, "status" | "closesAt">, now: Date) {
  return poll.status === "OPEN" && poll.closesAt && poll.closesAt <= now ? "CLOSED" : poll.status;
}

export async function writePollEvent(tx: Prisma.TransactionClient,
  poll: Pick<Poll, "id" | "authorId" | "version" | "status" | "visibility">, type: string,
  extra: Record<string, Prisma.InputJsonValue> = {}) {
  await tx.outboxEvent.create({ data: {
    aggregateType: "poll", aggregateId: poll.id, aggregateVersion: poll.version, type,
    payload: { schemaVersion: 1, pollId: poll.id, authorId: poll.authorId, version: poll.version, status: poll.status, visibility: poll.visibility, ...extra },
  } });
}
