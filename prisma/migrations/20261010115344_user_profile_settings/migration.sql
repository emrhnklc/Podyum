-- AlterTable
ALTER TABLE "UserPrivate" ADD COLUMN     "analyticsRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" UUID NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "friendRequestNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pollResultNotifications" BOOLEAN NOT NULL DEFAULT true,
    "commentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "defaultPollVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "defaultCommentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultBlurFace" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
