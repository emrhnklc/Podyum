-- CreateEnum
CREATE TYPE "AuthActionKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "AuthCredential" (
    "userId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "accessTokenHash" CHAR(64) NOT NULL,
    "refreshTokenHash" CHAR(64) NOT NULL,
    "accessExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedRefreshToken" (
    "tokenHash" CHAR(64) NOT NULL,
    "sessionId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UsedRefreshToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "AuthActionToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AuthActionKind" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthCredential_email_key" ON "AuthCredential"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_accessTokenHash_key" ON "AuthSession"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "UsedRefreshToken_sessionId_idx" ON "UsedRefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "UsedRefreshToken_expiresAt_idx" ON "UsedRefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthActionToken_tokenHash_key" ON "AuthActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthActionToken_userId_kind_idx" ON "AuthActionToken"("userId", "kind");

-- CreateIndex
CREATE INDEX "AuthActionToken_expiresAt_idx" ON "AuthActionToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuthCredential" ADD CONSTRAINT "AuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedRefreshToken" ADD CONSTRAINT "UsedRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthActionToken" ADD CONSTRAINT "AuthActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
