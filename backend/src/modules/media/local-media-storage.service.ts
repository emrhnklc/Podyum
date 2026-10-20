import { Injectable } from "@nestjs/common";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { readEnvironment } from "../../common/config/environment.js";

// Bu dizin static middleware veya web sunucusu tarafından dışarı açılmaz.
@Injectable()
export class LocalMediaStorage {
  readonly root = resolve(readEnvironment().localMediaDir);

  private path(key: string) {
    const path = resolve(this.root, key);
    const rel = relative(this.root, path);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || !/^[a-zA-Z0-9/_.-]+$/.test(key)) {
      throw new Error("Geçersiz dahili medya anahtarı.");
    }
    return path;
  }

  async write(key: string, data: Buffer) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, data, { flag: "wx", mode: 0o600 });
  }

  read(key: string) { return readFile(this.path(key)); }
  remove(key: string) { return rm(this.path(key), { force: true }); }

  async removeAssetDirectory(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Geçersiz dahili medya id.");
    await rm(this.path(id), { recursive: true, force: true });
  }

  async oldAssetDirectories(before: Date, createRoot = true) {
    if (createRoot) await mkdir(this.root, { recursive: true, mode: 0o700 });
    let entries;
    try { entries = await readdir(this.root, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    const ids: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name)) continue;
      const info = await stat(this.path(entry.name));
      if (info.mtimeMs < before.getTime()) ids.push(entry.name);
    }
    return ids;
  }
}
