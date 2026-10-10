export interface Environment {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  docsEnabled: boolean;
  authMockEnabled: boolean;
  localMailboxDir: string;
  localMediaDir: string;
  corsOrigins: string[];
  pollCloseWorkerEnabled: boolean;
  pollCloseIntervalMs: number;
}

function flag(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} true veya false olmalı.`);
}

export function readEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV development, test veya production olmalı.");
  }
  const portText = env.PORT ?? "3000";
  if (!/^\d+$/.test(portText) || Number(portText) > 65535) {
    throw new Error("PORT 0–65535 aralığında bir tamsayı olmalı.");
  }
  try {
    const database = new URL(env.DATABASE_URL ?? "");
    if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname) throw new Error();
  } catch {
    throw new Error("DATABASE_URL geçerli bir PostgreSQL bağlantısı olmalı.");
  }
  const authMockEnabled = flag(env.AUTH_MOCK_ENABLED, false, "AUTH_MOCK_ENABLED");
  const pollCloseInterval = env.POLL_CLOSE_INTERVAL_MS ?? "15000";
  if (!/^\d+$/.test(pollCloseInterval) || Number(pollCloseInterval) < 1000 || Number(pollCloseInterval) > 300000) {
    throw new Error("POLL_CLOSE_INTERVAL_MS 1000–300000 aralığında olmalı.");
  }
  // Gerçek e-posta/OAuth taşıyıcıları bağlanana kadar canlı ortamda sessizce yerel akış çalıştırılmaz.
  if (nodeEnv === "production") {
    throw new Error("Üretim açılışı kapalı: gerçek e-posta ve OAuth entegrasyonları henüz tamamlanmadı.");
  }
  const corsOrigins = (env.CORS_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  for (const origin of corsOrigins) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) throw new Error();
    } catch {
      throw new Error("CORS_ORIGINS virgülle ayrılmış tam http/https origin adresleri olmalı.");
    }
  }
  return {
    nodeEnv: nodeEnv as Environment["nodeEnv"],
    host: env.HOST ?? "127.0.0.1",
    port: Number(portText),
    docsEnabled: flag(env.API_DOCS_ENABLED, true, "API_DOCS_ENABLED"),
    authMockEnabled,
    localMailboxDir: env.LOCAL_MAILBOX_DIR ?? ".local/mailbox",
    localMediaDir: env.LOCAL_MEDIA_DIR ?? ".local/media",
    corsOrigins,
    pollCloseWorkerEnabled: flag(env.POLL_CLOSE_WORKER_ENABLED, true, "POLL_CLOSE_WORKER_ENABLED"),
    pollCloseIntervalMs: Number(pollCloseInterval),
  };
}
