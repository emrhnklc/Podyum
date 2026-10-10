-- Bildirimler: gruplama/aktör alanları, kurulum ve oturuma bağlı cihaz kaydı, oyun bildirimi tercihi.

-- DeviceToken şimdiye kadar hiçbir uçtan yazılmadı; eski satırlar yeni zorunlu
-- kurulum/oturum bağlarını karşılayamaz.
DELETE FROM "DeviceToken";

-- DropIndex
DROP INDEX "DeviceToken_userId_idx";

-- DropIndex
DROP INDEX "Notification_userId_createdAt_id_idx";

-- AlterTable
ALTER TABLE "DeviceToken" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "installationId" UUID NOT NULL,
ADD COLUMN     "sessionId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "activityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "actorId" UUID,
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 1;

UPDATE "Notification" SET "activityAt" = "createdAt";

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "gameNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_installationId_key" ON "DeviceToken"("installationId");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_updatedAt_idx" ON "DeviceToken"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "DeviceToken_sessionId_idx" ON "DeviceToken"("sessionId");

-- CreateIndex
CREATE INDEX "Notification_userId_activityAt_id_idx" ON "Notification"("userId", "activityAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_resourceId_idx" ON "Notification"("userId", "type", "resourceId");

-- CreateIndex
CREATE INDEX "Notification_actorId_idx" ON "Notification"("actorId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma şemasında ifade edilemeyen kurallar.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_count_positive" CHECK ("count" >= 1);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actor_not_recipient" CHECK ("actorId" IS NULL OR "actorId" <> "userId");
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_platform_known" CHECK ("platform" IN ('ios', 'android'));
