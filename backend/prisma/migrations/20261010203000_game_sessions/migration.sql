-- CreateEnum
CREATE TYPE "GameSessionKind" AS ENUM ('DAILY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GamePhase" AS ENUM ('SCHEDULED', 'WAITING', 'SUBMISSION', 'VOTING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GameMemberStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "GameSubmissionStatus" AS ENUM ('SUBMITTED', 'FROZEN', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "MediaPurpose" ADD VALUE 'GAME';

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "kind" "GameSessionKind" NOT NULL,
    "phase" "GamePhase" NOT NULL,
    "hostId" UUID,
    "themeId" UUID,
    "themeTitle" VARCHAR(120) NOT NULL,
    "dailyKey" VARCHAR(10),
    "scheduleTimeZone" VARCHAR(80),
    "scheduleStartTime" VARCHAR(5),
    "rulesVersion" VARCHAR(40) NOT NULL DEFAULT 'podyum-v1',
    "submissionSeconds" INTEGER NOT NULL DEFAULT 1800,
    "votingSeconds" INTEGER NOT NULL DEFAULT 1800,
    "maxMembers" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "ballotSlots" INTEGER NOT NULL DEFAULT 0,
    "waitingExpiresAt" TIMESTAMPTZ(3),
    "startsAt" TIMESTAMPTZ(3),
    "submissionEndsAt" TIMESTAMPTZ(3),
    "votingStartsAt" TIMESTAMPTZ(3),
    "votingEndsAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "cancelReason" VARCHAR(80),
    "inviteHash" CHAR(64),
    "inviteExpiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMembership" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "GameMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "ballotSeed" INTEGER NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "GameMembership_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "GameSubmission" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "GameSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameScore" (
    "submissionId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("submissionId","voterId")
);

-- CreateTable
CREATE TABLE "GameOutcome" (
    "sessionId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ratingCount" INTEGER NOT NULL,
    "ratingSum" INTEGER NOT NULL,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameOutcome_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_dailyKey_key" ON "GameSession"("dailyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_inviteHash_key" ON "GameSession"("inviteHash");

-- CreateIndex
CREATE INDEX "GameSession_phase_submissionEndsAt_idx" ON "GameSession"("phase", "submissionEndsAt");

-- CreateIndex
CREATE INDEX "GameSession_phase_votingEndsAt_idx" ON "GameSession"("phase", "votingEndsAt");

-- CreateIndex
CREATE INDEX "GameSession_phase_startsAt_idx" ON "GameSession"("phase", "startsAt");

-- CreateIndex
CREATE INDEX "GameSession_phase_waitingExpiresAt_idx" ON "GameSession"("phase", "waitingExpiresAt");

-- CreateIndex
CREATE INDEX "GameSession_hostId_createdAt_idx" ON "GameSession"("hostId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GameMembership_userId_joinedAt_sessionId_idx" ON "GameMembership"("userId", "joinedAt" DESC, "sessionId" DESC);

-- CreateIndex
CREATE INDEX "GameSubmission_mediaId_idx" ON "GameSubmission"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSubmission_sessionId_userId_key" ON "GameSubmission"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSubmission_sessionId_position_key" ON "GameSubmission"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GameSubmission_id_sessionId_userId_key" ON "GameSubmission"("id", "sessionId", "userId");

-- CreateIndex
CREATE INDEX "GameScore_sessionId_idx" ON "GameScore"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameOutcome_submissionId_key" ON "GameOutcome"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameOutcome_submissionId_sessionId_userId_key" ON "GameOutcome"("submissionId", "sessionId", "userId");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMembership" ADD CONSTRAINT "GameMembership_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMembership" ADD CONSTRAINT "GameMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSubmission" ADD CONSTRAINT "GameSubmission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSubmission" ADD CONSTRAINT "GameSubmission_sessionId_userId_fkey" FOREIGN KEY ("sessionId", "userId") REFERENCES "GameMembership"("sessionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSubmission" ADD CONSTRAINT "GameSubmission_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_submissionId_sessionId_targetUserId_fkey" FOREIGN KEY ("submissionId", "sessionId", "targetUserId") REFERENCES "GameSubmission"("id", "sessionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_sessionId_voterId_fkey" FOREIGN KEY ("sessionId", "voterId") REFERENCES "GameMembership"("sessionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameOutcome" ADD CONSTRAINT "GameOutcome_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameOutcome" ADD CONSTRAINT "GameOutcome_submissionId_sessionId_userId_fkey" FOREIGN KEY ("submissionId", "sessionId", "userId") REFERENCES "GameSubmission"("id", "sessionId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GameSession" ADD CONSTRAINT "game_session_kind_rules" CHECK (
  ("kind" = 'PRIVATE' AND "hostId" IS NOT NULL AND "dailyKey" IS NULL AND "maxMembers" BETWEEN 2 AND 50 AND "waitingExpiresAt" IS NOT NULL)
  OR ("kind" = 'DAILY' AND "hostId" IS NULL AND "dailyKey" IS NOT NULL AND "scheduleTimeZone" IS NOT NULL
    AND "scheduleStartTime" IS NOT NULL AND "submissionSeconds" = 1800 AND "votingSeconds" = 1800 AND "maxMembers" IS NULL)
);
ALTER TABLE "GameSession" ADD CONSTRAINT "game_session_duration_bounds" CHECK (
  "submissionSeconds" BETWEEN 60 AND 7200 AND "votingSeconds" BETWEEN 60 AND 7200
  AND "version" >= 0 AND "ballotSlots" >= 0
);
ALTER TABLE "GameSession" ADD CONSTRAINT "game_session_deadlines" CHECK (
  ("phase" NOT IN ('SCHEDULED', 'SUBMISSION', 'VOTING', 'COMPLETED') OR
    ("startsAt" IS NOT NULL AND "submissionEndsAt" IS NOT NULL AND "votingStartsAt" IS NOT NULL AND "votingEndsAt" IS NOT NULL
    AND "submissionEndsAt" > "startsAt" AND "votingStartsAt" = "submissionEndsAt" AND "votingEndsAt" > "votingStartsAt"))
  AND ("phase" NOT IN ('COMPLETED', 'CANCELLED') OR "finishedAt" IS NOT NULL)
);
ALTER TABLE "GameSession" ADD CONSTRAINT "game_session_initial_phase" CHECK (
  ("phase" <> 'WAITING' OR "kind" = 'PRIVATE') AND ("phase" <> 'SCHEDULED' OR "kind" = 'DAILY')
);
ALTER TABLE "GameSession" ADD CONSTRAINT "game_session_invite_pair" CHECK (
  ("inviteHash" IS NULL) = ("inviteExpiresAt" IS NULL)
  AND ("inviteHash" IS NULL OR "kind" = 'PRIVATE')
);
ALTER TABLE "GameMembership" ADD CONSTRAINT "game_member_seed_bounds" CHECK ("ballotSeed" >= 0);
ALTER TABLE "GameMembership" ADD CONSTRAINT "game_member_left_at" CHECK (("status" = 'LEFT') = ("leftAt" IS NOT NULL));
ALTER TABLE "GameSubmission" ADD CONSTRAINT "game_submission_position" CHECK ("position" > 0);
ALTER TABLE "GameScore" ADD CONSTRAINT "game_score_stars" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "GameScore" ADD CONSTRAINT "game_score_not_self" CHECK ("voterId" <> "targetUserId");
ALTER TABLE "GameOutcome" ADD CONSTRAINT "game_outcome_counts" CHECK (
  "ratingCount" >= 0 AND "ratingSum" BETWEEN "ratingCount" AND 5 * "ratingCount"
);
