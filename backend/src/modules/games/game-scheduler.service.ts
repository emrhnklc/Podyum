import { DAILY_SCHEDULE_ID } from "./game-management.service.js";
import { Injectable } from "@nestjs/common";
import { readEnvironment } from "../../common/config/environment.js";
import { PrismaService } from "../../database/prisma.service.js";
import { gameEvent, gameNow } from "./game-internals.js";
import { GameLifecycleService } from "./game-lifecycle.service.js";
import { dailyGameStart, gameLocalDay, type DailyGameSchedule } from "./game-schedule.js";
import { gameSummary } from "./games.service.js";

@Injectable()
export class GameSchedulerService {
  constructor(private readonly prisma: PrismaService, private readonly lifecycle: GameLifecycleService) {}

  ensureDaily(day: string, schedule: DailyGameSchedule) {
    return this.prisma.$transaction(async (tx) => {
      const lock = `game-daily:${day}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text`;
      const existing = await tx.gameSession.findUnique({ where: { dailyKey: day } });
      if (existing) return existing;
      const theme = await tx.theme.findFirst({ where: { slug: schedule.themeSlug, active: true } });
      if (!theme) throw new Error("Günlük oyun için etkin tema bulunamadı.");
      const startsAt = dailyGameStart(day, schedule);
      const submissionEndsAt = new Date(startsAt.getTime() + 1800000);
      const session = await tx.gameSession.create({ data: {
        kind: "DAILY", phase: "SCHEDULED", themeId: theme.id, themeTitle: theme.title, dailyKey: day,
        scheduleTimeZone: schedule.timeZone, scheduleStartTime: schedule.startTime,
        startsAt, submissionEndsAt, votingStartsAt: submissionEndsAt, votingEndsAt: new Date(submissionEndsAt.getTime() + 1800000),
      } });
      await gameEvent(tx, session, "game.created"); return session;
    });
  }

  async configuredSchedule() {
    const row = await this.prisma.gameDailySchedule.findUnique({ where: { id: DAILY_SCHEDULE_ID }, include: { theme: true } });
    if (!row) return readEnvironment().dailyGameSchedule;
    if (!row.enabled || !row.theme?.active || !row.startTime || !row.timeZone) return null;
    return { startTime: row.startTime, timeZone: row.timeZone, themeSlug: row.theme.slug };
  }

  async ensureToday() {
    const schedule = await this.configuredSchedule();
    if (!schedule) return null;
    const now = await this.prisma.$transaction(gameNow);
    return this.ensureDaily(gameLocalDay(now, schedule.timeZone), schedule);
  }

  async current() {
    const schedule = await this.configuredSchedule();
    const row = await this.ensureToday();
    if (!row) return { scheduleConfigured: false, event: null };
    return this.prisma.$transaction(async (tx) => {
      const session = await this.lifecycle.lock(tx, row.id);
      const now = await gameNow(tx);
      const saved = await this.lifecycle.advance(tx, session, now);
      return { scheduleConfigured: schedule !== null, event: gameSummary(saved, now) };
    }, { timeout: 30000 });
  }
}
