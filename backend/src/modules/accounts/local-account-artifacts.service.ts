import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { readEnvironment } from "../../common/config/environment.js";
import type { AccountDeletion } from "../../generated/prisma/client.js";

const digest = (value: unknown) => typeof value === "string" ? createHash("sha256").update(value).digest("hex") : "";

@Injectable()
export class LocalAccountArtifacts {
  async purge(job: AccountDeletion) {
    const env = readEnvironment();
    const mail = new Set(job.mailTokenHashes); const push = new Set(job.pushTokenHashes); const notifications = new Set(job.notificationIds);
    for (const [directory, kind] of [[env.localMailboxDir, "mail"], [env.localPushDir, "push"]] as const) {
      let entries;
      try { entries = await readdir(resolve(directory), { withFileTypes: true }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const path = resolve(directory, entry.name);
        let row;
        try { row = JSON.parse(await readFile(path, "utf8")); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw new Error("Yerel teslim dosyası okunamadı; silme işi yeniden denenecek."); }
        const expiredAt = kind === "mail" ? Date.parse(row?.expiresAt) : Date.parse(row?.createdAt) + Number(row?.ttlSeconds) * 1000;
        const matches = row?.userId === job.userId || (kind === "mail" ? mail.has(digest(row?.token))
          : push.has(digest(row?.to)) || notifications.has(row?.data?.notificationId));
        // Geçmiş sürümde kullanıcı kimliği yazılmayan, artık süresi dolmuş
        // teslim dosyaları da retention gereği kaldırılır; canlı dosyalar korunur.
        if (matches || Number.isFinite(expiredAt) && expiredAt <= Date.now()) await rm(path, { force: true });
      }
    }
  }
}
