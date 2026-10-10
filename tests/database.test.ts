import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { createDb } from "../src/database/prisma-client.js";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import type { Prisma } from "../src/generated/prisma/client.js";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "DB testleri yalnızca yerelde çalışır.");
await assertProjectDatabase();
const db = createDb();
after(async () => { await db.$disconnect(); });
const rollback = new Error("TEST_ROLLBACK");

async function fixture(tx: Prisma.TransactionClient) {
  const users = [randomUUID(), randomUUID(), randomUUID()].sort();
  for (const id of users) await tx.user.create({ data: { id, username: `t_${id.replaceAll("-", "").slice(0, 24)}`, displayName: "Test" } });
  const [author, voter, outsider] = users;
  const media = await tx.mediaAsset.create({ data: { ownerId: author, uploadKey: `test/${randomUUID()}` } });
  const poll = await tx.poll.create({ data: { authorId: author, question: "Test", category: "OUTFIT" } });
  const otherPoll = await tx.poll.create({ data: { authorId: author, question: "Başka", category: "OUTFIT" } });
  const option = await tx.pollOption.create({ data: { pollId: poll.id, position: 1, mediaId: media.id } });
  const otherOption = await tx.pollOption.create({ data: { pollId: otherPoll.id, position: 1, mediaId: media.id } });
  return { author, voter, outsider, media, poll, otherPoll, option, otherOption };
}

async function gameFixture(tx: Prisma.TransactionClient) {
  const f = await fixture(tx);
  const room = await tx.gameRoom.create({ data: { kind: "FRIENDS", hostId: f.author, rulesSnapshot: { rewardsEnabled: false } } });
  for (const userId of [f.author, f.voter]) await tx.gameParticipant.create({ data: { roomId: room.id, userId } });
  const entry = await tx.gameEntry.create({ data: { roomId: room.id, userId: f.author, mediaId: f.media.id } });
  const round = await tx.gameRound.create({ data: { roomId: room.id, entryId: entry.id, targetUserId: f.author, position: 1 } });
  return { ...f, room, entry, round };
}

async function rejected(work: (tx: Prisma.TransactionClient) => Promise<unknown>, expected: string) {
  await assert.rejects(db.$transaction(async (tx) => {
    await work(tx);
    throw rollback;
  }, { timeout: 15_000 }), (error: unknown) => {
    if (error === rollback) return false;
    const value = error as { code?: string; message?: string };
    return value.code === expected || String(value.message).includes(expected);
  });
}

async function rolledBack(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await db.$transaction(async (tx) => { await work(tx); throw rollback; }, { timeout: 15_000 });
    assert.fail("Test transaction'ı geri alınmadı.");
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

test("aynı kişi bir oylamaya iki kayıt yazamaz", async () => {
  await rejected(async (tx) => {
    const f = await fixture(tx);
    const data = { pollId: f.poll.id, voterId: f.voter, optionId: f.option.id };
    await tx.pollVote.create({ data });
    await tx.pollVote.create({ data });
  }, "P2002");
});

test("oyun seçeneği aynı oylamaya ait olmalı", async () => {
  await rejected(async (tx) => {
    const f = await fixture(tx);
    await tx.pollVote.create({ data: { pollId: f.poll.id, voterId: f.voter, optionId: f.otherOption.id } });
  }, "P2003");
});

test("arkadaşlık çifti ters sırada tutulamaz", async () => {
  await rejected(async (tx) => {
    const f = await fixture(tx);
    await tx.friendship.create({ data: { userAId: f.voter, userBId: f.author, requesterId: f.author } });
  }, "friendship_canonical_pair");
});

test("arkadaş isteğini gönderen çiftin üyesi olmalı", async () => {
  await rejected(async (tx) => {
    const f = await fixture(tx);
    await tx.friendship.create({ data: { userAId: f.author, userBId: f.voter, requesterId: f.outsider } });
  }, "friendship_requester_in_pair");
});

test("yayınlanan oylamanın son süresi zorunlu", async () => {
  await rejected(async (tx) => {
    const f = await fixture(tx);
    await tx.poll.update({ where: { id: f.poll.id }, data: { status: "OPEN" } });
  }, "poll_published_deadline");
});

test("oylama beşinci seçenek alamaz", async () => {
  await rejected(async (tx) => {
    const f = await fixture(tx);
    await tx.pollOption.create({ data: { pollId: f.poll.id, mediaId: f.media.id, position: 5 } });
  }, "poll_option_position_range");
});

test("yarışmacı kendine yıldız veremez", async () => {
  await rejected(async (tx) => {
    const f = await gameFixture(tx);
    await tx.gameRating.create({ data: { roundId: f.round.id, roomId: f.room.id, voterId: f.author, targetUserId: f.author, stars: 5, themeFits: true } });
  }, "rating_not_self");
});

test("yarışma yıldızı 1–5 aralığında olmalı", async () => {
  await rejected(async (tx) => {
    const f = await gameFixture(tx);
    await tx.gameRating.create({ data: { roundId: f.round.id, roomId: f.room.id, voterId: f.voter, targetUserId: f.author, stars: 6, themeFits: true } });
  }, "rating_stars_range");
});

test("oda dışındaki kullanıcı değerlendirme yazamaz", async () => {
  await rejected(async (tx) => {
    const f = await gameFixture(tx);
    await tx.gameRating.create({ data: { roundId: f.round.id, roomId: f.room.id, voterId: f.outsider, targetUserId: f.author, stars: 4, themeFits: true } });
  }, "P2003");
});

test("değerlendirmede tur sahibinin kimliği değiştirilemez", async () => {
  await rejected(async (tx) => {
    const f = await gameFixture(tx);
    await tx.gameRating.create({ data: { roundId: f.round.id, roomId: f.room.id, voterId: f.voter, targetUserId: f.outsider, stars: 4, themeFits: true } });
  }, "P2003");
});

test("aynı kullanıcı iki aktif oyunda bulunamaz", async () => {
  await rejected(async (tx) => {
    const f = await gameFixture(tx);
    const room = await tx.gameRoom.create({ data: { kind: "MATCHMAKING", rulesSnapshot: {} } });
    await tx.gameParticipant.create({ data: { roomId: room.id, userId: f.author } });
    await tx.activeGameMembership.create({ data: { roomId: f.room.id, userId: f.author } });
    await tx.activeGameMembership.create({ data: { roomId: room.id, userId: f.author } });
  }, "P2002");
});

test("aynı ödül politika sürümü değiştirilerek ikinci kez yazılamaz", async () => {
  await rejected(async (tx) => {
    const f = await gameFixture(tx);
    const data = { userId: f.author, roomId: f.room.id, sourceKind: "GAME_RESULT", sourceId: f.room.id, awardCode: "TEST", policyVersion: "v1", delta: 10 };
    await tx.pointsLedger.create({ data });
    await tx.pointsLedger.create({ data: { ...data, policyVersion: "v2" } });
  }, "P2002");
});

test("geçerli tercih ve oda değerlendirmesi kaydedilir; test verileri geri alınır", async () => {
  await rolledBack(async (tx) => {
    const f = await gameFixture(tx);
    await tx.pollVote.create({ data: { pollId: f.poll.id, voterId: f.voter, optionId: f.option.id } });
    await tx.gameRating.create({ data: { roundId: f.round.id, roomId: f.room.id, voterId: f.voter, targetUserId: f.author, stars: 4, themeFits: true } });
    assert.equal(await tx.pollVote.count({ where: { pollId: f.poll.id } }), 1);
    assert.equal(await tx.gameRating.count({ where: { roundId: f.round.id } }), 1);
  });
});
