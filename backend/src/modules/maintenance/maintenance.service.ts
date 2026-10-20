import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service.js";
import { readEnvironment } from "../../common/config/environment.js";
import { runTechnicalRetention } from "../../common/maintenance/technical-retention.js";
import { cleanLocalDeliveries } from "../../common/maintenance/local-delivery-retention.js";
import { MediaService } from "../media/media.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

const KEY = "technical";
const LEASE_MS = 15 * 60_000;
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private running?: Promise<unknown>;
  constructor(
    private readonly db: PrismaService,
    private readonly media: MediaService,
  ) {}

  async status() {
    const env = readEnvironment();
    const row = await this.db.maintenanceState.findUnique({
      where: { key: KEY },
    });
    return {
      enabled: env.maintenanceWorkerEnabled,
      apply: env.maintenanceApply,
      intervalMs: env.maintenanceIntervalMs,
      status: row?.status ?? "IDLE",
      startedAt: row?.startedAt ?? null,
      finishedAt: row?.finishedAt ?? null,
      lastSuccessAt: row?.lastSuccessAt ?? null,
      lastFailureAt: row?.lastFailureAt ?? null,
      consecutiveFailures: row?.consecutiveFailures ?? 0,
      report: row?.report ?? null,
    };
  }

  run(
    apply = readEnvironment().maintenanceApply,
    batchSize = readEnvironment().maintenanceBatchSize,
  ) {
    if (this.running) return this.running;
    this.running = this.perform(apply, batchSize).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async perform(apply: boolean, batchSize: number) {
    if (
      typeof apply !== "boolean" ||
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 500
    )
      throw new Error("Geçersiz bakım sınırı.");
    const runToken = randomUUID();
    const claimed = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('podyum-maintenance-claim-v1', 0))::text`;
      const [{ now }] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS "now"`;
      const previous = await tx.maintenanceState.findUnique({
        where: { key: KEY },
      });
      if (previous?.leaseUntil && previous.leaseUntil > now) return null;
      const data = {
        runToken,
        leaseUntil: new Date(now.getTime() + LEASE_MS),
        startedAt: now,
        finishedAt: null,
        status: "RUNNING",
      };
      await tx.maintenanceState.upsert({
        where: { key: KEY },
        create: { key: KEY, ...data },
        update: data,
      });
      return {
        now,
        cursors: previous?.fileCursors as {
          mail?: string | null;
          push?: string | null;
          media?: string | null;
        } | null,
      };
    });
    if (!claimed) return { status: "BUSY" };
    const report: Record<string, unknown> = {
      mode: apply ? "apply" : "dry-run",
      batchSize,
    };
    const cursors = {
      mail: claimed.cursors?.mail ?? null,
      push: claimed.cursors?.push ?? null,
      media: claimed.cursors?.media ?? null,
    };
    const failedPhases: string[] = [];
    const env = readEnvironment();
    const phase = async (name: string, work: () => Promise<unknown>) => {
      // Süresi geçmiş bir işçi yeni sahibin raporunu veya imlecini ezemez.
      const [{ now }] = await this.db.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS "now"`;
      const lease = await this.db.maintenanceState.updateMany({
        where: { key: KEY, runToken },
        data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
      });
      if (!lease.count) throw new Error("Bakım kirası başka süreçte.");
      try {
        report[name] = await work();
      } catch {
        failedPhases.push(name);
        report[name] = { failed: true };
      }
    };
    try {
      await phase("database", () =>
        runTechnicalRetention(this.db, { apply, batchSize }),
      );
      for (const kind of ["mail", "push"] as const)
        await phase(kind, async () => {
          const result = await cleanLocalDeliveries(
            kind === "mail" ? env.localMailboxDir : env.localPushDir,
            kind,
            claimed.now,
            apply,
            batchSize,
            cursors[kind],
          );
          cursors[kind] = result.nextCursor;
          if (result.invalid || result.failed) failedPhases.push(kind);
          const { nextCursor: _cursor, ...safe } = result;
          return safe;
        });
      await phase("media", async () => {
        const result = apply
          ? await this.media.cleanup(claimed.now, batchSize, cursors.media)
          : await this.media.previewCleanup(
              claimed.now,
              batchSize,
              cursors.media,
            );
        cursors.media = result.orphanCursor;
        const { orphanCursor: _cursor, ...safe } = result;
        return safe;
      });
    } catch {
      failedPhases.push("lease");
    }
    const distinctFailures = [...new Set(failedPhases)];
    const status = !distinctFailures.length
      ? "SUCCEEDED"
      : distinctFailures.length >= 4
        ? "FAILED"
        : "PARTIAL";
    report.failedPhases = distinctFailures;
    const [{ now: finishedAt }] = await this.db.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS "now"`;
    await this.db.maintenanceState.updateMany({
      where: { key: KEY, runToken },
      data: {
        runToken: null,
        leaseUntil: null,
        finishedAt,
        status,
        report: report as Prisma.InputJsonValue,
        fileCursors: cursors,
        ...(failedPhases.length
          ? { lastFailureAt: finishedAt, consecutiveFailures: { increment: 1 } }
          : { lastSuccessAt: finishedAt, consecutiveFailures: 0 }),
      },
    });
    if (failedPhases.length)
      this.logger.error(
        `Bakım kısmen başarısız: ${[...new Set(failedPhases)].join(",")}; sonraki çalışmada yeniden denenecek.`,
      );
    return { status, ...report };
  }
}
