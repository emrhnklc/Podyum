import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
let app: NestExpressApplication;
let db: PrismaClient;
let base: string;
let marker: string;
let accounts: { id: string; token: string; username: string }[];
const originalEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED };

async function call(path: string, token?: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "PATCH",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() as any };
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  marker = `u_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
  accounts = [];
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
  for (let i = 0; i < 3; i++) {
    const response = await fetch(`${base}/auth/mock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", subject: `${marker}_${i}`, acknowledgeMock: true }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, 200);
    const session = await response.json() as any;
    const me = await call("/auth/me", session.accessToken);
    accounts.push({ id: me.body.user.id, username: me.body.user.username, token: session.accessToken });
  }
});

afterEach(async () => {
  try {
    if (db) {
      const users = await db.user.findMany({ where: { identities: { some: { issuer: "mock:google", subject: { startsWith: marker } } } }, select: { id: true } });
      const ids = users.map(({ id }) => id);
      await db.$transaction(async (tx) => {
        await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
        await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
        await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
        await tx.poll.deleteMany({ where: { authorId: { in: ids } } });
        await tx.userStyle.deleteMany({ where: { userId: { in: ids } } });
        await tx.userPrivate.deleteMany({ where: { userId: { in: ids } } });
        await tx.userSettings.deleteMany({ where: { userId: { in: ids } } });
        await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
        await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
        await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
        await tx.styleTag.deleteMany({ where: { id: { startsWith: marker } } });
      });
    }
  } finally {
    await app?.close();
    for (const key of ["NODE_ENV", "AUTH_MOCK_ENABLED"] as const) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

test("profil endpoint'leri oturum ister; varsayılanlar okuma sırasında DB'ye yazılmaz", async () => {
  for (const path of ["/me", "/me/private", "/me/settings", "/style-tags", "/users/username-availability?username=available", `/users/${accounts[0].id}`]) {
    assert.equal((await call(path)).status, 401);
  }
  for (const path of ["/me", "/me/private", "/me/settings"]) assert.equal((await call(path, undefined, {})).status, 401);
  const a = accounts[0];
  const me = await call("/me", a.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.profile.id, a.id);
  assert.equal(me.body.profileSetupRequired, true);
  assert.deepEqual(me.body.profile.counts, { polls: 0, friends: 0, stars: 0 });
  assert.deepEqual(me.body.profile.styles, []);
  assert.equal(me.body.profile.bio, null);
  assert.deepEqual((await call("/me/private", a.token)).body, { gender: null, ageBand: null, cityCode: null, analyticsConsent: false, analyticsConsentAt: null, analyticsRevision: 0 });
  assert.deepEqual((await call("/me/settings", a.token)).body, {
    pushEnabled: true, friendRequestNotifications: true, pollResultNotifications: true, commentNotifications: true,
    defaultPollVisibility: "PUBLIC", defaultCommentsEnabled: true, defaultBlurFace: true,
  });
  assert.equal(await db.userPrivate.count({ where: { userId: a.id } }), 0);
  assert.equal(await db.userSettings.count({ where: { userId: a.id } }), 0);
});

test("profil düzenleme normalize edilir; stiller atomik değiştirilir ve kurulum auth ile tutarlıdır", async () => {
  const a = accounts[0];
  const styleIds = [`${marker}_a`, `${marker}_b`];
  await db.styleTag.createMany({ data: styleIds.map((id) => ({ id, label: id })) });
  assert.ok((await call("/style-tags", a.token)).body.some((style: any) => style.id === styleIds[0]));
  assert.equal((await call("/me", a.token, { bio: "  Merhaba  " })).body.profileSetupRequired, true);
  const updated = await call("/me", a.token, { username: ` ${marker.toUpperCase()} `, displayName: "  Elif  ", bio: "  Minimal severim  ", styleIds: [...styleIds].reverse() });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.profile.username, marker);
  assert.equal(updated.body.profile.displayName, "Elif");
  assert.equal(updated.body.profile.bio, "Minimal severim");
  assert.deepEqual(updated.body.profile.styles.map((style: any) => style.id), styleIds);
  assert.equal(updated.body.profileSetupRequired, false);
  const authMe = await call("/auth/me", a.token);
  assert.equal(authMe.body.profileSetupRequired, false);
  assert.equal(authMe.body.user.username, marker);
  const completedAt = (await db.user.findUniqueOrThrow({ where: { id: a.id } })).profileCompletedAt;
  const invalid = await call("/me", a.token, { displayName: "Kaybolmamalı", styleIds: [`${marker}_missing`] });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "UNKNOWN_STYLE_TAG");
  assert.equal((await call("/me", a.token)).body.profile.displayName, "Elif");
  assert.deepEqual((await call("/me", a.token)).body.profile.styles.map((style: any) => style.id), styleIds);
  const cleared = await call("/me", a.token, { bio: "  ", styleIds: [] });
  assert.equal(cleared.body.profile.bio, null);
  assert.deepEqual(cleared.body.profile.styles, []);
  assert.deepEqual((await db.user.findUniqueOrThrow({ where: { id: a.id } })).profileCompletedAt, completedAt);
});

test("kullanıcı adı uygunluğu rezervasyon değildir; çakışma diğer profil alanlarını değiştirmez", async () => {
  const [a, b] = accounts;
  assert.equal((await call(`/users/username-availability?username=${a.username.toUpperCase()}`, a.token)).body.available, true);
  assert.equal((await call(`/users/username-availability?username=${b.username}`, a.token)).body.available, false);
  assert.equal((await call(`/users/username-availability?username=${marker}`, a.token)).body.available, true);
  const before = (await call("/me", a.token)).body;
  const conflict = await call("/me", a.token, { username: b.username, displayName: "Değişmemeli", styleIds: [] });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, "USERNAME_UNAVAILABLE");
  assert.deepEqual((await call("/me", a.token)).body, before);
  await db.user.update({ where: { id: b.id }, data: { status: "DELETED" } });
  assert.equal((await call(`/users/username-availability?username=${b.username}`, a.token)).body.available, false);
  assert.equal((await call("/users/username-availability?username=x", a.token)).status, 400);
});

test("özel profil yalnızca sahibine açılır; izin açıkça alınır ve geri alma kalıcı olay üretir", async () => {
  const [a, b] = accounts;
  const demographic = await call("/me/private", a.token, { gender: "WOMAN", ageBand: "AGE_18_24", cityCode: " tr_34 " });
  assert.equal(demographic.status, 200);
  assert.equal(demographic.body.cityCode, "TR_34");
  assert.equal(demographic.body.analyticsConsent, false);
  assert.equal(demographic.body.analyticsRevision, 1);
  const grant = await call("/me/private", a.token, { analyticsConsent: true });
  assert.equal(grant.body.analyticsConsent, true);
  assert.ok(Number.isFinite(Date.parse(grant.body.analyticsConsentAt)));
  assert.equal(grant.body.analyticsRevision, 2);
  const again = await call("/me/private", a.token, { analyticsConsent: true });
  assert.deepEqual(again.body, grant.body);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: a.id } }), 2);
  for (const response of [(await call(`/users/${a.id}`, b.token)).body, (await call("/me", a.token)).body.profile]) {
    assert.deepEqual(Object.keys(response).sort(), ["id", "username", "displayName", "bio", "styles", "createdAt", "updatedAt", "counts"].sort());
  }
  assert.equal((await call(`/users/${a.id}/private`, b.token)).status, 404);
  assert.equal((await call("/me/private", b.token)).body.gender, null);
  const revoke = await call("/me/private", a.token, { analyticsConsent: false });
  assert.equal(revoke.body.analyticsConsentAt, null);
  assert.equal(revoke.body.analyticsRevision, 3);
  const events = await db.outboxEvent.findMany({ where: { aggregateId: a.id }, orderBy: { aggregateVersion: "asc" } });
  assert.deepEqual(events.map((event) => event.aggregateVersion), [1, 2, 3]);
  assert.equal(events[2].publishedAt, null);
  assert.equal(events[2].type, "user.analytics-preferences.changed");
  assert.deepEqual(events[2].payload, {
    schemaVersion: 1, userId: a.id, revision: 3, analyticsConsent: false, consentChanged: true, demographicsChanged: false,
    changedAt: (events[2].payload as any).changedAt,
  });
  assert.ok(!JSON.stringify(events.map((event) => event.payload)).includes("TR_34"));
  assert.equal((await call("/me/private", a.token, { analyticsConsent: false })).body.analyticsRevision, 3);
  const clear = await call("/me/private", a.token, { gender: null, ageBand: null, cityCode: null });
  assert.equal(clear.body.gender, null);
  assert.equal(clear.body.ageBand, null);
  assert.equal(clear.body.cityCode, null);
  assert.equal(clear.body.analyticsRevision, 4);
});

test("bildirim ve paylaşım ayarları kısmen güncellenir; başka kullanıcının ayarları değişmez", async () => {
  const [a, b] = accounts;
  const first = await call("/me/settings", a.token, { pushEnabled: false, defaultPollVisibility: "FRIENDS" });
  assert.equal(first.status, 200);
  assert.equal(first.body.pushEnabled, false);
  assert.equal(first.body.defaultPollVisibility, "FRIENDS");
  const second = await call("/me/settings", a.token, { commentNotifications: false, defaultBlurFace: false });
  assert.equal(second.body.pushEnabled, false);
  assert.equal(second.body.defaultPollVisibility, "FRIENDS");
  assert.equal(second.body.commentNotifications, false);
  assert.equal(second.body.defaultBlurFace, false);
  assert.deepEqual((await call("/me/settings", a.token)).body, second.body);
  assert.equal((await call("/me/settings", b.token)).body.pushEnabled, true);
  assert.equal(await db.userSettings.count({ where: { userId: b.id } }), 0);
});

test("analiz olayı yazılamazsa özel bilgi/izin değişikliği transaction ile geri alınır", async () => {
  const a = accounts[0];
  const before = (await call("/me/private", a.token)).body;
  const original = db.$transaction.bind(db);
  const unbound = db.$transaction;
  // Yalnız bu uygulamanın transaction'ında outbox yazım hatası enjekte edilir.
  // DB trigger'ı/şeması veya diğer bağlantılar değiştirilmez.
  (db as any).$transaction = (work: any, options: any) => original(async (tx) => work(new Proxy(tx, {
    get(target, key) {
      if (key !== "outboxEvent") return Reflect.get(target, key);
      return new Proxy(target.outboxEvent, {
        get(delegate, method) {
          if (method === "create") return async () => { throw new Error("TEST_OUTBOX_UNAVAILABLE"); };
          return Reflect.get(delegate, method);
        },
      });
    },
  })), options);
  try {
    const failed = await call("/me/private", a.token, { gender: "WOMAN", analyticsConsent: true });
    assert.equal(failed.status, 500);
    assert.equal(failed.body.error.code, "INTERNAL_ERROR");
    assert.ok(!JSON.stringify(failed.body).includes("TEST_OUTBOX_UNAVAILABLE"));
  } finally {
    db.$transaction = unbound;
  }
  assert.deepEqual((await call("/me/private", a.token)).body, before);
  assert.equal(await db.userPrivate.count({ where: { userId: a.id } }), 0);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: a.id } }), 0);
});

test("PATCH doğrulaması eksik alanı null'dan ayırır; istemci kimlik/hak/puan gönderemez", async () => {
  const a = accounts[0];
  for (const path of ["/me", "/me/private", "/me/settings"]) {
    const empty = await call(path, a.token, {});
    assert.equal(empty.status, 400);
    assert.equal(empty.body.error.code, "EMPTY_UPDATE");
    assert.equal((await call(path, a.token, { userId: accounts[1].id })).status, 400);
  }
  const invalidProfiles = [
    { displayName: null }, { displayName: "  " }, { username: null }, { styleIds: null },
    { styleIds: ["minimal", "minimal"] }, { styleIds: Array.from({ length: 11 }, (_, i) => `style_${i}`) },
    { bio: 42 }, { bio: "x".repeat(301) }, { status: "ACTIVE" }, { stars: 5000 }, { isPlus: true }, { analyticsConsent: true },
  ];
  for (const body of invalidProfiles) assert.equal((await call("/me", a.token, body)).status, 400, JSON.stringify(body));
  for (const body of [{ analyticsConsent: null }, { analyticsConsent: "true" }, { gender: "FEMALE" }, { ageBand: 18 }, { cityCode: "" }, { cityCode: "TR 34" }]) {
    assert.equal((await call("/me/private", a.token, body)).status, 400, JSON.stringify(body));
  }
  for (const body of [{ pushEnabled: "false" }, { pushEnabled: null }, { defaultPollVisibility: "PRIVATE" }, { defaultBlurFace: 0 }, { analyticsConsent: true }]) {
    assert.equal((await call("/me/settings", a.token, body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await call("/me", a.token, { bio: null })).status, 200);
  assert.equal((await call(`/me/private?userId=${accounts[1].id}`, a.token)).body.gender, null);
});

test("paylaşım sayacı izleyiciye göre değişir; engel iki yönde de profil erişimini kapatır", async () => {
  const [a, b, c] = accounts;
  const now = new Date();
  for (const [status, visibility, contentStatus] of [
    ["OPEN", "PUBLIC", "VISIBLE"], ["CLOSED", "FRIENDS", "VISIBLE"],
    ["DRAFT", "PUBLIC", "VISIBLE"], ["CANCELLED", "PUBLIC", "VISIBLE"],
    ["OPEN", "PUBLIC", "HIDDEN"], ["CLOSED", "PUBLIC", "REMOVED"],
  ] as const) {
    await db.poll.create({ data: {
      authorId: a.id, question: marker, category: "OUTFIT", status, visibility, contentStatus,
      ...(["OPEN", "CLOSED"].includes(status) ? { publishedAt: now, closesAt: new Date(now.getTime() + 1800_000) } : {}),
    } });
  }
  const [userAId, userBId] = [a.id, b.id].sort();
  await db.friendship.create({ data: { userAId, userBId, requesterId: a.id, status: "ACCEPTED" } });
  const [pendingA, pendingB] = [a.id, c.id].sort();
  await db.friendship.create({ data: { userAId: pendingA, userBId: pendingB, requesterId: c.id } });
  assert.equal((await call("/me", a.token)).body.profile.counts.polls, 2);
  assert.equal((await call(`/users/${a.id.toUpperCase()}`, a.token)).body.counts.polls, 2);
  assert.equal((await call(`/users/${a.id}`, b.token)).body.counts.polls, 2);
  assert.equal((await call(`/users/${a.id}`, c.token)).body.counts.polls, 1);
  assert.equal((await call(`/users/${a.id}`, c.token)).body.counts.friends, 1);
  await db.friendship.update({ where: { userAId_userBId: { userAId: pendingA, userBId: pendingB } }, data: { status: "ACCEPTED" } });
  await db.user.update({ where: { id: c.id }, data: { status: "SUSPENDED" } });
  assert.equal((await call("/me", a.token)).body.profile.counts.friends, 1);
  await db.block.create({ data: { blockerId: a.id, blockedId: b.id } });
  assert.equal((await call("/me", a.token)).body.profile.counts.friends, 0);
  assert.equal((await call(`/users/${a.id}`, b.token)).status, 404);
  assert.equal((await call(`/users/${b.id}`, a.token)).status, 404);
  await db.block.deleteMany({ where: { blockerId: a.id, blockedId: b.id } });
  await db.block.create({ data: { blockerId: b.id, blockedId: a.id } });
  assert.equal((await call(`/users/${a.id}`, b.token)).status, 404);
  assert.equal((await call(`/users/${b.id}`, a.token)).status, 404);
});

test("bulunamayan, askıya alınmış ve silinmiş hedefler aynı 404 yanıtını verir", async () => {
  const [a, b] = accounts;
  const nonexistent = await call(`/users/${randomUUID()}`, a.token);
  assert.equal(nonexistent.status, 404);
  for (const status of ["SUSPENDED", "DELETED"] as const) {
    await db.user.update({ where: { id: b.id }, data: { status } });
    const hidden = await call(`/users/${b.id}`, a.token);
    assert.equal(hidden.status, 404);
    assert.equal(hidden.body.error.code, nonexistent.body.error.code);
    assert.equal(hidden.body.error.message, nonexistent.body.error.message);
    assert.ok([401, 403].includes((await call("/me", b.token)).status));
  }
  assert.equal((await call("/users/not-a-uuid", a.token)).status, 400);
});

test("OpenAPI profil/özel alan/ayar sözleşmelerini ve Bearer gereksinimini içerir", async () => {
  const { body: spec } = await call("/openapi.json");
  for (const path of ["/v1/me", "/v1/me/private", "/v1/me/settings", "/v1/users/{id}", "/v1/style-tags", "/v1/users/username-availability"]) {
    assert.ok(spec.paths[path].get.security.some((security: any) => "bearer" in security), path);
    assert.ok(spec.paths[path].get.responses[200].content["application/json"].schema);
  }
  assert.equal(spec.components.schemas.UpdateProfileDto.properties.bio.nullable, true);
  assert.equal(spec.components.schemas.UpdatePrivateProfileDto.properties.gender.nullable, true);
  assert.ok(!("gender" in spec.components.schemas.PublicProfileResponseDto.properties));
  assert.ok(!("userId" in spec.components.schemas.UpdateSettingsDto.properties));
  assert.equal(spec.paths["/v1/me"].patch.requestBody.content["application/json"].schema.$ref, "#/components/schemas/UpdateProfileDto");
  assert.ok(spec.paths["/v1/users/{id}"].get.parameters.some((param: any) => param.in === "path" && param.name === "id" && param.required));
});
