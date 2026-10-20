export const AUTH_RULES = Object.freeze({
  accessSeconds: 15 * 60,
  sessionSeconds: 30 * 24 * 60 * 60,
  verificationSeconds: 24 * 60 * 60,
  resetSeconds: 30 * 60,
  // Geliştirme varsayımları; kullanıcı adı saklanırken küçük harfe çevrilir.
  usernamePattern: /^[a-z0-9_]{3,30}$/,
  passwordMinLength: 8,
  passwordMaxLength: 128,
});
