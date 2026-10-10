-- SQL CHECK, NULL sonucunu da kabul eder. Açık NOT NULL koşulu, kısmi
-- inceleme metadatasının NULL mantığıyla ilk kısıtı aşmasını engeller.
ALTER TABLE "Report" DROP CONSTRAINT "Report_review_consistent";
ALTER TABLE "Report" ADD CONSTRAINT "Report_review_consistent" CHECK (
  ("reviewedAt" IS NULL AND "reviewedById" IS NULL AND "decisionNote" IS NULL) OR
  ("status" <> 'OPEN' AND "reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL
    AND "decisionNote" IS NOT NULL AND length(btrim("decisionNote")) >= 3)
);
