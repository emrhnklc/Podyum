import { createDb } from "../src/database/prisma-client.js";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";

const db = createDb();
try {
  await assertProjectDatabase();
  // Tek bağlantılı yerel ortamda işlemleri sıralı tutuyoruz.
  const users = await db.user.count();
  const polls = await db.poll.count();
  const rooms = await db.gameRoom.count();
  const check = await db.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace
  `;
  console.log(JSON.stringify({ connected: true, users, polls, rooms, checkConstraints: Number(check[0].count) }, null, 2));
} finally {
  await db.$disconnect();
}
