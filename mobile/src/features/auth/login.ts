import { ApiError, errorMessage } from "../../lib/api/client";
import { REGISTRATION_RULES } from "./registration";

const emailHint = "Geçerli bir e-posta adresi yaz (ör. isim@gmail.com).";
const passwordHint = `Şifren ${REGISTRATION_RULES.passwordMin}–${REGISTRATION_RULES.passwordMax} karakter olmalı.`;

export function loginErrors(email: string, password: string) {
  const normalized = email.trim();
  return {
    email:
      normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
        ? undefined
        : emailHint,
    password:
      password.length >= REGISTRATION_RULES.passwordMin &&
      password.length <= REGISTRATION_RULES.passwordMax
        ? undefined
        : passwordHint,
  };
}

export function loginErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
    const messages = error.fields.flatMap(({ field }) =>
      field === "email"
        ? [emailHint]
        : field === "password"
          ? [passwordHint]
          : [],
    );
    if (messages.length) return [...new Set(messages)].join("\n");
    return "Giriş bilgileri sunucunun beklediği biçimde gönderilemedi. Uygulamayı yenileyip tekrar dene.";
  }
  return errorMessage(error);
}
