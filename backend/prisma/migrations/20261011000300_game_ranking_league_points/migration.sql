-- AlterTable
ALTER TABLE "GameOutcome" ADD COLUMN     "awardedPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rank" INTEGER;

-- CreateTable
CREATE TABLE "GameLeaguePoint" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLeaguePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameLeaguePoint_userId_idx" ON "GameLeaguePoint"("userId");

-- CreateIndex
CREATE INDEX "GameLeaguePoint_sessionId_idx" ON "GameLeaguePoint"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameLeaguePoint_userId_sessionId_key" ON "GameLeaguePoint"("userId", "sessionId");

-- AddForeignKey
ALTER TABLE "GameLeaguePoint" ADD CONSTRAINT "GameLeaguePoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLeaguePoint" ADD CONSTRAINT "GameLeaguePoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

