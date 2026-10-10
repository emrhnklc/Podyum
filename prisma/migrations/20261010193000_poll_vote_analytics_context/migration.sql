-- Önceki oyların izin anı bilinmiyor; geriye dönük izin/snapshot üretilmez.
ALTER TABLE "PollVote"
  ADD COLUMN "analyticsConsentAtVote" TIMESTAMPTZ(3),
  ADD COLUMN "analyticsRevisionAtVote" INTEGER,
  ADD CONSTRAINT "poll_vote_analytics_context" CHECK (
    ("analyticsConsentAtVote" IS NULL AND "analyticsRevisionAtVote" IS NULL)
    OR ("analyticsConsentAtVote" IS NOT NULL AND "analyticsRevisionAtVote" IS NOT NULL AND "analyticsRevisionAtVote" >= 0)
  );
