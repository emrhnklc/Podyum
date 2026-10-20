CREATE TABLE "MaintenanceState" (
  "key" VARCHAR(40) PRIMARY KEY,
  "runToken" UUID,
  "leaseUntil" TIMESTAMPTZ(3),
  "startedAt" TIMESTAMPTZ(3),
  "finishedAt" TIMESTAMPTZ(3),
  "lastSuccessAt" TIMESTAMPTZ(3),
  "lastFailureAt" TIMESTAMPTZ(3),
  "status" VARCHAR(20) NOT NULL DEFAULT 'IDLE',
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "fileCursors" JSONB,
  CONSTRAINT "MaintenanceState_failures_check" CHECK ("consecutiveFailures" >= 0),
  CONSTRAINT "MaintenanceState_status_check" CHECK ("status" IN ('IDLE','RUNNING','SUCCEEDED','PARTIAL','FAILED')),
  CONSTRAINT "MaintenanceState_lease_check" CHECK (("runToken" IS NULL) = ("leaseUntil" IS NULL))
);
