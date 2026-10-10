import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readEnvironment } from "../../../common/config/environment.js";

export interface PushMessage { to: string; title: string; body: string; ttlSeconds: number; data: Record<string, string> }
// sent: sağlayıcı kabul etti. invalid-token: cihaz kaydı silinmeli. rejected: bu mesaj gönderilemedi, tekrar denenmez.
export type PushResult = "sent" | "invalid-token" | "rejected";

// Sağlayıcıya ulaşılamazsa hata fırlatır; olay kuyruğu teslimi sonra yeniden dener.
export interface PushProvider { send(messages: PushMessage[]): Promise<PushResult[]> }
export const PUSH_PROVIDER = Symbol("PUSH_PROVIDER");

// Geliştirme: hiçbir yere gönderilmez, mesaj yerel dosyaya yazılır.
export class LocalPushProvider implements PushProvider {
  async send(messages: PushMessage[]) {
    const directory = resolve(readEnvironment().localPushDir);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    for (const message of messages) {
      await writeFile(resolve(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({
        transport: "local-only", ...message, createdAt: new Date().toISOString(),
      }, null, 2), { mode: 0o600, flag: "wx" });
    }
    return messages.map(() => "sent" as const);
  }
}

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
const EXPO_BATCH = 100;

// Expo Push servisi. Yanıttaki bilet yalnız kabulü gösterir; cihaza ulaşma
// makbuzu ayrıca sorgulanır ve henüz bağlı değildir.
export class ExpoPushProvider implements PushProvider {
  async send(messages: PushMessage[]) {
    const env = readEnvironment();
    const results: PushResult[] = messages.map((message) => EXPO_TOKEN.test(message.to) ? "rejected" : "invalid-token");
    const valid = messages.map((message, index) => ({ message, index })).filter(({ index }) => results[index] === "rejected");
    for (let start = 0; start < valid.length; start += EXPO_BATCH) {
      const batch = valid.slice(start, start + EXPO_BATCH);
      const response = await fetch(env.expoPushUrl, { method: "POST", signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}) },
        body: JSON.stringify(batch.map(({ message }) => ({ to: message.to, title: message.title, body: message.body, data: message.data, ttl: message.ttlSeconds, sound: "default" }))) });
      if (!response.ok) throw new Error(`Expo push isteği başarısız: ${response.status}`);
      const tickets = (await response.json() as { data?: unknown }).data;
      if (!Array.isArray(tickets) || tickets.length !== batch.length) throw new Error("Expo push yanıtı beklenen biçimde değil.");
      tickets.forEach((ticket: { status?: string; details?: { error?: string } }, offset) => {
        results[batch[offset].index] = ticket?.status === "ok" ? "sent" : ticket?.details?.error === "DeviceNotRegistered" ? "invalid-token" : "rejected";
      });
    }
    return results;
  }
}

export const createPushProvider = (): PushProvider => readEnvironment().pushProvider === "expo" ? new ExpoPushProvider() : new LocalPushProvider();
