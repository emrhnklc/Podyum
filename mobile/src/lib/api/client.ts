const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Henüz demo ekranlarından çağrılmaz. Token kaynağı gerçek auth bağlanınca verilir.
export async function apiRequest<T>(
  path: `/${string}`,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  if (!baseUrl) throw new Error("EXPO_PUBLIC_API_BASE_URL tanımlanmalı.");
  if (path.startsWith("//")) throw new Error("API yolu göreli olmalı.");
  const { accessToken, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? "İstek tamamlanamadı.",
    );
  return body as T;
}
