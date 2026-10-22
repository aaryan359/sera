CREATE TYPE "ToolCaller" AS ENUM ('AGENT', 'EXECUTOR', 'SYSTEM');
CREATE TYPE "ToolGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

ALTER TABLE "Run"
    ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN "stateVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
    ADD COLUMN "leaseOwner" TEXT,
    ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
    ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
    ADD CONSTRAINT "Run_retries_nonnegative" CHECK ("retryCount" >= 0 AND "maxRetries" >= 0 AND "stateVersion" >= 0),
    ADD CONSTRAINT "Run_lease_pair" CHECK (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL));

ALTER TABLE "ToolCall"
    ADD COLUMN "caller" "ToolCaller" NOT NULL DEFAULT 'AGENT',
    ADD COLUMN "approvalId" TEXT,
    ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
    ADD COLUMN "timeoutAt" TIMESTAMP(3),
    ADD CONSTRAINT "ToolCall_retries_nonnegative" CHECK ("retryCount" >= 0 AND "maxRetries" >= 0);

ALTER TABLE "ActionExecution"
    ADD COLUMN "dispatchAttemptCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "maxDispatchAttempts" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "leaseOwner" TEXT,
    ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
    ADD COLUMN "reconcileAfterAt" TIMESTAMP(3),
    ADD CONSTRAINT "ActionExecution_attempts_valid" CHECK ("dispatchAttemptCount" >= 0 AND "maxDispatchAttempts" >= 1),
    ADD CONSTRAINT "ActionExecution_lease_pair" CHECK (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL));

CREATE TABLE "ToolGrant" (
    "connectionId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolVersion" INTEGER NOT NULL,
    "status" "ToolGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ToolGrant_pkey" PRIMARY KEY ("connectionId", "toolName", "toolVersion"),
    CONSTRAINT "ToolGrant_version_positive" CHECK ("toolVersion" > 0)
);

CREATE TABLE "RunTransition" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fromStatus" "RunStatus" NOT NULL,
    "toStatus" "RunStatus" NOT NULL,
    "reasonCode" TEXT,
    "workerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunTransition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RunTransition_version_positive" CHECK ("version" > 0)
);

CREATE INDEX "RunTransition_runId_createdAt_idx" ON "RunTransition"("runId", "createdAt");
CREATE UNIQUE INDEX "RunTransition_runId_version_key" ON "RunTransition"("runId", "version");
CREATE UNIQUE INDEX "Approval_id_runId_key" ON "Approval"("id", "runId");
CREATE INDEX "Run_status_leaseExpiresAt_idx" ON "Run"("status", "leaseExpiresAt");
CREATE INDEX "Run_status_nextAttemptAt_idx" ON "Run"("status", "nextAttemptAt");

ALTER TABLE "ToolGrant" ADD CONSTRAINT "ToolGrant_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunTransition" ADD CONSTRAINT "RunTransition_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_approvalId_runId_fkey"
    FOREIGN KEY ("approvalId", "runId") REFERENCES "Approval"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;
