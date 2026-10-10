-- CreateEnum
CREATE TYPE "PollReasonCode" AS ENUM ('COLOR_HARMONY', 'MORE_STYLISH', 'MORE_COMFORTABLE', 'FITS_OCCASION', 'BETTER_FIT');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('POLL', 'COMMENT', 'USER');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "removedAt" TIMESTAMPTZ(3),
ADD COLUMN     "removedById" UUID;

-- CreateTable
CREATE TABLE "PollVoteReason" (
    "pollId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "reason" "PollReasonCode" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PollVoteReason_pkey" PRIMARY KEY ("pollId","voterId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "pollId" UUID,
    "commentId" UUID,
    "targetUserId" UUID,
    "reason" "ReportReason" NOT NULL,
    "note" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollVoteReason_pollId_reason_idx" ON "PollVoteReason"("pollId", "reason");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_pollId_key" ON "Report"("reporterId", "pollId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_commentId_key" ON "Report"("reporterId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetUserId_key" ON "Report"("reporterId", "targetUserId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVoteReason" ADD CONSTRAINT "PollVoteReason_pollId_voterId_fkey" FOREIGN KEY ("pollId", "voterId") REFERENCES "PollVote"("pollId", "voterId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Şikâyet: hedef türüyle eşleşen tek bir hedef sütunu doludur.
ALTER TABLE "Report" ADD CONSTRAINT "Report_target_matches_type" CHECK (
    ("targetType" = 'POLL' AND "pollId" IS NOT NULL AND "commentId" IS NULL AND "targetUserId" IS NULL) OR
    ("targetType" = 'COMMENT' AND "commentId" IS NOT NULL AND "pollId" IS NULL AND "targetUserId" IS NULL) OR
    ("targetType" = 'USER' AND "targetUserId" IS NOT NULL AND "pollId" IS NULL AND "commentId" IS NULL)
);

-- Kullanıcı kendini şikâyet edemez.
ALTER TABLE "Report" ADD CONSTRAINT "Report_not_self" CHECK ("targetUserId" IS NULL OR "targetUserId" <> "reporterId");

-- Yorumun kaldırılma zamanı ve kaldıran kişi birlikte bulunur.
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_removal_pair" CHECK (("removedAt" IS NULL) = ("removedById" IS NULL));
