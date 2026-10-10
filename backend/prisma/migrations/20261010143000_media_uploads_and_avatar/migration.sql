CREATE TYPE "MediaPurpose" AS ENUM ('POLL', 'AVATAR');

ALTER TABLE "User" ADD COLUMN "avatarMediaId" UUID;
ALTER TABLE "MediaAsset"
  ADD COLUMN "purpose" "MediaPurpose" NOT NULL DEFAULT 'POLL',
  ADD COLUMN "thumbnailKey" VARCHAR(500),
  ADD COLUMN "uploadTokenHash" CHAR(64),
  ADD COLUMN "uploadExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "declaredMimeType" VARCHAR(80),
  ADD COLUMN "declaredByteSize" INTEGER,
  ADD COLUMN "rejectionCode" VARCHAR(80),
  ADD COLUMN "processingRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processingRequestHash" CHAR(64),
  ADD COLUMN "filesPurgedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "MediaAsset_thumbnailKey_key" ON "MediaAsset"("thumbnailKey");
CREATE UNIQUE INDEX "User_avatarMediaId_key" ON "User"("avatarMediaId");
ALTER TABLE "User" ADD CONSTRAINT "User_avatarMediaId_fkey"
  FOREIGN KEY ("avatarMediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_declared_size_bounds"
  CHECK ("declaredByteSize" IS NULL OR "declaredByteSize" BETWEEN 1 AND 10485760);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_processing_revision_nonnegative"
  CHECK ("processingRevision" >= 0);
