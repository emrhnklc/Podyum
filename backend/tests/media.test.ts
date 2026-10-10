import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, access as fileAccess } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { ImageProcessor as Processor } from "../src/modules/media/image-processor.service.js";
import type { MediaService as Media } from "../src/modules/media/media.service.js";

const { createApp } = await import(new URL("../dist/create-app.js", import.meta.url).href) as { createApp: () => Promise<NestExpressApplication> };
const { PrismaService } = await import(new URL("../dist/database/prisma.service.js", import.meta.url).href);
const { MediaService } = await import(new URL("../dist/modules/media/media.service.js", import.meta.url).href);
const { ImageProcessor } = await import(new URL("../dist/modules/media/image-processor.service.js", import.meta.url).href);
const { LocalMediaStorage } = await import(new URL("../dist/modules/media/local-media-storage.service.js", import.meta.url).href);
type Account = { id: string; token: string };
let app: NestExpressApplication;
let db: PrismaClient;
let media: Media;
let processor: Processor;
let base: string;
let marker: string;
let directory: string;
let accounts: Account[];
const originalEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_MOCK_ENABLED: process.env.AUTH_MOCK_ENABLED, LOCAL_MEDIA_DIR: process.env.LOCAL_MEDIA_DIR };
const png = await sharp({ create: { width: 128, height: 96, channels: 3, background: "#fa6080" } }).withMetadata({ orientation: 6 }).png().toBuffer();

async function call(method: string, path: string, actor: Account | null = accounts[0], body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, body: await response.json() as any };
}

async function grant(source = png, options: Record<string, unknown> = {}, actor = accounts[0]) {
  const result = await call("POST", "/media/uploads", actor, { purpose: "POLL", mimeType: "image/png", byteSize: source.length, blurRequested: false, ...options });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body as any;
}

async function upload(g: any, source = png, actor = accounts[0], mime = "image/png", token = g.upload.token, field = "file") {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(source)], { type: mime }), "../../untrusted.png");
  const response = await fetch(`${base.replace(/\/v1$/, "")}${g.upload.path}`, { method: "POST", headers: { Authorization: `Bearer ${actor.token}`, "X-Upload-Token": token }, body: form, signal: AbortSignal.timeout(20_000) });
  return { status: response.status, body: await response.json() as any };
}

async function ready(options: Record<string, unknown> = {}, actor = accounts[0]) {
  const g = await grant(png, options, actor);
  assert.equal((await upload(g, png, actor)).status, 200);
  assert.equal((await call("POST", `/media/${g.asset.id}/complete`, actor, {})).status, 200);
  assert.equal((await call("POST", `/media/${g.asset.id}/accept-preview`, actor, { confirmed: true })).status, 200);
  return g.asset.id as string;
}

async function content(id: string, actor: Account | null = accounts[0], query = "") {
  return fetch(`${base}/media/${id}/content${query}`, { headers: actor ? { Authorization: `Bearer ${actor.token}` } : {}, signal: AbortSignal.timeout(10_000) });
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_MOCK_ENABLED = "true";
  directory = await mkdtemp(join(tmpdir(), "podyum-media-"));
  process.env.LOCAL_MEDIA_DIR = directory;
  marker = `m_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  accounts = [];
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `${await app.getUrl()}/v1`;
  db = app.get(PrismaService);
  media = app.get(MediaService);
  processor = app.get(ImageProcessor);
  for (let i = 0; i < 3; i++) {
    const session = await call("POST", "/auth/mock", null, { provider: "google", subject: `${marker}_${i}`, acknowledgeMock: true });
    assert.equal(session.status, 200);
    const actor = { id: "", token: session.body.accessToken };
    actor.id = (await call("GET", "/auth/me", actor)).body.user.id;
    accounts.push(actor);
  }
});

afterEach(async () => {
  try {
    if (db) {
      const ids = accounts.map(({ id }) => id);
      await db.$transaction(async (tx) => {
        await tx.user.updateMany({ where: { id: { in: ids } }, data: { avatarMediaId: null } });
        await tx.pollOption.deleteMany({ where: { poll: { authorId: { in: ids } } } });
        await tx.poll.deleteMany({ where: { authorId: { in: ids } } });
        await tx.mediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
        await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
        await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
        await tx.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
        await tx.userSettings.deleteMany({ where: { userId: { in: ids } } });
        await tx.usedRefreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
        await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
        await tx.authIdentity.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      });
    }
  } finally {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
    for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
  }
});

test("medya/avatarda oturum ve katı DTO doğrulaması; orijinal dosyaya HTTP yolu yok", async () => {
  const id = randomUUID();
  for (const [method, path] of [["POST", "/media/uploads"], ["POST", `/media/${id}/upload`], ["POST", `/media/${id}/complete`], ["POST", `/media/${id}/accept-preview`], ["GET", `/media/${id}`], ["DELETE", `/media/${id}`], ["PUT", "/me/avatar"], ["DELETE", "/me/avatar"]]) {
    assert.equal((await call(method, path, null)).status, 401, path);
  }
  assert.equal((await content(id, null)).status, 401);
  for (const body of [{}, { purpose: "POLL", mimeType: "image/svg+xml", byteSize: 1 }, { purpose: "POLL", mimeType: "image/png", byteSize: 10_485_761 }, { purpose: "POLL", mimeType: "image/png", byteSize: 1, blurRequested: null }, { purpose: "POLL", mimeType: "image/png", byteSize: 1, ownerId: accounts[1].id }]) {
    assert.equal((await call("POST", "/media/uploads", accounts[0], body)).status, 400);
  }
  assert.equal((await call("GET", "/media/not-a-uuid")).status, 400);
  assert.equal((await content(id, accounts[0], "?variant=source")).status, 400);
  assert.equal((await call("PUT", "/me/avatar", accounts[0], { mediaId: null })).status, 400);
  const g = await grant();
  assert.equal((await call("POST", `/media/${g.asset.id}/accept-preview`, accounts[0], { confirmed: false })).status, 400);
  assert.equal((await call("POST", `/media/${g.asset.id}/complete`, accounts[0], { blurRegions: [{ x: 0, y: 0, width: 1, height: 1, admin: true }] })).status, 400);
  assert.equal((await call("GET", `/media/${g.asset.id}/source`)).status, 404);
});

test("izin → tek dosya → doğrulama → EXIF'siz WebP/thumbnail → onay; READY değişmez", async () => {
  const g = await grant();
  const id = g.asset.id;
  const saved = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  assert.notEqual(saved.uploadTokenHash, g.upload.token);
  assert.equal(saved.uploadTokenHash?.length, 64);
  assert.equal(g.asset.uploadKey, undefined);
  assert.equal((await call("POST", `/media/${id}/complete`, accounts[0], {})).body.error.code, "UPLOAD_REQUIRED");
  assert.equal((await upload(g)).status, 200);
  assert.equal((await upload(g)).body.error.code, "MEDIA_IMMUTABLE");
  assert.equal((await call("POST", `/media/${id}/accept-preview`, accounts[0], { confirmed: true })).body.error.code, "MEDIA_NOT_READY");
  const completed = await call("POST", `/media/${id}/complete`, accounts[0], {});
  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "READY");
  assert.equal(completed.body.previewAcceptedAt, null);
  assert.deepEqual([completed.body.width, completed.body.height], [96, 128]);
  for (const query of ["", "?variant=thumbnail"]) {
    const response = await content(id, accounts[0], query);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.orientation, undefined);
  }
  assert.equal((await content(id, accounts[1])).status, 404);
  const retry = await call("POST", `/media/${id}/complete`, accounts[0], {});
  assert.deepEqual(retry.body, completed.body);
  assert.equal((await call("POST", `/media/${id}/complete`, accounts[0], { confirmNoFaces: true })).status, 409);
  const approved = await call("POST", `/media/${id}/accept-preview`, accounts[0], { confirmed: true });
  assert.ok(approved.body.previewAcceptedAt);
  assert.deepEqual((await call("POST", `/media/${id}/accept-preview`, accounts[0], { confirmed: true })).body, approved.body);
  await db.$transaction((tx) => media.requirePublishableAsset(tx, accounts[0].id, id));
});

test("izin sahibi/token/süre/dosya beyanı denetlenir; hatalı yükleme başka dosyanın üzerine yazmaz", async () => {
  const g = await grant();
  assert.equal((await upload(g, png, accounts[1])).status, 404);
  assert.equal((await upload(g, png, accounts[0], "image/png", "invalid")).status, 403);
  assert.equal((await upload(g, png, accounts[0], "image/jpeg")).body.error.code, "UPLOAD_METADATA_MISMATCH");
  assert.equal((await upload(g, png.subarray(1))).body.error.code, "UPLOAD_METADATA_MISMATCH");
  assert.equal((await upload(g, png, accounts[0], "image/png", g.upload.token, "wrong")).status, 400);
  assert.equal((await upload(g, Buffer.alloc(10_485_761))).status, 413);
  const row = await db.mediaAsset.findUniqueOrThrow({ where: { id: g.asset.id } });
  assert.equal(row.sourceVersion, null);
  await assert.rejects(fileAccess(join(directory, row.uploadKey)));
  await db.mediaAsset.update({ where: { id: row.id }, data: { uploadExpiresAt: new Date(0) } });
  assert.equal((await upload(g)).body.error.code, "UPLOAD_EXPIRED");
});

test("sahte MIME, bozuk dosya, aşırı boyut ve animasyon READY olmaz; orijinal açılmaz", async () => {
  const jpeg = await sharp(png).jpeg().toBuffer();
  const wide = await sharp({ create: { width: 10_001, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  const overPixels = await sharp({ create: { width: 10_000, height: 2501, channels: 3, background: "red" } }).png().toBuffer();
  const animatedWebp = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), { raw: { width: 1, height: 2, channels: 3, pageHeight: 1 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  // İki kareli GIF bile PNG diye beyan edilse gerçek format kontrolünden geçemez.
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  for (const [source, mime] of [[jpeg, "image/png"], [Buffer.from("<script>alert(1)</script>"), "image/png"], [wide, "image/png"], [overPixels, "image/png"], [gif, "image/png"], [animatedWebp, "image/webp"]] as const) {
    const g = await grant(source, { mimeType: mime });
    assert.equal((await upload(g, source, accounts[0], mime)).status, 200);
    const result = await call("POST", `/media/${g.asset.id}/complete`, accounts[0], {});
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, "INVALID_IMAGE");
    assert.equal((await call("GET", `/media/${g.asset.id}`)).body.status, "REJECTED");
    assert.equal((await content(g.asset.id)).status, 404);
    await assert.rejects(db.$transaction((tx) => media.requirePublishableAsset(tx, accounts[0].id, g.asset.id)));
  }
});

test("tek kareli JPEG ve WebP de gerçekten decode edilerek WebP'ye dönüştürülür", async () => {
  for (const [source, mime] of [[await sharp(png).jpeg().toBuffer(), "image/jpeg"], [await sharp(png).webp().toBuffer(), "image/webp"]] as const) {
    const g = await grant(source, { mimeType: mime });
    assert.equal((await upload(g, source, accounts[0], mime)).status, 200);
    assert.equal((await call("POST", `/media/${g.asset.id}/complete`, accounts[0], {})).body.status, "READY");
    assert.equal((await content(g.asset.id)).headers.get("content-type"), "image/webp");
  }
});

test("blur varsayılanı uygulanır; bölge/onay olmadan açılmaz; thumbnail da maskelenmiş görüntüden gelir", async () => {
  const pixels = Buffer.alloc(128 * 96 * 3);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) {
    const value = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 255 : 0;
    pixels.fill(value, (y * 128 + x) * 3, (y * 128 + x) * 3 + 3);
  }
  const pattern = await sharp(pixels, { raw: { width: 128, height: 96, channels: 3 } }).png().toBuffer();
  const result = await call("POST", "/media/uploads", accounts[0], { purpose: "POLL", mimeType: "image/png", byteSize: pattern.length });
  const g = result.body;
  assert.equal(g.asset.blurRequested, true);
  assert.equal((await upload(g, pattern)).status, 200);
  assert.equal((await call("POST", `/media/${g.asset.id}/complete`, accounts[0], {})).body.error.code, "BLUR_REGIONS_REQUIRED");
  assert.equal((await call("POST", `/media/${g.asset.id}/complete`, accounts[0], { blurRegions: [{ x: 0.9, y: 0, width: 0.2, height: 1 }] })).body.error.code, "INVALID_BLUR_REGION");
  assert.equal((await call("GET", `/media/${g.asset.id}`)).body.status, "PENDING_UPLOAD");
  const completed = await call("POST", `/media/${g.asset.id}/complete`, accounts[0], { blurRegions: [{ x: 0, y: 0, width: 0.75, height: 1 }, { x: 0.25, y: 0, width: 0.75, height: 1 }] });
  assert.equal(completed.status, 200);
  for (const query of ["", "?variant=thumbnail"]) {
    const buffer = Buffer.from(await (await content(g.asset.id, accounts[0], query)).arrayBuffer());
    const stats = await sharp(buffer).stats();
    const originalStats = await sharp(pattern).stats();
    assert.ok(stats.channels[0].stdev < originalStats.channels[0].stdev * 0.15, `Maskede desen kontrastı belirgin azalmalı: ${stats.channels[0].stdev}`);
  }
  assert.equal((await call("POST", `/media/${g.asset.id}/accept-preview`, accounts[0], {})).status, 400);
  const noFaces = await grant(png, { blurRequested: true });
  await upload(noFaces);
  assert.equal((await call("POST", `/media/${noFaces.asset.id}/complete`, accounts[0], { confirmNoFaces: true })).status, 200);
  await call("PATCH", "/me/settings", accounts[0], { defaultBlurFace: false });
  const preference = await call("POST", "/media/uploads", accounts[0], { purpose: "POLL", mimeType: "image/png", byteSize: png.length });
  assert.equal(preference.body.asset.blurRequested, false);
});

test("AVATAR yalnız kendi onaylı medya kaydından bağlanır; değişince eski avatar başkasına kapanır", async () => {
  const g = await grant(png, { purpose: "AVATAR" });
  await upload(g);
  await call("POST", `/media/${g.asset.id}/complete`, accounts[0], {});
  assert.equal((await call("PUT", "/me/avatar", accounts[0], { mediaId: g.asset.id })).body.error.code, "MEDIA_NOT_APPROVED");
  await call("POST", `/media/${g.asset.id}/accept-preview`, accounts[0], { confirmed: true });
  assert.equal((await call("PUT", "/me/avatar", accounts[1], { mediaId: g.asset.id })).status, 404);
  assert.equal((await call("PUT", "/me/avatar", accounts[0], { mediaId: g.asset.id })).status, 200);
  assert.equal((await call("GET", "/me")).body.profile.avatarMediaId, g.asset.id);
  assert.equal((await call("GET", `/users/${accounts[0].id}`, accounts[1])).body.avatarPath, `/v1/media/${g.asset.id}/content`);
  assert.equal((await content(g.asset.id, accounts[1])).status, 200);
  assert.equal((await call("DELETE", `/media/${g.asset.id}`)).body.error.code, "MEDIA_IN_USE");
  const pollPhoto = await ready();
  assert.equal((await call("PUT", "/me/avatar", accounts[0], { mediaId: pollPhoto })).body.error.code, "MEDIA_PURPOSE_MISMATCH");
  const replacement = await ready({ purpose: "AVATAR" });
  await call("PUT", "/me/avatar", accounts[0], { mediaId: replacement });
  assert.equal((await content(g.asset.id, accounts[1])).status, 404);
  await call("PUT", `/blocks/${accounts[0].id}`, accounts[1]);
  assert.equal((await content(replacement, accounts[1])).status, 404);
  assert.equal((await call("DELETE", "/me/avatar")).status, 200);
  assert.equal((await call("GET", "/me")).body.profile.avatarPath, null);
});

test("FRIENDS görselleri mevcut arkadaşlığa bağlı; engel, iptal ve moderasyon içerik adresini de kapatır", async () => {
  const id = await ready();
  const now = new Date();
  const poll = await db.poll.create({ data: { authorId: accounts[0].id, question: marker, category: "OUTFIT", status: "OPEN", visibility: "FRIENDS", publishedAt: now, closesAt: new Date(now.getTime() + 1_800_000), options: { create: { position: 1, mediaId: id } } } });
  assert.equal((await content(id, accounts[1])).status, 404);
  await call("POST", "/friend-requests", accounts[0], { targetUserId: accounts[1].id });
  await call("POST", `/friend-requests/${accounts[0].id}/accept`, accounts[1]);
  assert.equal((await content(id, accounts[1])).status, 200);
  assert.equal((await content(id, accounts[2])).status, 404);
  assert.equal((await call("GET", `/media/${id}`, accounts[1])).status, 404);
  assert.equal((await call("DELETE", `/friends/${accounts[0].id}`, accounts[1])).status, 200);
  assert.equal((await content(id, accounts[1])).status, 404);
  await db.poll.update({ where: { id: poll.id }, data: { visibility: "PUBLIC", status: "CLOSED" } });
  assert.equal((await content(id, accounts[2])).status, 200);
  await call("PUT", `/blocks/${accounts[0].id}`, accounts[2]);
  assert.equal((await content(id, accounts[2])).status, 404);
  for (const data of [{ status: "CANCELLED" as const }, { status: "OPEN" as const, contentStatus: "HIDDEN" as const }, { contentStatus: "REMOVED" as const }]) {
    await db.poll.update({ where: { id: poll.id }, data });
    assert.equal((await content(id, accounts[1])).status, 404);
  }
  assert.equal((await call("DELETE", `/media/${id}`)).body.error.code, "MEDIA_IN_USE");
});

test("işleme/disk hatası REJECTED olur, kısmi dosya açılmaz ve aynı kaynakla tekrar denenebilir", async () => {
  const g = await grant();
  await upload(g);
  const storage = app.get(LocalMediaStorage);
  const originalWrite = storage.write.bind(storage);
  storage.write = async (key: string, buffer: Buffer) => {
    if (key.includes("thumbnail-")) throw new Error("test disk failure");
    return originalWrite(key, buffer);
  };
  try {
    const result = await call("POST", `/media/${g.asset.id}/complete`, accounts[0], {});
    assert.equal(result.status, 503);
    assert.equal((await call("GET", `/media/${g.asset.id}`)).body.rejectionCode, "MEDIA_PROCESSING_FAILED");
    assert.equal((await content(g.asset.id)).status, 404);
  } finally { storage.write = originalWrite; }
  assert.equal((await call("POST", `/media/${g.asset.id}/complete`, accounts[0], {})).body.status, "READY");
});

test("PROCESSING tekrarları yeni iş başlatmaz; geç biten iş silinen kaydı canlandıramaz; kapasite sınırlıdır", async () => {
  const grants = [await grant(), await grant(), await grant()];
  for (const g of grants) await upload(g);
  const original = processor.process.bind(processor);
  let running = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  processor.process = async (...args: Parameters<Processor["process"]>) => { running++; await gate; return original(...args); };
  const first = call("POST", `/media/${grants[0].asset.id}/complete`, accounts[0], {});
  let second: ReturnType<typeof call> | undefined;
  try {
    for (let i = 0; running < 1 && i < 200; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(running, 1);
    assert.equal((await call("POST", `/media/${grants[0].asset.id}/complete`, accounts[0], {})).body.status, "PROCESSING");
    second = call("POST", `/media/${grants[1].asset.id}/complete`, accounts[0], {});
    for (let i = 0; running < 2 && i < 200; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(running, 2);
    assert.equal((await call("POST", `/media/${grants[2].asset.id}/complete`, accounts[0], {})).body.error.code, "MEDIA_BUSY");
    assert.equal((await call("DELETE", `/media/${grants[0].asset.id}`)).status, 200);
  } finally {
    release();
    processor.process = original;
    const result = await first;
    assert.equal(result.status, 409);
    if (second) assert.equal((await second).status, 200);
  }
  assert.equal((await content(grants[0].asset.id)).status, 404);
  assert.equal((await db.mediaAsset.findUniqueOrThrow({ where: { id: grants[0].asset.id } })).status, "DELETED");
});

test("hesap başına bekleyen izin ve günlük yükleme kotası uygulanır", async () => {
  for (let i = 0; i < 20; i++) await grant();
  assert.equal((await call("POST", "/media/uploads", accounts[0], { purpose: "POLL", mimeType: "image/png", byteSize: png.length })).body.error.code, "MEDIA_QUOTA_EXCEEDED");
  await db.mediaAsset.updateMany({ where: { ownerId: accounts[0].id }, data: { status: "DELETED" } });
  await db.mediaAsset.createMany({ data: Array.from({ length: 80 }, () => ({ ownerId: accounts[0].id, status: "DELETED" as const, uploadKey: `${randomUUID()}/source.bin` })) });
  assert.equal((await call("POST", "/media/uploads", accounts[0], { purpose: "POLL", mimeType: "image/png", byteSize: png.length })).body.error.code, "MEDIA_QUOTA_EXCEEDED");
});

test("temizlik süresi dolan/boşta dosyaları siler; bağlı avatarı korur, takılan işlem tekrar denenebilir", async () => {
  const expired = await grant();
  const abandoned = await ready();
  const avatar = await ready({ purpose: "AVATAR" });
  await call("PUT", "/me/avatar", accounts[0], { mediaId: avatar });
  const retry = await grant();
  await upload(retry);
  const old = new Date(Date.now() - 25 * 3_600_000);
  await db.mediaAsset.updateMany({ where: { id: { in: [abandoned, avatar] } }, data: { createdAt: old } });
  await db.mediaAsset.update({ where: { id: expired.asset.id }, data: { uploadExpiresAt: new Date(0) } });
  await db.mediaAsset.update({ where: { id: retry.asset.id }, data: { status: "PROCESSING", updatedAt: new Date(Date.now() - 61 * 60_000) } });
  const result = await media.cleanup();
  assert.equal(result.timedOut, 1);
  assert.equal((await content(abandoned)).status, 404);
  assert.equal((await content(avatar, accounts[1])).status, 200);
  assert.equal((await call("GET", `/media/${expired.asset.id}`)).status, 404);
  assert.equal((await call("GET", `/media/${retry.asset.id}`)).body.rejectionCode, "PROCESSING_TIMEOUT");
  assert.equal((await call("POST", `/media/${retry.asset.id}/complete`, accounts[0], {})).body.status, "READY");
  assert.equal((await media.cleanup()).removed, 0);
  assert.equal((await call("DELETE", `/media/${abandoned}`)).status, 200);
});
