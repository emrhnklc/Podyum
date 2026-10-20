export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/+$/,
  "",
);

export type ApiFieldError = { field: string; rules: string[] };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: ApiFieldError[] = [],
  ) {
    super(message);
  }
}

export type ApiOptions = RequestInit & { accessToken?: string };

export function apiUrl(path: string) {
  if (!apiBaseUrl)
    throw new ApiError(
      0,
      "API_NOT_CONFIGURED",
      "Sunucu bağlantısı henüz ayarlanmamış.",
    );
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("API yolu göreli olmalı.");
  return path.startsWith("/v1/")
    ? new URL(path, apiBaseUrl).href
    : `${apiBaseUrl}${path}`;
}

export async function apiFetch(
  path: `/${string}`,
  options: RequestInit & { accessToken?: string } = {},
): Promise<Response> {
  const { accessToken, ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (typeof init.body === "string")
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(15000);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof ApiError || init.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? "İstek tamamlanamadı.",
      Array.isArray(body?.error?.fields)
        ? body.error.fields.filter(
            (item: unknown): item is ApiFieldError =>
              typeof item === "object" &&
              item !== null &&
              "field" in item &&
              typeof item.field === "string" &&
              "rules" in item &&
              Array.isArray(item.rules) &&
              item.rules.every((rule: unknown) => typeof rule === "string"),
          )
        : [],
    );
  }
  return response;
}

export async function apiRequest<T>(
  path: `/${string}`,
  options: ApiOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  return response.status === 204 ? (undefined as T) : response.json();
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "İşlem tamamlanamadı. Tekrar deneyebilirsin.";
}
