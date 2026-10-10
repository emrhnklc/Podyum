-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('AGE_18_24', 'AGE_25_34', 'AGE_35_PLUS');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'FRIENDS');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PollCategory" AS ENUM ('OUTFIT', 'SHOES', 'BAG', 'JEWELRY', 'ACCESSORY', 'TATTOO');

-- CreateEnum
CREATE TYPE "AudienceGender" AS ENUM ('ANY', 'WOMEN', 'MEN');

-- CreateEnum
CREATE TYPE "GameRoomKind" AS ENUM ('MATCHMAKING', 'FRIENDS');

-- CreateEnum
CREATE TYPE "GameRoomStatus" AS ENUM ('WAITING', 'PREPARING', 'PROCESSING', 'VOTING', 'CALCULATING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('JOINED', 'READY', 'WITHDRAWN', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "GameEntryStatus" AS ENUM ('SUBMITTED', 'QUALIFIED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "GameRoundStatus" AS ENUM ('PENDING', 'OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "bio" VARCHAR(300),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "issuer" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrivate" (
    "userId" UUID NOT NULL,
    "gender" "Gender",
    "ageBand" "AgeBand",
    "cityCode" VARCHAR(30),
    "analyticsConsentAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserPrivate_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StyleTag" (
    "id" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,

    CONSTRAINT "StyleTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStyle" (
    "userId" UUID NOT NULL,
    "styleId" VARCHAR(40) NOT NULL,

    CONSTRAINT "UserStyle_pkey" PRIMARY KEY ("userId","styleId")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userAId","userBId")
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "uploadKey" VARCHAR(500) NOT NULL,
    "displayKey" VARCHAR(500),
    "sourceVersion" VARCHAR(255),
    "checksum" VARCHAR(128),
    "mimeType" VARCHAR(80),
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurRequested" BOOLEAN NOT NULL DEFAULT false,
    "previewAcceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "question" VARCHAR(280) NOT NULL,
    "category" "PollCategory" NOT NULL,
    "occasion" VARCHAR(60),
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "audienceGender" "AudienceGender" NOT NULL DEFAULT 'ANY',
    "audienceAgeBand" "AgeBand",
    "styleMatchRequired" BOOLEAN NOT NULL DEFAULT false,
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "contentStatus" "ContentStatus" NOT NULL DEFAULT 'VISIBLE',
    "durationSeconds" INTEGER NOT NULL DEFAULT 1800,
    "publishedAt" TIMESTAMPTZ(3),
    "closesAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "mediaId" UUID NOT NULL,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "id" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "brand" VARCHAR(100),
    "priceMinor" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "externalUrl" VARCHAR(2048) NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "pollId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "genderAtVote" "Gender",
    "ageBandAtVote" "AgeBand",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("pollId","voterId")
);

-- CreateTable
CREATE TABLE "PollSave" (
    "pollId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollSave_pkey" PRIMARY KEY ("pollId","userId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "contentStatus" "ContentStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "resourceType" VARCHAR(40) NOT NULL,
    "resourceId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRoom" (
    "id" UUID NOT NULL,
    "hostId" UUID,
    "themeId" UUID,
    "kind" "GameRoomKind" NOT NULL,
    "status" "GameRoomStatus" NOT NULL DEFAULT 'WAITING',
    "inviteCodeHash" VARCHAR(128),
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "minPlayers" INTEGER NOT NULL DEFAULT 3,
    "preparationSeconds" INTEGER NOT NULL DEFAULT 600,
    "roundSeconds" INTEGER NOT NULL DEFAULT 20,
    "processingSeconds" INTEGER NOT NULL DEFAULT 30,
    "rulesVersion" VARCHAR(40) NOT NULL DEFAULT 'alpha-v1',
    "rulesSnapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "phaseEndsAt" TIMESTAMPTZ(3),
    "currentRoundIndex" INTEGER,
    "qualifiedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "cancelReason" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'JOINED',
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "ActiveGameMembership" (
    "userId" UUID NOT NULL,
    "roomId" UUID NOT NULL,

    CONSTRAINT "ActiveGameMembership_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "GameEntry" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "status" "GameEntryStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRound" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "GameRoundStatus" NOT NULL DEFAULT 'PENDING',
    "opensAt" TIMESTAMPTZ(3),
    "closesAt" TIMESTAMPTZ(3),

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRating" (
    "roundId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "themeFits" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRating_pkey" PRIMARY KEY ("roundId","voterId")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "roomId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rank" INTEGER,
    "ratingCount" INTEGER NOT NULL,
    "ratingSum" INTEGER NOT NULL,
    "themeYesCount" INTEGER NOT NULL,
    "quorumMet" BOOLEAN NOT NULL,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "sourceKind" VARCHAR(40) NOT NULL,
    "sourceId" UUID NOT NULL,
    "awardCode" VARCHAR(40) NOT NULL,
    "policyVersion" VARCHAR(40) NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "aggregateType" VARCHAR(40) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "userId" UUID NOT NULL,
    "scope" VARCHAR(150) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("userId","scope","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_issuer_subject_key" ON "AuthIdentity"("issuer", "subject");

-- CreateIndex
CREATE INDEX "UserStyle_styleId_userId_idx" ON "UserStyle"("styleId", "userId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_status_idx" ON "Friendship"("userBId", "status");

-- CreateIndex
CREATE INDEX "Friendship_userAId_status_idx" ON "Friendship"("userAId", "status");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_uploadKey_key" ON "MediaAsset"("uploadKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_displayKey_key" ON "MediaAsset"("displayKey");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_createdAt_idx" ON "MediaAsset"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Poll_status_visibility_publishedAt_id_idx" ON "Poll"("status", "visibility", "publishedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Poll_authorId_publishedAt_id_idx" ON "Poll"("authorId", "publishedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Poll_status_closesAt_idx" ON "Poll"("status", "closesAt");

-- CreateIndex
CREATE INDEX "PollOption_mediaId_idx" ON "PollOption"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_pollId_position_key" ON "PollOption"("pollId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_id_pollId_key" ON "PollOption"("id", "pollId");

-- CreateIndex
CREATE INDEX "ProductTag_optionId_idx" ON "ProductTag"("optionId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_optionId_idx" ON "PollVote"("pollId", "optionId");

-- CreateIndex
CREATE INDEX "PollVote_voterId_createdAt_idx" ON "PollVote"("voterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PollSave_userId_createdAt_idx" ON "PollSave"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_pollId_createdAt_id_idx" ON "Comment"("pollId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_eventId_type_key" ON "Notification"("userId", "eventId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GameRoom_inviteCodeHash_key" ON "GameRoom"("inviteCodeHash");

-- CreateIndex
CREATE INDEX "GameRoom_status_phaseEndsAt_idx" ON "GameRoom"("status", "phaseEndsAt");

-- CreateIndex
CREATE INDEX "GameRoom_kind_status_createdAt_idx" ON "GameRoom"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GameRoom_hostId_idx" ON "GameRoom"("hostId");

-- CreateIndex
CREATE INDEX "GameParticipant_userId_joinedAt_idx" ON "GameParticipant"("userId", "joinedAt" DESC);

-- CreateIndex
CREATE INDEX "ActiveGameMembership_roomId_idx" ON "ActiveGameMembership"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveGameMembership_roomId_userId_key" ON "ActiveGameMembership"("roomId", "userId");

-- CreateIndex
CREATE INDEX "GameEntry_mediaId_idx" ON "GameEntry"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEntry_roomId_userId_key" ON "GameEntry"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEntry_id_roomId_userId_key" ON "GameEntry"("id", "roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_entryId_key" ON "GameRound"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_roomId_position_key" ON "GameRound"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_entryId_roomId_targetUserId_key" ON "GameRound"("entryId", "roomId", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_id_roomId_targetUserId_key" ON "GameRound"("id", "roomId", "targetUserId");

-- CreateIndex
CREATE INDEX "GameRating_roomId_idx" ON "GameRating"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_entryId_key" ON "GameResult"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_entryId_roomId_userId_key" ON "GameResult"("entryId", "roomId", "userId");

-- CreateIndex
CREATE INDEX "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PointsLedger_roomId_idx" ON "PointsLedger"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_userId_sourceKind_sourceId_awardCode_key" ON "PointsLedger"("userId", "sourceKind", "sourceId", "awardCode");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_availableAt_leaseUntil_idx" ON "OutboxEvent"("publishedAt", "availableAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_aggregateVersion_idx" ON "OutboxEvent"("aggregateType", "aggregateId", "aggregateVersion");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrivate" ADD CONSTRAINT "UserPrivate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStyle" ADD CONSTRAINT "UserStyle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStyle" ADD CONSTRAINT "UserStyle_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "StyleTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_pollId_fkey" FOREIGN KEY ("optionId", "pollId") REFERENCES "PollOption"("id", "pollId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollSave" ADD CONSTRAINT "PollSave_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollSave" ADD CONSTRAINT "PollSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveGameMembership" ADD CONSTRAINT "ActiveGameMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveGameMembership" ADD CONSTRAINT "ActiveGameMembership_roomId_userId_fkey" FOREIGN KEY ("roomId", "userId") REFERENCES "GameParticipant"("roomId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_roomId_userId_fkey" FOREIGN KEY ("roomId", "userId") REFERENCES "GameParticipant"("roomId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_entryId_roomId_targetUserId_fkey" FOREIGN KEY ("entryId", "roomId", "targetUserId") REFERENCES "GameEntry"("id", "roomId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRating" ADD CONSTRAINT "GameRating_roundId_roomId_targetUserId_fkey" FOREIGN KEY ("roundId", "roomId", "targetUserId") REFERENCES "GameRound"("id", "roomId", "targetUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRating" ADD CONSTRAINT "GameRating_roomId_voterId_fkey" FOREIGN KEY ("roomId", "voterId") REFERENCES "GameParticipant"("roomId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_entryId_roomId_userId_fkey" FOREIGN KEY ("entryId", "roomId", "userId") REFERENCES "GameEntry"("id", "roomId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
