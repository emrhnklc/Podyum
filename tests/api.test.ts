import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { readEnvironment } from "../src/common/config/environment.js";
import { decodeCursor, encodeCursor } from "../src/common/pagination/cursor.js";
import { PageQueryDto } from "../src/common/pagination/page-query.dto.js";
import { validationPipe } from "../src/common/http/validation.js";

// HTTP testleri derlenmiş Nest kodunu kullanır: DTO decorator metadata'sı gerçek bootstrap ile aynıdır.
const appPath = new URL("../dist/create-app.js", import.meta.url).href;
const prismaPath = new URL("../dist/database/prisma.service.js", import.meta.url).href;
const { createApp } = await import(appPath) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(prismaPath);
let app: NestExpressApplication;
let db: PrismaClient;
let base: string;
let mailbox: string;
let marker: string;
const originalEnv = { ...process.env };
const password = "Test için uzun şifre 123!";

beforeEach(async () => {
  marker = `t_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  mailbox = await mkdtemp(join(tmpdir(), "kombin-auth-"));
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  process.env.LOCAL_MAILBOX_DIR = mailbox;
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
});

afterEach(async () => {
  try {
    if (db) {
      const users = await db.user.findMany({ where: { OR: [
        { username: { startsWith: marker } },
        { identities: { some: { issuer: { startsWith: "mock:" }, subject: { startsWith: marker } } } },
      ] }, select: { id: true } });
      const ids = users.map((user) => user.id);
      await db.$transaction(async (tx) => {
        await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
        await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
        await tx.authActionToken.deleteMany({ where: { userId: { in: ids } } });
        await tx.authCredential.deleteMany({ where: { userId: { in: ids } } });
        await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      });
    }
  } finally {
    await app?.close();
    if (mailbox) await rm(mailbox, { recursive: true, force: true });
    for (const key of ["NODE_ENV", "AUTH_MOCK_ENABLED", "LOCAL_MAILBOX_DIR"]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

async function call(path: string, body?: unknown, access?: string) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, headers: response.headers, body: await response.json() as any };
}

async function action(kind: "VERIFY_EMAIL" | "RESET_PASSWORD") {
  const messages = await Promise.all((await readdir(mailbox)).map(async (name) => JSON.parse(await readFile(join(mailbox, name), "utf8"))));
  const mail = messages.filter((item) => item.email === `${marker}@example.com` && item.kind === kind).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  assert.ok(mail, "Yerel posta kutusunda mesaj bekleniyordu.");
  return mail.token as string;
}

async function register(verify = true) {
  const email = `${marker}@example.com`;
  assert.equal((await call("/auth/register", { email, password, username: marker, displayName: "Test Kullanıcı" })).status, 202);
  if (verify) assert.equal((await call("/auth/email-verification/confirm", { token: await action("VERIFY_EMAIL") })).status, 200);
  return email;
}

async function login(email: string, currentPassword = password) {
  const result = await call("/auth/login", { email, password: currentPassword });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

test("ortak HTTP: request ID, cache, hatalar, JSON ve boyut sınırı", async () => {
  const health = await call("/health/live");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.match(health.headers.get("x-request-id")!, /^[a-f0-9-]{36}$/);
  const missing = await call("/unknown");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "RESOURCE_NOT_FOUND");
  assert.equal(missing.body.error.requestId, missing.headers.get("x-request-id"));
  const malformed = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json() as any).error.code, "VALIDATION_ERROR");
  const huge = await call("/auth/login", { password: "a".repeat(70_000) });
  assert.equal(huge.status, 413);
  assert.equal(huge.body.error.code, "PAYLOAD_TOO_LARGE");
});

test("DTO doğrulama bilinmeyen alanları ve kısa şifreleri reddeder; gizli değeri geri döndürmez", async () => {
  const result = await call("/auth/register", { email: "bad", password: "secret", username: "..", displayName: " ", userId: randomUUID() });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "VALIDATION_ERROR");
  assert.ok(result.body.error.fields.some((field: any) => field.field === "userId"));
  assert.equal(JSON.stringify(result.body).includes("secret"), false);
  assert.equal(await db.authCredential.count({ where: { email: "bad" } }), 0);
});

test("kayıt → doğrulama → giriş → korumalı kimlik; hash ve tekil kullanıcı", async () => {
  const email = await register(false);
  assert.equal((await call("/auth/me")).status, 401);
  const unverified = await call("/auth/login", { email, password });
  assert.equal(unverified.status, 403);
  assert.equal(unverified.body.error.code, "EMAIL_NOT_VERIFIED");
  const token = await action("VERIFY_EMAIL");
  assert.equal((await call("/auth/email-verification/confirm", { token })).status, 200);
  assert.equal((await call("/auth/email-verification/confirm", { token })).status, 400);
  const session = await login(email.toUpperCase());
  const me = await call("/auth/me", undefined, session.accessToken);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, marker);
  assert.equal(me.body.session.mock, false);
  assert.equal(me.body.user.credential, undefined);
  const stored = await db.authCredential.findUniqueOrThrow({ where: { email } });
  assert.notEqual(stored.passwordHash, password);
  const storedSession = await db.authSession.findUniqueOrThrow({ where: { id: session.sessionId } });
  assert.notEqual(storedSession.accessTokenHash, session.accessToken);
  assert.equal((await call("/auth/register", { email, password, username: marker, displayName: "Başka" })).status, 202);
  assert.equal(await db.authCredential.count({ where: { email } }), 1);
  const badPassword = await call("/auth/login", { email, password: "Yanlış ama yeterince uzun" });
  assert.equal(badPassword.status, 401);
  assert.equal(badPassword.body.error.code, "INVALID_CREDENTIALS");
});

test("refresh dönüşümü eski access token'ı kapatır; tekrar kullanılan refresh oturumu iptal eder", async () => {
  const original = await login(await register());
  const rotated = await call("/auth/refresh", { refreshToken: original.refreshToken });
  assert.equal(rotated.status, 200);
  assert.notEqual(rotated.body.refreshToken, original.refreshToken);
  assert.equal((await call("/auth/me", undefined, original.accessToken)).status, 401);
  assert.equal((await call("/auth/me", undefined, rotated.body.accessToken)).status, 200);
  assert.equal((await call("/auth/refresh", { refreshToken: original.refreshToken })).status, 401);
  assert.equal((await call("/auth/me", undefined, rotated.body.accessToken)).status, 401);
  assert.equal((await call("/auth/refresh", { refreshToken: rotated.body.refreshToken })).status, 401);
});

test("çıkış tek cihazı; tümünden çıkış bütün cihazları kapatır", async () => {
  const email = await register();
  const first = await login(email);
  const second = await login(email);
  assert.equal((await call("/auth/logout", {}, first.accessToken)).status, 200);
  assert.equal((await call("/auth/me", undefined, first.accessToken)).status, 401);
  assert.equal((await call("/auth/me", undefined, second.accessToken)).status, 200);
  const third = await login(email);
  assert.equal((await call("/auth/logout-all", {}, second.accessToken)).status, 200);
  assert.equal((await call("/auth/me", undefined, third.accessToken)).status, 401);
});

test("şifre sıfırlama tek kullanımlıktır ve bütün oturumları kapatır", async () => {
  const email = await register();
  const session = await login(email);
  const known = await call("/auth/password-reset/request", { email });
  const unknown = await call("/auth/password-reset/request", { email: "absent@example.com" });
  assert.equal(known.status, 202);
  assert.deepEqual(known.body, unknown.body);
  const token = await action("RESET_PASSWORD");
  const newPassword = "Yeni ve uzun test şifresi 456!";
  assert.equal((await call("/auth/password-reset/confirm", { token, password: newPassword })).status, 200);
  assert.equal((await call("/auth/me", undefined, session.accessToken)).status, 401);
  assert.equal((await call("/auth/password-reset/confirm", { token, password: newPassword })).status, 400);
  assert.equal((await call("/auth/login", { email, password })).status, 401);
  await login(email, newPassword);
});

test("süresi dolan action/access token ve askıya alınan hesap reddedilir", async () => {
  const email = await register(false);
  const token = await action("VERIFY_EMAIL");
  const user = await db.user.findUniqueOrThrow({ where: { username: marker } });
  await db.authActionToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
  assert.equal((await call("/auth/email-verification/confirm", { token })).status, 400);
  assert.equal((await call("/auth/email-verification/request", { email })).status, 202);
  assert.equal((await call("/auth/email-verification/confirm", { token: await action("VERIFY_EMAIL") })).status, 200);
  const session = await login(email);
  await db.authSession.update({ where: { id: session.sessionId }, data: { accessExpiresAt: new Date(0) } });
  assert.equal((await call("/auth/me", undefined, session.accessToken)).status, 401);
  const second = await login(email);
  await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
  assert.equal((await call("/auth/me", undefined, second.accessToken)).status, 403);
  assert.equal((await call("/auth/refresh", { refreshToken: second.refreshToken })).status, 403);
  assert.equal((await call("/auth/login", { email, password })).status, 403);
  await db.user.update({ where: { id: user.id }, data: { status: "DELETED" } });
  assert.equal((await call("/auth/me", undefined, second.accessToken)).status, 401);
  assert.equal((await call("/auth/refresh", { refreshToken: second.refreshToken })).status, 401);
});

test("Google/Apple mock kimlikleri tekildir, birbirinden ayrıdır ve kapatılınca kullanılamaz", async () => {
  const first = await call("/auth/mock", { provider: "google", subject: marker, acknowledgeMock: true });
  assert.equal(first.status, 200);
  assert.equal(first.body.mock, true);
  const repeated = await call("/auth/mock", { provider: "google", subject: marker, acknowledgeMock: true });
  const apple = await call("/auth/mock", { provider: "apple", subject: marker, acknowledgeMock: true });
  assert.equal(repeated.status, 200);
  assert.equal(apple.status, 200);
  const firstMe = await call("/auth/me", undefined, first.body.accessToken);
  const repeatMe = await call("/auth/me", undefined, repeated.body.accessToken);
  const appleMe = await call("/auth/me", undefined, apple.body.accessToken);
  assert.equal(firstMe.body.user.id, repeatMe.body.user.id);
  assert.notEqual(firstMe.body.user.id, appleMe.body.user.id);
  assert.equal(firstMe.body.profileSetupRequired, true);
  process.env.AUTH_MOCK_ENABLED = "false";
  assert.equal((await call("/auth/providers")).body.google.mode, "unconfigured");
  assert.equal((await call("/auth/mock", { provider: "google", subject: marker, acknowledgeMock: true })).status, 404);
  assert.equal((await call("/auth/me", undefined, first.body.accessToken)).status, 401);
  assert.equal((await call("/auth/refresh", { refreshToken: first.body.refreshToken })).status, 401);
});

test("OpenAPI çalışan endpoint'leri, DTO'ları ve Bearer güvenliğini içerir", async () => {
  const spec = await call("/openapi.json");
  assert.equal(spec.status, 200);
  assert.ok(spec.body.paths["/v1/auth/register"]);
  assert.ok(spec.body.paths["/v1/health/ready"]);
  assert.equal(spec.body.paths["/v1/auth/me"].get.security[0].bearer.length, 0);
  assert.ok(spec.body.components.schemas.RegisterDto.properties.password);
  assert.ok(spec.body.components.schemas.SessionResponseDto.properties.refreshToken);
  assert.ok(spec.body.paths["/v1/auth/login"].post.responses["200"].content["application/json"].schema);
  assert.ok(spec.body.paths["/v1/auth/login"].post.responses["400"].content["application/json"].schema);
});

test("posta yazılamıyorsa kayıt geri alınır; iç hata ayrıntısı HTTP'de açılmaz", async () => {
  const blockedPath = join(mailbox, "not-a-directory");
  await writeFile(blockedPath, "test");
  process.env.LOCAL_MAILBOX_DIR = blockedPath;
  const email = `${marker}@example.com`;
  const result = await call("/auth/register", { email, password, username: marker, displayName: "Test" });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(result.body).includes(blockedPath), false);
  assert.equal(await db.authCredential.count({ where: { email } }), 0);
  assert.equal(await db.user.count({ where: { username: marker } }), 0);
});

test("sayfalama limiti yalnızca 1–50 tamsayı kabul eder; null ve ek alanlar reddedilir", async () => {
  const pipe = validationPipe();
  const metadata = { type: "query" as const, metatype: PageQueryDto };
  assert.equal((await pipe.transform({}, metadata)).limit, 20);
  assert.equal((await pipe.transform({ limit: "50" }, metadata)).limit, 50);
  for (const value of ["0", "51", "1.5", "1e1", "", null, ["1", "2"]]) {
    await assert.rejects(pipe.transform({ limit: value }, metadata));
  }
  await assert.rejects(pipe.transform({ cursor: null }, metadata));
  await assert.rejects(pipe.transform({ ownerId: randomUUID() }, metadata));
});

test("giriş isteği sınırı HTTP 429 ve Retry-After döndürür", async () => {
  for (let i = 0; i < 30; i++) assert.equal((await call("/auth/providers")).status, 200);
  const rejected = await call("/auth/providers");
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.error.code, "RATE_LIMITED");
  assert.ok(Number(rejected.headers.get("retry-after")) > 0);
});

test("cursor filtreyle doğrulanır; bozuk imleç ve yanlış ortam ayarı reddedilir", () => {
  const position = { id: randomUUID(), createdAt: new Date().toISOString() };
  const cursor = encodeCursor(position, { scope: "friends", viewer: marker });
  assert.deepEqual(decodeCursor(cursor, { viewer: marker, scope: "friends" }), position);
  assert.throws(() => decodeCursor(cursor, { scope: "everyone", viewer: marker }));
  assert.throws(() => decodeCursor("broken", {}));
  assert.throws(() => readEnvironment({ ...process.env, PORT: "1.5" }));
  assert.throws(() => readEnvironment({ ...process.env, NODE_ENV: "production", AUTH_MOCK_ENABLED: "true" }));
  assert.throws(() => readEnvironment({ ...process.env, CORS_ORIGINS: "*" }));
});
