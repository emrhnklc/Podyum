import { constants } from "node:fs";
import { lstat, open, readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const NAME = /^\d{10,16}-[0-9a-f-]{36}\.json$/i;
const isoTime = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)
    ? Date.parse(value)
    : NaN;
export type DeliveryCleanup = {
  scanned: number;
  candidates: number;
  removed: number;
  invalid: number;
  failed: number;
  hasMore: boolean;
  nextCursor: string | null;
};

// Yalnız yerel taşıyıcıların dosya adları/şemaları; alt dizin, symlink veya keyfi JSON silinmez.
export async function cleanLocalDeliveries(
  directory: string,
  kind: "mail" | "push",
  now: Date,
  apply: boolean,
  batchSize: number,
  after: string | null = null,
): Promise<DeliveryCleanup> {
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 500 ||
    !Number.isFinite(now.getTime())
  )
    throw new Error("Geçersiz dosya bakım sınırı.");
  const report: DeliveryCleanup = {
    scanned: 0,
    candidates: 0,
    removed: 0,
    invalid: 0,
    failed: 0,
    hasMore: false,
    nextCursor: null,
  };
  const root = resolve(directory);
  let entries;
  try {
    const info = await lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Bakım dizini normal dizin olmalı.");
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return report;
    throw error;
  }
  const names = entries
    .filter((entry) => entry.isFile() && NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const remaining = names.filter((name) => !after || name > after);
  const selected = remaining.slice(0, batchSize);
  report.hasMore = remaining.length > batchSize;
  report.nextCursor = report.hasMore ? selected.at(-1)! : null;
  for (const name of selected) {
    report.scanned++;
    const path = resolve(root, name);
    let file;
    try {
      file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const before = await file.stat();
      if (!before.isFile() || before.size > 65_536) {
        report.invalid++;
        continue;
      }
      let row;
      try {
        row = JSON.parse(await file.readFile("utf8"));
      } catch {
        report.invalid++;
        continue;
      }
      const created = isoTime(row?.createdAt);
      const expires =
        kind === "mail"
          ? isoTime(row?.expiresAt)
          : created + Number(row?.ttlSeconds) * 1000;
      const valid =
        row?.transport === "local-only" &&
        Number.isFinite(created) &&
        Number.isFinite(expires) &&
        (kind === "mail"
          ? ["VERIFY_EMAIL", "RESET_PASSWORD"].includes(row?.kind)
          : Number.isSafeInteger(row?.ttlSeconds) &&
            row.ttlSeconds >= 0 &&
            row.ttlSeconds <= 31_536_000);
      if (!valid) {
        report.invalid++;
        continue;
      }
      if (expires > now.getTime()) continue;
      report.candidates++;
      if (apply) {
        const current = await lstat(path);
        if (
          !current.isFile() ||
          current.ino !== before.ino ||
          current.dev !== before.dev ||
          current.mtimeMs !== before.mtimeMs ||
          current.size !== before.size
        ) {
          report.failed++;
          continue;
        }
        await unlink(path);
        report.removed++;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") report.failed++;
    } finally {
      await file?.close();
    }
  }
  return report;
}
