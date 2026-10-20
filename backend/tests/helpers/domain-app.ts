import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  Prisma,
  type PrismaClient,
} from "../../src/generated/prisma/client.js";
export type Actor = { id: string; token: string };
export const loadBackend = (path: string) =>
  import(new URL(`../../dist/${path}.js`, import.meta.url).href);
export async function domainApp() {
  const keys = [
    "NODE_ENV",
    "AUTH_MOCK_ENABLED",
    "LOCAL_MEDIA_DIR",
    "LOCAL_MAILBOX_DIR",
    "LOCAL_PUSH_DIR",
    "MAINTENANCE_WORKER_ENABLED",
    "DAILY_GAME_START_TIME",
    "DAILY_GAME_TIME_ZONE",
    "DAILY_GAME_THEME_SLUG",
  ] as const;
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  process.env.MAINTENANCE_WORKER_ENABLED = "false";
  delete process.env.DAILY_GAME_START_TIME;
  delete process.env.DAILY_GAME_TIME_ZONE;
  delete process.env.DAILY_GAME_THEME_SLUG;
  const directory = await mkdtemp(join(tmpdir(), "podyum-domain-"));
  process.env.LOCAL_MEDIA_DIR = join(directory, "media");
  process.env.LOCAL_MAILBOX_DIR = join(directory, "mail");
  process.env.LOCAL_PUSH_DIR = join(directory, "push");
  const { createApp } = await loadBackend("create-app");
  const { PrismaService } = await loadBackend("database/prisma.service");
  const app = (await createApp()) as NestExpressApplication;
  await app.listen(0, "127.0.0.1");
  const db = app.get(PrismaService) as PrismaClient,
    base = `${await app.getUrl()}/v1`;
  const originalSchedule = await db.gameDailySchedule.findUnique({
    where: { id: "00000000-0000-4000-8000-000000000001" },
  });
  const originalMaintenance = await db.maintenanceState.findUnique({
    where: { key: "technical" },
  });
  const actors: Actor[] = [],
    stores: string[] = [],
    products: string[] = [],
    themes: string[] = [];
  async function http(
    method: string,
    path: string,
    actor: Actor | null = actors[0],
    body?: unknown,
    key: string | null = randomUUID(),
  ) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = {
      status: response.status,
      body: (await response.json()) as any,
    };
    if (response.status === 201 && method === "POST") {
      if (path === "/admin/catalog/stores") stores.push(result.body.id);
      if (path === "/admin/catalog/products") products.push(result.body.id);
      if (path === "/admin/games/themes") themes.push(result.body.id);
    }
    return result;
  }
  async function ok(
    method: string,
    path: string,
    actor: Actor = actors[0],
    body?: unknown,
    key?: string,
  ) {
    const result = await http(method, path, actor, body, key);
    assert.ok(
      result.status < 300,
      `${method} ${path}: ${JSON.stringify(result)}`,
    );
    return result.body;
  }
  for (let i = 0; i < 3; i++) {
    const session = await http("POST", "/auth/mock", null, {
      provider: "google",
      subject: `domain_${randomUUID()}`,
      acknowledgeMock: true,
    });
    assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken };
    actor.id = (await ok("GET", "/auth/me", actor)).user.id;
    actors.push(actor);
  }
  await db.user.update({
    where: { id: actors[0].id },
    data: { role: "ADMIN" },
  });
  async function cleanup() {
    try {
      const ids = actors.map((actor) => actor.id);
      await db.$transaction(
        async (tx) => {
          const games = (
            await tx.gameSession.findMany({
              where: {
                OR: [{ hostId: { in: ids } }, { themeId: { in: themes } }],
              },
              select: { id: true },
            })
          ).map((row) => row.id);
          const polls = (
            await tx.poll.findMany({
              where: { authorId: { in: ids } },
              select: { id: true },
            })
          ).map((row) => row.id);
          const suggestions = (
            await tx.catalogSuggestion.findMany({
              where: { submittedById: { in: ids } },
              select: { id: true },
            })
          ).map((row) => row.id);
          const jobs = (
            await tx.accountDeletion.findMany({
              where: { userId: { in: ids } },
              select: { id: true },
            })
          ).map((row) => row.id);
          const resources = [
            ...ids,
            ...stores,
            ...products,
            ...themes,
            ...games,
            ...polls,
            ...suggestions,
            ...jobs,
          ];
          await tx.outboxEvent.deleteMany({
            where: { aggregateId: { in: resources } },
          });
          await tx.moderationAudit.deleteMany({
            where: { actorId: { in: ids } },
          });
          await tx.catalogSuggestion.deleteMany({
            where: { submittedById: { in: ids } },
          });
          await tx.pollVoteReason.deleteMany({
            where: { pollId: { in: polls } },
          });
          await tx.pollVote.deleteMany({ where: { pollId: { in: polls } } });
          await tx.pollSave.deleteMany({ where: { pollId: { in: polls } } });
          await tx.comment.deleteMany({ where: { pollId: { in: polls } } });
          await tx.productTag.deleteMany({
            where: { option: { pollId: { in: polls } } },
          });
          await tx.pollOption.deleteMany({ where: { pollId: { in: polls } } });
          await tx.poll.deleteMany({ where: { id: { in: polls } } });
          await tx.catalogProductUrl.deleteMany({
            where: { productId: { in: products } },
          });
          await tx.catalogProduct.updateMany({
            where: { id: { in: products } },
            data: { status: "ARCHIVED", mergedIntoId: null },
          });
          await tx.catalogProduct.deleteMany({
            where: { id: { in: products } },
          });
          await tx.catalogStore.deleteMany({ where: { id: { in: stores } } });
          await tx.gameLeaguePoint.deleteMany({
            where: { sessionId: { in: games } },
          });
          await tx.gameOutcome.deleteMany({
            where: { sessionId: { in: games } },
          });
          await tx.gameScore.deleteMany({
            where: { sessionId: { in: games } },
          });
          await tx.gameSubmission.deleteMany({
            where: { sessionId: { in: games } },
          });
          await tx.gameMembership.deleteMany({
            where: { sessionId: { in: games } },
          });
          await tx.gameSession.deleteMany({ where: { id: { in: games } } });
          await tx.gameDailySchedule.deleteMany();
          if (originalSchedule)
            await tx.gameDailySchedule.create({ data: originalSchedule });
          await tx.theme.deleteMany({ where: { id: { in: themes } } });
          await tx.maintenanceState.deleteMany({ where: { key: "technical" } });
          if (originalMaintenance)
            await tx.maintenanceState.create({
              data: {
                ...originalMaintenance,
                report: originalMaintenance.report ?? Prisma.DbNull,
                fileCursors: originalMaintenance.fileCursors ?? Prisma.DbNull,
              },
            });
          await tx.notification.deleteMany({ where: { userId: { in: ids } } });
          await tx.idempotencyRecord.deleteMany({
            where: { userId: { in: ids } },
          });
          await tx.accountDeletion.deleteMany({
            where: { userId: { in: ids } },
          });
          await tx.mediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
          await tx.deviceToken.deleteMany({ where: { userId: { in: ids } } });
          await tx.usedRefreshToken.deleteMany({
            where: { session: { userId: { in: ids } } },
          });
          await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
          await tx.authActionToken.deleteMany({
            where: { userId: { in: ids } },
          });
          await tx.authCredential.deleteMany({
            where: { userId: { in: ids } },
          });
          await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
          await tx.userStyle.deleteMany({ where: { userId: { in: ids } } });
          await tx.userSettings.deleteMany({ where: { userId: { in: ids } } });
          await tx.userPrivate.deleteMany({ where: { userId: { in: ids } } });
          await tx.user.deleteMany({ where: { id: { in: ids } } });
        },
        { timeout: 30_000 },
      );
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
      for (const key of keys) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  }
  return {
    app,
    db,
    http,
    ok,
    actors,
    directory,
    stores,
    products,
    themes,
    cleanup,
  };
}
