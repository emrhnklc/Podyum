import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Injectable } from "@nestjs/common";
import { readEnvironment } from "../../common/config/environment.js";

@Injectable()
export class LocalMailService {
  async deliver(email: string, kind: "VERIFY_EMAIL" | "RESET_PASSWORD", token: string, expiresAt: Date) {
    const directory = resolve(readEnvironment().localMailboxDir);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({
      transport: "local-only", email, kind, token, expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    }, null, 2), { mode: 0o600, flag: "wx" });
  }
}
