-- Özel lobi: herkese açık seçeneği. Planlı başlangıç mevcut "startsAt" sütununu kullanır.
ALTER TABLE "GameSession" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "GameSession_isPublic_phase_idx" ON "GameSession"("isPublic", "phase");
