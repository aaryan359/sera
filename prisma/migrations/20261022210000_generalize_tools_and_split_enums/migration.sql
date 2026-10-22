-- Runs may use several provider accounts. Preserve the former single connection
-- before dropping its column; composite keys keep every link user-scoped.
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_runId_connectionId_fkey";
ALTER TABLE "Run" DROP CONSTRAINT "Run_connectionId_userId_fkey";
DROP INDEX "Run_id_connectionId_key";
CREATE UNIQUE INDEX "Run_id_userId_key" ON "Run"("id", "userId");

CREATE TABLE "RunConnection" (
    "runId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RunConnection_pkey" PRIMARY KEY ("runId", "connectionId")
);
CREATE INDEX "RunConnection_connectionId_userId_idx" ON "RunConnection"("connectionId", "userId");

INSERT INTO "RunConnection" ("runId", "connectionId", "userId")
SELECT "id", "connectionId", "userId"
FROM "Run"
WHERE "connectionId" IS NOT NULL;

ALTER TABLE "ToolCall" RENAME COLUMN "name" TO "toolName";
ALTER TABLE "ToolCall"
    ADD COLUMN "connectionId" TEXT,
    ADD COLUMN "toolVersion" INTEGER NOT NULL DEFAULT 1;
UPDATE "ToolCall" AS call
SET "connectionId" = run."connectionId"
FROM "Run" AS run
WHERE call."runId" = run."id" AND run."connectionId" IS NOT NULL;

-- Translate existing approved actions rather than discarding their meaning.
ALTER TABLE "Approval"
    ADD COLUMN "toolName" TEXT,
    ADD COLUMN "toolVersion" INTEGER NOT NULL DEFAULT 1,
    ALTER COLUMN "connectionId" DROP NOT NULL;
UPDATE "Approval"
SET "toolName" = CASE "actionType"
    WHEN 'GMAIL_SEND_REPLY' THEN 'gmail.sendReply'
    WHEN 'CALENDAR_CREATE_EVENT' THEN 'calendar.createEvent'
END;
ALTER TABLE "Approval" ALTER COLUMN "toolName" SET NOT NULL;
ALTER TABLE "Approval" DROP COLUMN "actionType";
DROP TYPE "ActionType";

-- Provider names are also extensible (e.g. a future booking connector).
ALTER TABLE "Connection" ALTER COLUMN "provider" TYPE TEXT USING "provider"::TEXT;
DROP TYPE "ConnectionProvider";

ALTER TABLE "Run" DROP COLUMN "connectionId";

ALTER TABLE "RunConnection" ADD CONSTRAINT "RunConnection_runId_userId_fkey"
    FOREIGN KEY ("runId", "userId") REFERENCES "Run"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunConnection" ADD CONSTRAINT "RunConnection_connectionId_userId_fkey"
    FOREIGN KEY ("connectionId", "userId") REFERENCES "Connection"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_runId_connectionId_fkey"
    FOREIGN KEY ("runId", "connectionId") REFERENCES "RunConnection"("runId", "connectionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_runId_connectionId_fkey"
    FOREIGN KEY ("runId", "connectionId") REFERENCES "RunConnection"("runId", "connectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
