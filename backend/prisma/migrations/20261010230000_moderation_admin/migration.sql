-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('ROLE_GRANTED', 'REPORT_RESOLVED', 'REPORT_DISMISSED', 'POLL_HIDDEN', 'POLL_RESTORED', 'COMMENT_REMOVED', 'USER_SUSPENDED', 'USER_RESTORED', 'GAME_CANCELLED');

-- CreateEnum
CREATE TYPE "AdminResourceType" AS ENUM ('USER', 'POLL', 'COMMENT', 'REPORT', 'GAME');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "decisionNote" VARCHAR(500),
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3),
ADD COLUMN     "reviewedById" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ModerationAudit" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" "ModerationAction" NOT NULL,
    "resourceType" "AdminResourceType" NOT NULL,
    "resourceId" UUID NOT NULL,
    "reportId" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationAudit_createdAt_id_idx" ON "ModerationAudit"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ModerationAudit_resourceType_resourceId_createdAt_id_idx" ON "ModerationAudit"("resourceType", "resourceId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ModerationAudit_actorId_idx" ON "ModerationAudit"("actorId");

-- CreateIndex
CREATE INDEX "ModerationAudit_reportId_idx" ON "ModerationAudit"("reportId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_id_idx" ON "Report"("status", "createdAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAudit" ADD CONSTRAINT "ModerationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAudit" ADD CONSTRAINT "ModerationAudit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Eski kapalı şikâyetlere sahte inceleyen atamayız; tümü null olan eski
-- kayıtlar korunur. Yeni kararlar API'de üç inceleme alanıyla birlikte yazılır.
ALTER TABLE "Report" ADD CONSTRAINT "Report_review_consistent" CHECK (
  ("reviewedAt" IS NULL AND "reviewedById" IS NULL AND "decisionNote" IS NULL) OR
  ("status" <> 'OPEN' AND "reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL AND length(btrim("decisionNote")) >= 3)
);
ALTER TABLE "Report" ADD CONSTRAINT "Report_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "ModerationAudit" ADD CONSTRAINT "ModerationAudit_actor_required" CHECK ("actorId" IS NOT NULL OR "action" = 'ROLE_GRANTED');
ALTER TABLE "ModerationAudit" ADD CONSTRAINT "ModerationAudit_reason_required" CHECK (length(btrim("reason")) >= 3);
ALTER TABLE "ModerationAudit" ADD CONSTRAINT "ModerationAudit_snapshots_objects" CHECK (jsonb_typeof("before") = 'object' AND jsonb_typeof("after") = 'object');

