import { utimes } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, symlink, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { domainApp, loadBackend } from "./helpers/domain-app.js";
import { cleanLocalDeliveries } from "../src/common/maintenance/local-delivery-retention.js";
import { readEnvironment } from "../src/common/config/environment.js";
let f: Awaited<ReturnType<typeof domainApp>>;
beforeEach(async () => {
  f = await domainApp();
});
afterEach(async () => {
  await f?.cleanup();
});
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );
async function delivery(
  kind: "mail" | "push",
  expired: boolean,
  invalid = false,
) {
  const directory = join(f.directory, kind),
    name = `${Date.now()}-${randomUUID()}.json`;
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  const now = Date.now();
  const row = {
    transport: "local-only",
    token: "private-token",
    to: "private-push-token",
    kind: "RESET_PASSWORD",
    createdAt: new Date(now - 10000).toISOString(),
    expiresAt: new Date(expired ? now - 1000 : now + 100000).toISOString(),
    ttlSeconds: expired ? 1 : 1000,
  };
  await writeFile(path, invalid ? "{" : JSON.stringify(row));
  return { directory, name, path };
}

test("posta/push dry-run silmez; apply yalnız süresi dolan dosyayı siler", async () => {
  for (const kind of ["mail", "push"] as const) {
    const old = await delivery(kind, true),
      live = await delivery(kind, false);
    const preview = await cleanLocalDeliveries(
      old.directory,
      kind,
      new Date(),
      false,
      100,
    );
    assert.equal(preview.candidates, 1);
    assert.equal(preview.removed, 0);
    assert.ok(await exists(old.path));
    const result = await cleanLocalDeliveries(
      old.directory,
      kind,
      new Date(),
      true,
      100,
    );
    assert.equal(result.removed, 1);
    assert.ok(await exists(live.path));
    assert.equal(await exists(old.path), false);
    assert.equal(
      (await cleanLocalDeliveries(old.directory, kind, new Date(), true, 100))
        .removed,
      0,
    );
  }
});

test("bozuk/büyük JSON, yabancı dosya, alt dizin ve symlink silinmez veya takip edilmez", async () => {
  const bad = await delivery("mail", true, true),
    directory = bad.directory;
  const other = join(directory, "other.json"),
    target = join(f.directory, "outside.json");
  await writeFile(other, JSON.stringify({ expiresAt: "2000-01-01T00:00:00Z" }));
  await writeFile(target, "private outside");
  const link = join(directory, `${Date.now()}-${randomUUID()}.json`);
  await symlink(target, link);
  await mkdir(join(directory, `${Date.now()}-${randomUUID()}.json`));
  const large = join(directory, `${Date.now()}-${randomUUID()}.json`);
  await writeFile(large, "x".repeat(65537));
  const result = await cleanLocalDeliveries(
    directory,
    "mail",
    new Date(),
    true,
    100,
  );
  assert.equal(result.invalid, 2);
  assert.equal(result.removed, 0);
  assert.equal(await readFile(target, "utf8"), "private outside");
  assert.ok(await exists(other));
  assert.ok(await exists(bad.path));
  const rootLink = join(f.directory, "root-link");
  await symlink(directory, rootLink);
  await assert.rejects(
    cleanLocalDeliveries(rootLink, "mail", new Date(), true, 100),
  );
});

test("dosya batch imleci canlı dosyalarda takılmaz, sonraki çalışmada ilerler", async () => {
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(await delivery("mail", false));
  const ordered = rows.map((row) => row.name).sort();
  const first = await cleanLocalDeliveries(
    rows[0].directory,
    "mail",
    new Date(),
    false,
    1,
  );
  assert.equal(first.scanned, 1);
  assert.equal(first.nextCursor, ordered[0]);
  assert.equal(first.hasMore, true);
  const second = await cleanLocalDeliveries(
    rows[0].directory,
    "mail",
    new Date(),
    false,
    1,
    first.nextCursor,
  );
  assert.equal(second.nextCursor, ordered[1]);
  const third = await cleanLocalDeliveries(
    rows[0].directory,
    "mail",
    new Date(),
    false,
    1,
    second.nextCursor,
  );
  assert.equal(third.nextCursor, null);
  assert.equal(third.hasMore, false);
});

test("bakım raporu yöneticiye özeldir; dry-run medya ve teknik kaydı değiştirmez", async () => {
  assert.equal((await f.http("GET", "/admin/maintenance", null)).status, 401);
  assert.equal(
    (await f.http("GET", "/admin/maintenance", f.actors[1])).status,
    403,
  );
  const { MaintenanceService } = await loadBackend(
    "modules/maintenance/maintenance.service",
  );
  await delivery("mail", true);
  const before = {
    sessions: await f.db.authSession.count(),
    notifications: await f.db.notification.count(),
    media: await f.db.mediaAsset.count(),
  };
  const result = await f.app.get(MaintenanceService).run(false, 10);
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.mode, "dry-run");
  assert.deepEqual(
    {
      sessions: await f.db.authSession.count(),
      notifications: await f.db.notification.count(),
      media: await f.db.mediaAsset.count(),
    },
    before,
  );
  const state = await f.ok("GET", "/admin/maintenance");
  assert.equal(state.status, "SUCCEEDED");
  assert.ok(state.lastSuccessAt);
  assert.equal(state.consecutiveFailures, 0);
  const json = JSON.stringify(state);
  for (const secret of [
    f.directory,
    "private-token",
    "runToken",
    "fileCursors",
    "nextCursor",
  ])
    assert.equal(json.includes(secret), false);
});

test("aynı süreç işi tekilleştirir; başka süreç lease'i korunur ve süresi geçince toparlanır", async () => {
  const { MaintenanceService } = await loadBackend(
    "modules/maintenance/maintenance.service",
  );
  const service = f.app.get(MaintenanceService);
  const a = service.run(false, 10),
    b = service.run(false, 10);
  assert.equal(a, b);
  await a;
  await f.db.maintenanceState.update({
    where: { key: "technical" },
    data: {
      runToken: randomUUID(),
      leaseUntil: new Date(Date.now() + 100000),
      status: "RUNNING",
    },
  });
  assert.equal((await service.run(false, 10)).status, "BUSY");
  await f.db.maintenanceState.update({
    where: { key: "technical" },
    data: { leaseUntil: new Date(Date.now() - 1000) },
  });
  assert.equal((await service.run(false, 10)).status, "SUCCEEDED");
});

test("bir faz bozulunca diğerleri çalışır, hata sayısı kalır ve yeniden denemede sıfırlanır", async () => {
  const { MaintenanceService } = await loadBackend(
      "modules/maintenance/maintenance.service",
    ),
    { MediaService } = await loadBackend("modules/media/media.service");
  const media = f.app.get(MediaService),
    original = media.previewCleanup.bind(media);
  media.previewCleanup = async () => {
    throw new Error("private path/token must not leak");
  };
  const result = await f.app.get(MaintenanceService).run(false, 10);
  assert.equal(result.status, "PARTIAL");
  assert.deepEqual(result.failedPhases, ["media"]);
  let state = await f.ok("GET", "/admin/maintenance");
  assert.equal(state.consecutiveFailures, 1);
  assert.ok(state.lastFailureAt);
  assert.equal(JSON.stringify(state).includes("private path"), false);
  media.previewCleanup = original;
  assert.equal(
    (await f.app.get(MaintenanceService).run(false, 10)).status,
    "SUCCEEDED",
  );
  state = await f.ok("GET", "/admin/maintenance");
  assert.equal(state.consecutiveFailures, 0);
});

test("zamanlayıcı açılış/periyot/kapanış çalışır, test ortamında kendiliğinden açılmaz", async (context) => {
  const { MaintenanceWorker } = await loadBackend(
      "modules/maintenance/maintenance.worker",
    ),
    { MaintenanceService } = await loadBackend(
      "modules/maintenance/maintenance.service",
    );
  const worker = f.app.get(MaintenanceWorker),
    service = f.app.get(MaintenanceService),
    original = service.run.bind(service);
  let calls = 0;
  service.run = async () => {
    calls++;
    return {};
  };
  await worker.onApplicationBootstrap();
  assert.equal(calls, 0);
  context.mock.timers.enable({ apis: ["setInterval"] });
  const oldInterval = process.env.MAINTENANCE_INTERVAL_MS;
  try {
    process.env.NODE_ENV = "development";
    process.env.MAINTENANCE_WORKER_ENABLED = "true";
    process.env.MAINTENANCE_INTERVAL_MS = "60000";
    await worker.onApplicationBootstrap();
    assert.equal(calls, 1);
    context.mock.timers.tick(60000);
    assert.equal(calls, 2);
    await worker.onModuleDestroy();
    context.mock.timers.tick(60000);
    assert.equal(calls, 2);
  } finally {
    process.env.NODE_ENV = "test";
    if (oldInterval === undefined) delete process.env.MAINTENANCE_INTERVAL_MS;
    else process.env.MAINTENANCE_INTERVAL_MS = oldInterval;
    service.run = original;
    context.mock.timers.reset();
  }
});

test("bakım ayarları geçersiz boolean ve aralıkları reddeder", () => {
  for (const overrides of [
    { MAINTENANCE_WORKER_ENABLED: "yes" },
    { MAINTENANCE_APPLY: "yes" },
    { MAINTENANCE_INTERVAL_MS: "1" },
    { MAINTENANCE_BATCH_SIZE: "501" },
  ])
    assert.throws(() => readEnvironment({ ...process.env, ...overrides }));
});

test("medya imleci bağlı dizinlerde takılmaz ve sonraki orphan'ı tarar", async () => {
  const { MediaService } = await loadBackend("modules/media/media.service"),
    service = f.app.get(MediaService);
  const ids = Array.from({ length: 3 }, () => randomUUID()).sort();
  for (const [i, id] of ids.entries()) {
    const path = join(f.directory, "media", id);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "display.webp"), "test");
    await utimes(path, new Date(0), new Date(0));
    if (i < 2)
      await f.db.mediaAsset.create({
        data: {
          id,
          ownerId: f.actors[1].id,
          uploadKey: `${id}/source`,
          displayKey: `${id}/display.webp`,
          status: "READY",
        },
      });
  }
  const first = await service.previewCleanup(new Date(), 1);
  assert.equal(first.orphanCandidates, 0);
  assert.equal(first.orphanCursor, ids[0]);
  const second = await service.previewCleanup(
    new Date(),
    1,
    first.orphanCursor,
  );
  assert.equal(second.orphanCandidates, 0);
  const third = await service.previewCleanup(
    new Date(),
    1,
    second.orphanCursor,
  );
  assert.equal(third.orphanCandidates, 1);
  assert.equal(third.orphanCursor, null);
  assert.ok(await exists(join(f.directory, "media", ids[2])));
});
