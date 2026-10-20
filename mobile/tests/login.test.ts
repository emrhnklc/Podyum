import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/lib/api/client";
import { loginErrorMessage, loginErrors } from "../src/features/auth/login";
import { SessionManager } from "../src/features/auth/session-manager";

test("giriş e-posta biçimini ve 8–128 parola sınırını denetler", () => {
  for (const length of [8, 128]) {
    assert.deepEqual(loginErrors("  Elif@example.com  ", "a".repeat(length)), {
      email: undefined, password: undefined,
    });
  }
  for (const length of [7, 129])
    assert.ok(loginErrors("elif@example.com", "a".repeat(length)).password);
  for (const email of ["elifyz", "elif@example", "elif @example.com", ""]) {
    assert.ok(loginErrors(email, "Test123!").email);
  }
});

test("giriş sunucunun reddettiği alanı gösterir ve yanlış şifre hatasını korur", () => {
  const fields = [{ field: "email", rules: ["isEmail"] }];
  assert.match(loginErrorMessage(new ApiError(400, "VALIDATION_ERROR", "İstek alanlarını kontrol et.", fields)), /e-posta/i);
  assert.match(loginErrorMessage(new ApiError(400, "VALIDATION_ERROR", "İstek alanlarını kontrol et.", [{ field: "password", rules: ["minLength"] }])), /8–128/);
  assert.equal(loginErrorMessage(new ApiError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı.")), "E-posta veya şifre hatalı.");
});

test("giriş isteği yalnız e-posta ve parolayı gönderir; parolanın boşlukları korunur", async () => {
  const manager = new SessionManager(async (path, options) => {
    if (path === "/auth/login") {
      assert.equal(options?.method, "POST");
      assert.deepEqual(JSON.parse(options?.body as string), { email: "elif@example.com", password: "  Test123!  " });
      throw new ApiError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı.");
    }
    throw new Error("Başarısız girişten sonra başka istek beklenmiyor.");
  }, { read: async () => null, write: async () => {} });
  await assert.rejects(manager.login("  elif@example.com  ", "  Test123!  "), (error: ApiError) => error.code === "INVALID_CREDENTIALS");
  assert.equal(manager.state.session, null);
});
