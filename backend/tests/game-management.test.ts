import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { domainApp, loadBackend } from "./helpers/domain-app.js";
let f: Awaited<ReturnType<typeof domainApp>>;
beforeEach(async () => {
  f = await domainApp();
});
afterEach(async () => {
  await f?.cleanup();
});
const reason = "Günlük program testi";
async function theme() {
  return f.ok("POST", "/admin/games/themes", f.actors[0], {
    slug: `theme-${randomUUID()}`,
    title: "Sonbahar",
    reason,
  });
}

test("tema/takvim yalnız admin; doğrulama ve idempotency ortak kuralları korunur", async () => {
  assert.equal(
    (await f.http("GET", "/admin/games/daily-schedule", null)).status,
    401,
  );
  assert.equal(
    (await f.http("GET", "/admin/games/themes", f.actors[1])).status,
    403,
  );
  assert.equal(
    (
      await f.http("POST", "/admin/games/themes", f.actors[0], {
        slug: "..",
        title: "x",
        reason,
      })
    ).status,
    400,
  );
  for (const fields of [
    { title: "ab\u0000cd", reason },
    { title: "Valid", reason: "   " },
  ]) {
    assert.equal(
      (
        await f.http("POST", "/admin/games/themes", f.actors[0], {
          slug: "invalid-input",
          ...fields,
        })
      ).status,
      400,
    );
  }
  const t = await theme();
  assert.equal(t.version, 0);
  assert.equal(
    (
      await f.http("PUT", "/admin/games/daily-schedule", f.actors[0], {
        expectedVersion: 0,
        enabled: true,
        startTime: "20:00",
        timeZone: "Invalid/Zone",
        themeSlug: t.slug,
        reason,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.http("PUT", "/admin/games/daily-schedule", f.actors[0], {
        expectedVersion: 0,
        enabled: true,
        startTime: "99:00",
        timeZone: "Europe/Istanbul",
        themeSlug: t.slug,
        reason,
      })
    ).status,
    400,
  );
});

test("günlük saat/tema DB'den yönetilir, oluşmuş etkinlik snapshot'ı değişmez", async () => {
  const t = await theme(),
    initial = await f.ok("GET", "/admin/games/daily-schedule");
  const key = randomUUID(),
    body = {
      expectedVersion: initial.version,
      enabled: true,
      startTime: "20:00",
      timeZone: "Europe/Istanbul",
      themeSlug: t.slug,
      reason,
    };
  const saved = await f.ok(
    "PUT",
    "/admin/games/daily-schedule",
    f.actors[0],
    body,
    key,
  );
  assert.equal(saved.source, "DATABASE");
  assert.equal(saved.enabled, true);
  assert.deepEqual(
    await f.ok("PUT", "/admin/games/daily-schedule", f.actors[0], body, key),
    saved,
  );
  const { GameSchedulerService } = await loadBackend(
      "modules/games/game-scheduler.service",
    ),
    scheduler = f.app.get(GameSchedulerService);
  const row = await scheduler.ensureDaily(
    "2098-10-20",
    await scheduler.configuredSchedule(),
  );
  assert.equal(
    row.votingEndsAt.getTime() - row.submissionEndsAt.getTime(),
    1800000,
  );
  await f.ok("PUT", "/admin/games/daily-schedule", f.actors[0], {
    ...body,
    expectedVersion: saved.version,
    startTime: "21:00",
  });
  const same = await scheduler.ensureDaily(
    "2098-10-20",
    await scheduler.configuredSchedule(),
  );
  assert.equal(same.id, row.id);
  assert.equal(same.scheduleStartTime, "20:00");
  assert.equal(
    (
      await f.http("PUT", "/admin/games/daily-schedule", f.actors[0], {
        ...body,
        startTime: "22:00",
      })
    ).status,
    409,
  );
  assert.equal(
    await f.db.moderationAudit.count({
      where: { action: "GAME_SCHEDULE_UPDATED", actorId: f.actors[0].id },
    }),
    2,
  );
});

test("etkin takvimdeki tema kapatılamaz; önce takvim kapanır, yeniden açma açıkça yapılır", async () => {
  const t = await theme(),
    config = await f.ok("GET", "/admin/games/daily-schedule");
  const saved = await f.ok("PUT", "/admin/games/daily-schedule", f.actors[0], {
    expectedVersion: config.version,
    enabled: true,
    startTime: "20:00",
    timeZone: "Europe/Istanbul",
    themeSlug: t.slug,
    reason,
  });
  assert.equal(
    (
      await f.http("PUT", `/admin/games/themes/${t.id}`, f.actors[0], {
        expectedVersion: 0,
        title: t.title,
        active: false,
        reason,
      })
    ).status,
    409,
  );
  await f.ok("PUT", "/admin/games/daily-schedule", f.actors[0], {
    expectedVersion: saved.version,
    enabled: false,
    reason,
  });
  await f.ok("PUT", `/admin/games/themes/${t.id}`, f.actors[0], {
    expectedVersion: 0,
    title: "Yeni başlık",
    active: false,
    reason,
  });
  const { GameSchedulerService } = await loadBackend(
    "modules/games/game-scheduler.service",
  );
  assert.equal(
    await f.app.get(GameSchedulerService).configuredSchedule(),
    null,
  );
});

test("takvim/tema audit hatasında kalıcı ayar ve makbuz değişmez", async () => {
  const t = await theme(),
    current = await f.ok("GET", "/admin/games/daily-schedule");
  const original = f.db.$transaction.bind(f.db);
  (f.db as any).$transaction = (work: any, options: any) =>
    original(async (tx: any) => {
      tx.moderationAudit.create = async () => {
        throw new Error("test");
      };
      return work(tx);
    }, options);
  assert.equal(
    (
      await f.http("PUT", "/admin/games/daily-schedule", f.actors[0], {
        expectedVersion: current.version,
        enabled: true,
        startTime: "20:00",
        timeZone: "Europe/Istanbul",
        themeSlug: t.slug,
        reason,
      })
    ).status,
    500,
  );
  (f.db as any).$transaction = original;
  const after = await f.ok("GET", "/admin/games/daily-schedule");
  assert.equal(after.version, current.version);
  assert.equal(after.enabled, current.enabled);
  const schema = await f.ok("GET", "/openapi.json");
  assert.ok(schema.paths["/v1/admin/games/daily-schedule"]);
});
