-- CreateTable
CREATE TABLE "AccountDeletion" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "mailTokenHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pushTokenHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificationIds" UUID[] DEFAULT ARRAY[]::UUID[],

    CONSTRAINT "AccountDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletion_userId_key" ON "AccountDeletion"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletion_completedAt_requestedAt_idx" ON "AccountDeletion"("completedAt", "requestedAt");

-- AddForeignKey
ALTER TABLE "AccountDeletion" ADD CONSTRAINT "AccountDeletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "AccountDeletion" ADD CONSTRAINT "AccountDeletion_completion_time" CHECK ("completedAt" IS NULL OR "completedAt" >= "requestedAt");
ALTER TABLE "AccountDeletion" ADD CONSTRAINT "AccountDeletion_completed_private_empty" CHECK (
  "completedAt" IS NULL OR (cardinality("mailTokenHashes") = 0 AND cardinality("pushTokenHashes") = 0 AND cardinality("notificationIds") = 0)
);
