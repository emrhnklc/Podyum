import { apiRequest } from "../../lib/api/client";

export const REGISTRATION_RULES = {
  username: /^[a-z0-9_]{3,30}$/,
  usernameHint: "3–30 karakter; küçük harf, rakam ve alt çizgi kullan.",
  passwordMin: 15,
  passwordMax: 128,
  nameMax: 80,
  bioMax: 300,
};

export type RegistrationInput = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};
export type StyleTag = { id: string; label: string };
export type RegistrationProfile = {
  profile: {
    id: string;
    username: string;
    displayName: string;
    bio: string | null;
    avatarPath: string | null;
    styles: StyleTag[];
  };
};

export function registrationErrors(
  input: RegistrationInput,
  confirmation: string,
) {
  return {
    fullName:
      input.displayName.trim().length > 0 &&
      input.displayName.trim().length <= REGISTRATION_RULES.nameMax
        ? undefined
        : "Adın 1–80 karakter olmalı.",
    handle: REGISTRATION_RULES.username.test(
      input.username.trim().toLowerCase(),
    )
      ? undefined
      : REGISTRATION_RULES.usernameHint,
    email:
      input.email.trim().length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
        ? undefined
        : "Geçerli bir e-posta adresi yaz.",
    password:
      input.password.length >= REGISTRATION_RULES.passwordMin &&
      input.password.length <= REGISTRATION_RULES.passwordMax
        ? undefined
        : "Şifren 15–128 karakter olmalı.",
    password2:
      confirmation && input.password === confirmation
        ? undefined
        : "Şifreler aynı değil.",
  };
}

export function registerAccount(input: RegistrationInput) {
  // Parola kırpılmaz; hesap alanları backend ile aynı biçimde normalleştirilir.
  return apiRequest<{ status: "accepted" }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      displayName: input.displayName.trim(),
      username: input.username.trim().toLowerCase(),
      email: input.email.trim().toLowerCase(),
    }),
  });
}

export const confirmEmail = (token: string) =>
  apiRequest<{ status: "ok" }>("/auth/email-verification/confirm", {
    method: "POST",
    body: JSON.stringify({ token: token.trim() }),
  });
export const requestVerification = (email: string) =>
  apiRequest<{ status: "accepted" }>("/auth/email-verification/request", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
