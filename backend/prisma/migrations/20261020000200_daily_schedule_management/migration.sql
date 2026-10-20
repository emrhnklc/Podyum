ALTER TABLE "Theme" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TYPE "ModerationAction" ADD VALUE 'GAME_THEME_CREATED';
ALTER TYPE "ModerationAction" ADD VALUE 'GAME_THEME_UPDATED';
ALTER TYPE "ModerationAction" ADD VALUE 'GAME_SCHEDULE_UPDATED';
ALTER TYPE "AdminResourceType" ADD VALUE 'GAME_THEME';
ALTER TYPE "AdminResourceType" ADD VALUE 'GAME_SCHEDULE';
CREATE TABLE "GameDailySchedule" (
 "id" UUID PRIMARY KEY,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "startTime" VARCHAR(5),
 "timeZone" VARCHAR(80),
 "themeId" UUID REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL DEFAULT 0,
 "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "GameDailySchedule_singleton" CHECK ("id" = '00000000-0000-4000-8000-000000000001'::uuid),
 CONSTRAINT "GameDailySchedule_enabled" CHECK (NOT "enabled" OR ("startTime" IS NOT NULL AND "timeZone" IS NOT NULL AND "themeId" IS NOT NULL)),
 CONSTRAINT "GameDailySchedule_version" CHECK ("version" >= 0)
);
CREATE INDEX "GameDailySchedule_themeId_idx" ON "GameDailySchedule"("themeId");
