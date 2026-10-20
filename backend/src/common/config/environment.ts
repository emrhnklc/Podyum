import { readDailyGameSchedule, type DailyGameSchedule } from "../../modules/games/game-schedule.js";

export interface Environment {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  docsEnabled: boolean;
  authMockEnabled: boolean;
  emailVerificationRequired: boolean;
  localMailboxDir: string;
  localMediaDir: string;
  corsOrigins: string[];
  pollCloseWorkerEnabled: boolean;
  pollCloseIntervalMs: number;
  gameWorkerEnabled: boolean;
  gameIntervalMs: number;
  dailyGameSchedule: DailyGameSchedule | null;
  outboxWorkerEnabled: boolean;
  outboxIntervalMs: number;
  pushProvider: "local" | "expo";
  localPushDir: string;
  expoPushUrl: string;
  expoAccessToken: string | null;
  maintenanceWorkerEnabled: boolean;
  maintenanceApply: boolean;
  maintenanceIntervalMs: number;
  maintenanceBatchSize: number;
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
  const gameInterval = env.GAME_INTERVAL_MS ?? "5000";
  if (!/^\d+$/.test(gameInterval) || Number(gameInterval) < 1000 || Number(gameInterval) > 300000) throw new Error("GAME_INTERVAL_MS 1000–300000 aralığında olmalı.");
  const outboxInterval = env.OUTBOX_INTERVAL_MS ?? "3000";
  if (!/^\d+$/.test(outboxInterval) || Number(outboxInterval) < 500 || Number(outboxInterval) > 300000) throw new Error("OUTBOX_INTERVAL_MS 500–300000 aralığında olmalı.");
  const maintenanceInterval = env.MAINTENANCE_INTERVAL_MS ?? "3600000";
  const maintenanceBatch = env.MAINTENANCE_BATCH_SIZE ?? "100";
  if (!/^\d+$/.test(maintenanceInterval) || Number(maintenanceInterval) < 60000 || Number(maintenanceInterval) > 86400000) throw new Error("MAINTENANCE_INTERVAL_MS 60000–86400000 aralığında olmalı.");
  if (!/^\d+$/.test(maintenanceBatch) || Number(maintenanceBatch) < 1 || Number(maintenanceBatch) > 500) throw new Error("MAINTENANCE_BATCH_SIZE 1–500 aralığında olmalı.");
  const pushProvider = env.PUSH_PROVIDER ?? "local";
  if (pushProvider !== "local" && pushProvider !== "expo") throw new Error("PUSH_PROVIDER local veya expo olmalı.");
  const expoPushUrl = env.EXPO_PUSH_URL ?? "https://exp.host/--/api/v2/push/send";
  try {
    if (!["http:", "https:"].includes(new URL(expoPushUrl).protocol)) throw new Error();
  } catch {
    throw new Error("EXPO_PUSH_URL geçerli bir http/https adresi olmalı.");
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
    // Ürün kararı: e-posta onayı şimdilik kapalı; kayıt olan hemen giriş yapabilir.
    emailVerificationRequired: flag(env.AUTH_EMAIL_VERIFICATION_REQUIRED, false, "AUTH_EMAIL_VERIFICATION_REQUIRED"),
    localMailboxDir: env.LOCAL_MAILBOX_DIR ?? ".local/mailbox",
    localMediaDir: env.LOCAL_MEDIA_DIR ?? ".local/media",
    corsOrigins,
    pollCloseWorkerEnabled: flag(env.POLL_CLOSE_WORKER_ENABLED, true, "POLL_CLOSE_WORKER_ENABLED"),
    pollCloseIntervalMs: Number(pollCloseInterval),
    gameWorkerEnabled: flag(env.GAME_WORKER_ENABLED, true, "GAME_WORKER_ENABLED"),
    gameIntervalMs: Number(gameInterval),
    dailyGameSchedule: readDailyGameSchedule(env),
    outboxWorkerEnabled: flag(env.OUTBOX_WORKER_ENABLED, true, "OUTBOX_WORKER_ENABLED"),
    outboxIntervalMs: Number(outboxInterval),
    pushProvider,
    localPushDir: env.LOCAL_PUSH_DIR ?? ".local/push",
    expoPushUrl,
    expoAccessToken: env.EXPO_ACCESS_TOKEN || null,
    maintenanceWorkerEnabled: flag(env.MAINTENANCE_WORKER_ENABLED, true, "MAINTENANCE_WORKER_ENABLED"),
    maintenanceApply: flag(env.MAINTENANCE_APPLY, false, "MAINTENANCE_APPLY"),
    maintenanceIntervalMs: Number(maintenanceInterval),
    maintenanceBatchSize: Number(maintenanceBatch),
  };
}
