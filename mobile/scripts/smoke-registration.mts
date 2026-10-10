import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  apiBaseUrl,
  apiFetch,
  apiRequest,
  ApiError,
} from "../src/lib/api/client";
import { SessionManager } from "../src/features/auth/session-manager";
import {
  confirmEmail,
  registerAccount,
  registrationErrors,
  requestVerification,
  type RegistrationProfile,
  type StyleTag,
} from "../src/features/auth/registration";
import {
  acceptAvatar,
  prepareAvatar,
} from "../src/features/profile/api/avatar";

const target = new URL(apiBaseUrl ?? "http://127.0.0.1:3000/v1");
assert.ok(
  apiBaseUrl &&
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
    target.pathname === "/v1",
  "Smoke yalnız açıkça seçilmiş yerel /v1 API'sine çalışır.",
);
const suffix = randomBytes(6).toString("hex");
const input = {
  displayName: "Kayıt Kontrolü",
  username: `signup_${suffix}`,
  email: `signup_${suffix}@example.test`,
  password: randomBytes(24).toString("base64url"),
};
const mailbox = process.env.LOCAL_MAILBOX_DIR
  ? resolve(process.env.LOCAL_MAILBOX_DIR)
  : new URL("../../backend/.local/mailbox/", import.meta.url);
async function latestToken() {
  const mails = [];
  for (const name of await readdir(mailbox)) {
    if (!name.endsWith(".json")) continue;
    const path =
      typeof mailbox === "string"
        ? resolve(mailbox, name)
        : new URL(name, mailbox);
    const mail = JSON.parse(await readFile(path, "utf8"));
    if (mail.email === input.email && mail.kind === "VERIFY_EMAIL")
      mails.push(mail);
  }
  mails.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  assert.ok(mails[0], "Doğrulama iletisi yerel posta kutusunda bulunamadı.");
  return mails[0].token as string;
}
const client = new SessionManager(apiFetch, {
  read: async () => null,
  write: async () => {},
});
const post = (body: unknown) => ({
  method: "POST",
  body: JSON.stringify(body),
});
try {
  assert.ok(
    Object.values(registrationErrors(input, input.password)).every(
      (value) => value === undefined,
    ),
  );
  await assert.rejects(
    apiRequest("/auth/register", post({ ...input, password: "short" })),
    (error: ApiError) => error.status === 400,
  );
  await assert.rejects(
    apiRequest("/auth/register", post({ ...input, username: "name.with.dot" })),
    (error: ApiError) => error.status === 400,
  );
  assert.equal((await registerAccount(input)).status, "accepted");
  await assert.rejects(
    client.login(input.email, input.password),
    (error: ApiError) => error.code === "EMAIL_NOT_VERIFIED",
  );
  assert.equal(client.state.session, null);
  const originalToken = await latestToken();
  await requestVerification(input.email);
  const renewedToken = await latestToken();
  assert.notEqual(originalToken, renewedToken);
  await assert.rejects(
    confirmEmail(originalToken),
    (error: ApiError) => error.status === 400,
  );
  assert.equal((await confirmEmail(renewedToken)).status, "ok");
  await assert.rejects(
    confirmEmail(renewedToken),
    (error: ApiError) => error.status === 400,
  );
  // Kayıt 202 yanıtı mevcut e-postayı ifşa etmez ve profil/parolayı değiştirmez.
  assert.equal(
    (
      await registerAccount({
        ...input,
        displayName: "Değişmemeli",
        password: `${input.password}x`,
      })
    ).status,
    "accepted",
  );
  await assert.rejects(
    registerAccount({ ...input, email: `other_${suffix}@example.test` }),
    (error: ApiError) => error.code === "USERNAME_UNAVAILABLE",
  );
  await client.login(input.email, input.password);
  assert.equal(client.state.me?.user.username, input.username);
  assert.equal(client.state.me?.user.displayName, input.displayName);
  const tags = await client.request<StyleTag[]>("/style-tags");
  assert.ok(tags.length);
  await client.request("/me", {
    method: "PATCH",
    body: JSON.stringify({
      displayName: "Yeni Görünen Ad",
      bio: "Gerçek kayıt akışı",
      styleIds: tags.slice(0, 3).map((tag) => tag.id),
    }),
  });
  const bytes = await readFile(
    new URL("../assets/images/auth/woman.jpg", import.meta.url),
  );
  const asset = await prepareAvatar(
    client,
    new Blob([bytes], { type: "image/jpeg" }),
    bytes.length,
    "image/jpeg",
  );
  assert.ok(asset.displayPath);
  assert.equal(asset.previewAcceptedAt, null);
  await assert.rejects(
    client.request("/me/avatar", {
      method: "PUT",
      body: JSON.stringify({ mediaId: asset.id }),
    }),
    (error: ApiError) => error.status === 409,
  );
  const preview = await client.response(asset.displayPath as `/${string}`);
  assert.ok((await preview.arrayBuffer()).byteLength > 0);
  const saved = await acceptAvatar(client, asset);
  // Onay/bağlama yanıtı kaybolursa aynı fotoğrafla tekrar güvenlidir.
  assert.deepEqual(await acceptAvatar(client, asset), saved);
  const profile = await client.request<RegistrationProfile>("/me");
  assert.equal(profile.profile.bio, "Gerçek kayıt akışı");
  assert.equal(profile.profile.avatarPath, saved.avatarPath);
  assert.deepEqual(
    profile.profile.styles.map((tag) => tag.id).sort(),
    tags
      .slice(0, 3)
      .map((tag) => tag.id)
      .sort(),
  );
  const privateProfile = await client.request<{ analyticsConsent: boolean }>(
    "/me/private",
  );
  assert.equal(privateProfile.analyticsConsent, false);
  await client.reloadMe();
  assert.equal(client.state.me?.user.displayName, "Yeni Görünen Ad");
  await client.logout();
  await client.login(input.email, input.password);
  const restored = await client.request<RegistrationProfile>("/me");
  assert.equal(restored.profile.avatarPath, saved.avatarPath);
  await client.logout();
  console.log(
    "Kayıt API smoke geçti: alan kuralları, doğrulama zorunluluğu, yeniden gönderim/eski anahtar/replay, mevcut hesap korunması, giriş, profil/stiller, fotoğraf önizleme/onay, kalıcılık ve çıkış. Yalnız yeni signup_ test hesabı kullanıldı.",
  );
} finally {
  if (client.state.session) await client.logout().catch(() => {});
}
