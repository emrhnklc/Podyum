import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionManager } from "../src/features/auth/session-manager";
import { ApiError } from "../src/lib/api/client";
import type { Session } from "../src/features/auth/types";

const session = (token = "first", expired = false): Session => ({ accessToken: token, refreshToken: `refresh-${token}`, sessionId: "session", accessExpiresAt: new Date(Date.now() + (expired ? -1000 : 600000)).toISOString(), refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(), tokenType: "Bearer", mock: false });
const me = { user: { id: "viewer", username: "viewer", displayName: "Viewer", createdAt: new Date().toISOString() }, session: { id: "session", provider: "email", mock: false }, profileSetupRequired: false };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function storage(initial: Session | null) { let value = initial; return { read: async () => value, write: async (next: Session | null) => { value = next; }, value: () => value }; }

test("kayıtlı oturum doğrulanır; şifre değil token çifti saklanır", async () => {
  const disk = storage(null);
  const manager = new SessionManager(async (path) => json(path === "/auth/login" ? session() : me), disk);
  await manager.restore(); assert.equal(manager.state.ready, true); assert.equal(manager.state.me, null);
  await manager.login("viewer@example.com", "password");
  assert.equal(manager.state.me?.user.id, "viewer"); assert.equal(disk.value()?.accessToken, "first");
});
test("eşzamanlı süre dolmuş istekler aynı refresh sonucunu kullanır", async () => {
  let refreshes = 0;
  const gate = deferred<void>();
  const disk = storage(session("first", true));
  const manager = new SessionManager(async (path, options) => {
    if (path === "/auth/refresh") { refreshes++; await gate.promise; return json(session("next")); }
    if (path === "/auth/me") return json(me);
    assert.equal(options?.accessToken, "next"); return json({ ok: true });
  }, disk);
  manager.state = { ready: true, session: session("first", true), me, error: null };
  const requests = Array.from({ length: 6 }, () => manager.request("/feed"));
  gate.resolve(); await Promise.all(requests);
  assert.equal(refreshes, 1); assert.equal(disk.value()?.accessToken, "next");
});
test("geç gelen 401 zaten yenilenen token için ikinci refresh oluşturmaz", async () => {
  const late = deferred<void>(); let refreshes = 0, initialCalls = 0;
  const manager = new SessionManager(async (path, options) => {
    if (path === "/auth/refresh") { refreshes++; return json(session("next")); }
    if (options?.accessToken === "first") { if (++initialCalls === 2) await late.promise; throw new ApiError(401, "INVALID_SESSION", "expired"); }
    return json({ ok: true });
  }, storage(null));
  manager.state = { ready: true, session: session(), me, error: null };
  const first = manager.request("/feed"), second = manager.request("/feed");
  await first; late.resolve(); await second; assert.equal(refreshes, 1);
});
test("çıkış sırasında gelen refresh oturumu yeniden açamaz", async () => {
  const gate = deferred<Response>(); const disk = storage(session());
  const manager = new SessionManager(async (path) => path === "/auth/refresh" ? gate.promise : json({}), disk);
  manager.state = { ready: true, session: session("first", true), me, error: null };
  const request = manager.request("/feed");
  await manager.logout(false); gate.resolve(json(session("next")));
  await assert.rejects(request, (error: ApiError) => error.code === "SESSION_CHANGED");
  assert.equal(manager.state.session, null); assert.equal(disk.value(), null);
});
test("refresh ağ hatasında tek kullanımlık eski token tekrar gönderilmez", async () => {
  let refreshes = 0; const disk = storage(session());
  const manager = new SessionManager(async () => { refreshes++; throw new ApiError(0, "NETWORK_ERROR", "offline"); }, disk);
  manager.state = { ready: true, session: session("first", true), me, error: null };
  await assert.rejects(manager.request("/feed")); await assert.rejects(manager.request("/feed"));
  assert.equal(refreshes, 1); assert.equal(manager.state.me, null); assert.equal(disk.value(), null);
});
test("çıkıştan sonra tamamlanan eski hesap isteği reddedilir", async () => {
  const gate = deferred<Response>();
  const manager = new SessionManager(async () => gate.promise, storage(null));
  manager.state = { ready: true, session: session(), me, error: null };
  const request = manager.request("/feed"); await manager.logout(false); gate.resolve(json({ secret: "old-user" }));
  await assert.rejects(request, (error: ApiError) => error.code === "SESSION_CHANGED");
});
test("403 ve 409 iş kuralı hataları oturumu yenilemez", async () => {
  for (const status of [403, 409]) {
    let calls = 0;
    const manager = new SessionManager(async () => { calls++; throw new ApiError(status, "BUSINESS_RULE", "denied"); }, storage(null));
    manager.state = { ready: true, session: session(), me, error: null };
    await assert.rejects(manager.request("/polls/id/vote")); assert.equal(calls, 1); assert.ok(manager.state.me);
  }
});

test("header geldikten sonra yavaş JSON gövdesi eski hesabın verisini döndüremez", async () => {
  const gate = deferred<void>();
  const response = new Response("{}");
  response.json = async () => { await gate.promise; return { secret: "old-user" }; };
  const manager = new SessionManager(async () => response, storage(null));
  manager.state = { ready: true, session: session(), me, error: null };
  const request = manager.request("/feed");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await manager.logout(false); gate.resolve();
  await assert.rejects(request, (error: ApiError) => error.code === "SESSION_CHANGED");
});

test("yeni giriş beklerken önceki hesabın token'ıyla istek gönderilmez", async () => {
  const gate = deferred<Response>();
  const manager = new SessionManager(async (path) => path === "/auth/login" ? gate.promise : json(me), storage(session()));
  manager.state = { ready: true, session: session(), me, error: null };
  const login = manager.login("next@example.com", "password");
  assert.equal(manager.state.me, null);
  await assert.rejects(manager.request("/feed"), (error: ApiError) => error.code === "INVALID_SESSION");
  gate.resolve(json(session("next"))); await login;
  assert.equal(manager.state.session?.accessToken, "next");
});
