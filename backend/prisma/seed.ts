import { createDb } from "../src/database/prisma-client.js";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";

const db = createDb();
const ids = {
  elif: "10000000-0000-4000-8000-000000000001",
  deniz: "10000000-0000-4000-8000-000000000002",
  aylin: "10000000-0000-4000-8000-000000000003",
  mediaA: "20000000-0000-4000-8000-000000000001",
  mediaB: "20000000-0000-4000-8000-000000000002",
  publicPoll: "30000000-0000-4000-8000-000000000001",
  friendsPoll: "30000000-0000-4000-8000-000000000002",
  theme: "50000000-0000-4000-8000-000000000001",
  room: "60000000-0000-4000-8000-000000000001",
};

try {
  await assertProjectDatabase();
  const url = new URL(process.env.DATABASE_URL!);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Demo seed yalnızca yerel veritabanına çalıştırılır.");
  }

  await db.$transaction(async (tx) => {
    for (const [id, username, displayName] of [
      [ids.elif, "demo_elifyz", "Elif Yılmaz"],
      [ids.deniz, "demo_denizk", "Deniz"],
      [ids.aylin, "demo_aylinb", "Aylin"],
    ]) {
      await tx.user.upsert({ where: { id }, update: {}, create: { id, username, displayName } });
    }

    for (const [id, label] of [["minimal", "Minimal"], ["vintage", "Vintage"], ["street", "Sokak stili"]]) {
      await tx.styleTag.upsert({ where: { id }, update: { label }, create: { id, label } });
      await tx.userStyle.upsert({
        where: { userId_styleId: { userId: ids.elif, styleId: id } },
        update: {}, create: { userId: ids.elif, styleId: id },
      });
    }

    await tx.friendship.upsert({
      where: { userAId_userBId: { userAId: ids.elif, userBId: ids.deniz } },
      update: {},
      create: { userAId: ids.elif, userBId: ids.deniz, requesterId: ids.elif, status: "ACCEPTED" },
    });

    // Bunlar yalnızca demo kayıtlarıdır; depoda gerçek fotoğraf bulunmuyor.
    for (const [id, suffix] of [[ids.mediaA, "a"], [ids.mediaB, "b"]]) {
      await tx.mediaAsset.upsert({
        where: { id }, update: {},
        create: {
          id, ownerId: ids.elif, status: "READY", uploadKey: `demo/staging/${suffix}`,
          displayKey: `demo/display/${suffix}.jpg`, mimeType: "image/jpeg",
          byteSize: 1000, width: 100, height: 100, sourceVersion: "demo-only",
          previewAcceptedAt: new Date(),
        },
      });
    }

    for (const [id, visibility, question, ordinal] of [
      [ids.publicPoll, "PUBLIC", "Cuma akşamı ilk buluşma. Hangisi?", 1],
      [ids.friendsPoll, "FRIENDS", "Arkadaşlar, akşam için hangisi?", 3],
    ] as const) {
      await tx.poll.upsert({
        where: { id }, update: {},
        create: {
          id, authorId: ids.elif, question, category: "OUTFIT", visibility,
          status: "OPEN", durationSeconds: 86400,
          publishedAt: new Date(), closesAt: new Date(Date.now() + 86_400_000),
          options: { create: [
            { id: `40000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`, position: 1, mediaId: ids.mediaA },
            { id: `40000000-0000-4000-8000-${String(ordinal + 1).padStart(12, "0")}`, position: 2, mediaId: ids.mediaB },
          ] },
        },
      });
    }

    await tx.theme.upsert({
      where: { id: ids.theme }, update: {},
      create: { id: ids.theme, slug: "90lar", title: "90'lar" },
    });
    await tx.gameRoom.upsert({
      where: { id: ids.room }, update: {},
      create: {
        id: ids.room, hostId: ids.elif, themeId: ids.theme, kind: "FRIENDS",
        rulesSnapshot: { version: "alpha-v1", quorumRatio: 0.7, rewardsEnabled: false },
      },
    });
  });
  console.log("Demo kayıtları hazır: 3 profil, 2 oylama, 1 bekleyen oda. Seed tekrar çalıştırılabilir; gerçek görsel içermez.");
} finally {
  await db.$disconnect();
}
