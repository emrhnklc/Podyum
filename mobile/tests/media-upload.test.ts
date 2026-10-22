import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadMedia } from "../src/features/profile/api/avatar";
import type { SessionManager } from "../src/features/auth/session-manager";
import { ApiError } from "../src/lib/api/client";

const bytes = new Uint8Array([255, 216, 255, 0, 128, 254]);
const photo = () => new Blob([bytes], { type: "image/jpeg" });
const uriFile = {
  uri: "file:///private/photo.jpg",
  name: "photo.jpg",
  type: "image/jpeg",
};
const encoder = () =>
  import(
    new URL(
      "../node_modules/expo/src/winter/fetch/convertFormData.ts",
      import.meta.url,
    ).href
  );
function fixture() {
  const calls: { path: string; body: unknown }[] = [];
  const client = {
    state: { session: { sessionId: "account-a" } },
    request: async (path: string, options: RequestInit) => {
      calls.push({ path, body: JSON.parse(String(options.body)) });
      return path === "/media/uploads"
        ? {
            asset: { id: "asset" },
            upload: { path: "/v1/media/asset/upload", token: "upload-token" },
          }
        : { id: "asset" };
    },
    response: async (path: string, options: RequestInit) => {
      calls.push({ path, body: options.body });
      assert.equal(
        new Headers(options.headers).get("X-Upload-Token"),
        "upload-token",
      );
      assert.equal(new Headers(options.headers).has("Content-Type"), false);
      return new Response("{}");
    },
  };
  return { client, calls, manager: client as unknown as SessionManager };
}
test("kurulu Expo kodlayıcısı eski native URI multipart'ını reddeder; Blob ile aynı baytlar kodlanır", async (t) => {
  const { convertFormDataAsync } = await encoder();
  await assert.rejects(
    convertFormDataAsync({ entries: () => [["file", uriFile]] }),
    /Unsupported FormDataPart implementation/,
  );
  t.mock.method(globalThis, "fetch", async () => new Response(photo()));
  const f = fixture();
  await uploadMedia(f.manager, uriFile, bytes.length, "image/jpeg", "POLL");
  const form = f.calls[1].body as FormData;
  assert.ok(form.get("file") instanceof Blob);
  const encoded = await convertFormDataAsync(form);
  assert.notEqual(Buffer.from(encoded.body).indexOf(Buffer.from(bytes)), -1);
  assert.match(Buffer.from(encoded.body).toString(), /filename="photo.jpg"/);
  assert.match(
    Buffer.from(encoded.body).toString(),
    /Content-Type: image\/jpeg/i,
  );
  assert.equal(f.calls.at(-1)?.path, "/media/asset/complete");
});
test("hazır Blob yeniden yerel dosyadan okunmaz; izin ve dosya metadata'sı aynı kalır", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Yeniden okunmamalı");
  });
  const f = fixture();
  await uploadMedia(f.manager, photo(), bytes.length, "image/jpeg", "POLL");
  assert.deepEqual(f.calls[0].body, {
    purpose: "POLL",
    mimeType: "image/jpeg",
    byteSize: bytes.length,
    blurRequested: false,
  });
  const form = f.calls[1].body as FormData;
  assert.equal((form.get("file") as File).size, bytes.length);
  assert.deepEqual(f.calls[2].body, {});
});
test("okunamayan yerel fotoğraf bağlantı hatası sayılmaz ve yükleme izni tüketmez", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Dosya yok");
  });
  const f = fixture();
  await assert.rejects(
    uploadMedia(f.manager, uriFile, bytes.length, "image/jpeg", "POLL"),
    (error: unknown) =>
      error instanceof ApiError && error.code === "LOCAL_IMAGE_READ_FAILED",
  );
  assert.deepEqual(f.calls, []);
});
test("dosya boyutu değişmişse yükleme başlamaz", async () => {
  const f = fixture();
  await assert.rejects(
    uploadMedia(f.manager, photo(), bytes.length + 1, "image/jpeg", "POLL"),
    (error: unknown) =>
      error instanceof ApiError && error.code === "LOCAL_IMAGE_CHANGED",
  );
  assert.deepEqual(f.calls, []);
});
test("fotoğraf okunurken hesap değişirse eski hesaptan izin veya dosya gönderilmez", async (t) => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => {
    f.client.state.session.sessionId = "account-b";
    return new Response(photo());
  });
  await assert.rejects(
    uploadMedia(f.manager, uriFile, bytes.length, "image/jpeg", "POLL"),
    (error: unknown) =>
      error instanceof ApiError && error.code === "INVALID_SESSION",
  );
  assert.deepEqual(f.calls, []);
});
for (const purpose of ["POLL", "AVATAR", "GAME"] as const) {
  test(`${purpose}: ortak yükleme Blob kullanır, yüz-yok onayı kendiliğinden verilmez`, async () => {
    const f = fixture();
    await uploadMedia(f.manager, photo(), bytes.length, "image/jpeg", purpose, {
      requested: true,
      confirmNoFaces: false,
    });
    assert.equal((f.calls[0].body as any).purpose, purpose);
    assert.deepEqual(f.calls[2].body, {});
    const approved = fixture();
    await uploadMedia(
      approved.manager,
      photo(),
      bytes.length,
      "image/jpeg",
      purpose,
      { requested: true, confirmNoFaces: true },
    );
    assert.deepEqual(approved.calls[2].body, { confirmNoFaces: true });
  });
}
test("işaretlenen yüz bölgeleri gönderilir; bölge varken yüz-yok onayı gitmez, blur kapalıyken bölge gitmez", async () => {
  const regions = [{ x: 0.1, y: 0.2, width: 0.25, height: 0.15 }];
  const marked = fixture();
  await uploadMedia(marked.manager, photo(), bytes.length, "image/jpeg", "POLL", {
    requested: true,
    confirmNoFaces: true,
    regions,
  });
  assert.deepEqual(marked.calls[2].body, { blurRegions: regions });
  const off = fixture();
  await uploadMedia(off.manager, photo(), bytes.length, "image/jpeg", "POLL", {
    requested: false,
    regions,
  });
  assert.equal((off.calls[0].body as any).blurRequested, false);
  assert.deepEqual(off.calls[2].body, {});
});
