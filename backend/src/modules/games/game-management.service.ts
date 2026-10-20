import { Injectable } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { PrismaService } from "../../database/prisma.service.js";
import { AdminAccessService } from "../auth/admin-access.service.js";
import { readEnvironment } from "../../common/config/environment.js";
import { readDailyGameSchedule } from "./game-schedule.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  GameScheduleUpdateDto,
  GameThemeCreateDto,
  GameThemeUpdateDto,
} from "./dto/game-management.dto.js";
export const DAILY_SCHEDULE_ID = "00000000-0000-4000-8000-000000000001";
const conflict = () =>
  new ApiError(409, "VERSION_CONFLICT", "Ayar değişmiş; güncel sürümü al.");

@Injectable()
export class GameManagementService {
  constructor(
    private readonly db: PrismaService,
    private readonly admin: AdminAccessService,
    private readonly idem: IdempotencyService,
  ) {}
  async themes() {
    return {
      items: await this.db.theme.findMany({
        orderBy: { slug: "asc" },
        take: 200,
      }),
    };
  }
  async schedule() {
    const row = await this.db.gameDailySchedule.findUnique({
      where: { id: DAILY_SCHEDULE_ID },
      include: { theme: true },
    });
    if (row)
      return {
        version: row.version,
        enabled: row.enabled,
        source: "DATABASE",
        startTime: row.startTime,
        timeZone: row.timeZone,
        themeSlug: row.theme?.slug ?? null,
        updatedAt: row.updatedAt,
      };
    const env = readEnvironment().dailyGameSchedule;
    return {
      version: 0,
      enabled: !!env,
      source: env ? "ENVIRONMENT" : "UNCONFIGURED",
      startTime: env?.startTime ?? null,
      timeZone: env?.timeZone ?? null,
      themeSlug: env?.themeSlug ?? null,
      updatedAt: null,
    };
  }
  createTheme(actor: string, dto: GameThemeCreateDto, key: unknown) {
    return this.idem.execute(
      actor,
      "games.theme.create",
      key,
      dto,
      201,
      async (tx) => {
        await this.admin.lockActors(tx, actor);
        if (await tx.theme.count({ where: { slug: dto.slug } }))
          throw new ApiError(
            409,
            "THEME_SLUG_TAKEN",
            "Tema kısa adı kullanımda.",
          );
        const row = await tx.theme.create({
          data: { slug: dto.slug, title: dto.title },
        });
        await this.audit(
          tx,
          actor,
          "GAME_THEME_CREATED",
          "GAME_THEME",
          row.id,
          dto.reason,
          {},
          { version: 0, active: true },
        );
        return row;
      },
    );
  }
  updateTheme(
    actor: string,
    id: string,
    dto: GameThemeUpdateDto,
    key: unknown,
  ) {
    return this.idem.execute(
      actor,
      `games.theme.update:${id}`,
      key,
      dto,
      200,
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Theme" WHERE "id" = ${id}::uuid FOR UPDATE`;
        await this.admin.lockActors(tx, actor);
        const row = await tx.theme.findUnique({ where: { id } });
        if (!row)
          throw new ApiError(404, "RESOURCE_NOT_FOUND", "Tema bulunamadı.");
        if (row.version !== dto.expectedVersion) throw conflict();
        if (!dto.active) {
          const config = await tx.gameDailySchedule.findUnique({
            where: { id: DAILY_SCHEDULE_ID },
          });
          if (
            (config?.enabled && config.themeId === id) ||
            (!config &&
              readEnvironment().dailyGameSchedule?.themeSlug === row.slug)
          )
            throw new ApiError(
              409,
              "THEME_IN_USE",
              "Önce günlük takvimi kapat veya başka temaya geçir.",
            );
        }
        const saved = await tx.theme.update({
          where: { id },
          data: {
            title: dto.title,
            active: dto.active,
            version: { increment: 1 },
          },
        });
        await this.audit(
          tx,
          actor,
          "GAME_THEME_UPDATED",
          "GAME_THEME",
          id,
          dto.reason,
          { version: row.version, active: row.active },
          { version: saved.version, active: saved.active },
        );
        return saved;
      },
    );
  }
  updateSchedule(actor: string, dto: GameScheduleUpdateDto, key: unknown) {
    return this.idem.execute(
      actor,
      "games.schedule.update",
      key,
      dto,
      200,
      async (tx) => {
        // Tema -> aktör sırası updateTheme ile aynıdır; singleton için ayrı advisory kilit.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('daily-game-schedule-v1', 0))::text`;
        const previous = await tx.gameDailySchedule.findUnique({
          where: { id: DAILY_SCHEDULE_ID },
          include: { theme: true },
        });
        if ((previous?.version ?? 0) !== dto.expectedVersion) throw conflict();
        const env = readEnvironment().dailyGameSchedule;
        const startTime =
          dto.startTime === undefined
            ? (previous?.startTime ?? env?.startTime ?? null)
            : dto.startTime;
        const timeZone =
          dto.timeZone === undefined
            ? (previous?.timeZone ?? env?.timeZone ?? null)
            : dto.timeZone;
        const themeSlug =
          dto.themeSlug === undefined
            ? (previous?.theme?.slug ?? env?.themeSlug ?? null)
            : dto.themeSlug;
        let theme = themeSlug
          ? await tx.theme.findUnique({ where: { slug: themeSlug } })
          : null;
        if (theme) {
          await tx.$queryRaw`SELECT "id" FROM "Theme" WHERE "id" = ${theme.id}::uuid FOR UPDATE`;
          theme = await tx.theme.findUnique({ where: { id: theme.id } });
        }
        await this.admin.lockActors(tx, actor);
        if (dto.enabled) {
          try {
            readDailyGameSchedule({
              DAILY_GAME_START_TIME: startTime ?? "",
              DAILY_GAME_TIME_ZONE: timeZone ?? "",
              DAILY_GAME_THEME_SLUG: themeSlug ?? "",
            });
          } catch {
            throw new ApiError(
              422,
              "INVALID_DAILY_SCHEDULE",
              "Etkin takvim için geçerli saat, saat dilimi ve tema gerekli.",
            );
          }
          if (!theme?.active)
            throw new ApiError(
              422,
              "INVALID_DAILY_THEME",
              "Etkin bir tema seç.",
            );
        }
        const data = {
          enabled: dto.enabled,
          startTime,
          timeZone,
          themeId: theme?.id ?? null,
          version: (previous?.version ?? 0) + 1,
        };
        const saved = await tx.gameDailySchedule.upsert({
          where: { id: DAILY_SCHEDULE_ID },
          create: { id: DAILY_SCHEDULE_ID, ...data },
          update: data,
        });
        await this.audit(
          tx,
          actor,
          "GAME_SCHEDULE_UPDATED",
          "GAME_SCHEDULE",
          DAILY_SCHEDULE_ID,
          dto.reason,
          {
            version: previous?.version ?? 0,
            enabled: previous?.enabled ?? !!env,
          },
          { version: saved.version, enabled: saved.enabled },
        );
        return {
          version: saved.version,
          enabled: saved.enabled,
          source: "DATABASE",
          startTime,
          timeZone,
          themeSlug: theme?.slug ?? null,
          updatedAt: saved.updatedAt,
        };
      },
    );
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action:
      "GAME_THEME_CREATED" | "GAME_THEME_UPDATED" | "GAME_SCHEDULE_UPDATED",
    resourceType: "GAME_THEME" | "GAME_SCHEDULE",
    resourceId: string,
    reason: string,
    before: Prisma.InputJsonObject,
    after: Prisma.InputJsonObject,
  ) {
    await tx.moderationAudit.create({
      data: {
        actorId,
        action,
        resourceType,
        resourceId,
        reason,
        before,
        after,
      },
    });
  }
}
