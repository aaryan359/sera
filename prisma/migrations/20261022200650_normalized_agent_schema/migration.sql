-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('MOCK_GOOGLE', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'PLANNING', 'RUNNING', 'EVALUATING', 'REFLECTING', 'REPLANNING', 'NEEDS_CLARIFICATION', 'AWAITING_APPROVAL', 'EXECUTING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'OUTCOME_UNKNOWN');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('PENDING', 'SATISFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('RUNNING', 'PASSED', 'RECOVERABLE_FAILURE', 'STOPPED');

-- CreateEnum
CREATE TYPE "ToolKind" AS ENUM ('READ', 'WRITE');

-- CreateEnum
CREATE TYPE "ToolCallStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "EvaluationOutcome" AS ENUM ('PASS', 'RECOVERABLE_FAILURE', 'NEEDS_USER', 'UNCERTAIN', 'HARD_FAIL');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('GMAIL_SEND_REPLY', 'CALENDAR_CREATE_EVENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PREPARED', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionScope" (
    "connectionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "ConnectionScope_pkey" PRIMARY KEY ("connectionId","scope")
);

-- CreateTable
CREATE TABLE "ConnectionCredential" (
    "connectionId" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "encryptionKeyVersion" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionCredential_pkey" PRIMARY KEY ("connectionId")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requestMessageId" TEXT NOT NULL,
    "connectionId" TEXT,
    "intent" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "goal" JSONB,
    "contextSnapshot" JSONB,
    "deadlineAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunGoal" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trial" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "TrialStatus" NOT NULL DEFAULT 'RUNNING',
    "plan" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCall" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "trialId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "ToolKind" NOT NULL,
    "status" "ToolCallStatus" NOT NULL DEFAULT 'STARTED',
    "safeInputSummary" JSONB,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "toolCallId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceResourceId" TEXT,
    "summary" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationFeedback" (
    "id" TEXT NOT NULL,
    "trialId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "outcome" "EvaluationOutcome" NOT NULL,
    "reasonCode" TEXT,
    "evaluatorVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackObservation" (
    "feedbackId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,

    CONSTRAINT "FeedbackObservation_pkey" PRIMARY KEY ("feedbackId","observationId")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "mistakenAssumption" TEXT NOT NULL,
    "nextReadOrPlanChange" TEXT NOT NULL,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "actionSnapshot" JSONB NOT NULL,
    "actionHash" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionExecution" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PREPARED',
    "idempotencyKey" TEXT NOT NULL,
    "providerRequestMarker" TEXT,
    "providerResourceId" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_id_userId_key" ON "Conversation"("id", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_id_conversationId_key" ON "Message"("id", "conversationId");

-- CreateIndex
CREATE INDEX "Connection_userId_status_idx" ON "Connection"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_provider_providerAccountId_key" ON "Connection"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_id_userId_key" ON "Connection"("id", "userId");

-- CreateIndex
CREATE INDEX "Run_userId_createdAt_idx" ON "Run"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Run_status_createdAt_idx" ON "Run"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Run_conversationId_createdAt_idx" ON "Run"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Run_id_connectionId_key" ON "Run"("id", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Run_requestMessageId_conversationId_key" ON "Run"("requestMessageId", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "RunGoal_runId_key_key" ON "RunGoal"("runId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvent_runId_sequence_key" ON "RunEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Trial_runId_number_key" ON "Trial"("runId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Trial_id_runId_key" ON "Trial"("id", "runId");

-- CreateIndex
CREATE INDEX "ToolCall_runId_startedAt_idx" ON "ToolCall"("runId", "startedAt");

-- CreateIndex
CREATE INDEX "ToolCall_trialId_idx" ON "ToolCall"("trialId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCall_id_runId_key" ON "ToolCall"("id", "runId");

-- CreateIndex
CREATE INDEX "Observation_toolCallId_observedAt_idx" ON "Observation"("toolCallId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Observation_id_runId_key" ON "Observation"("id", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationFeedback_trialId_runId_key" ON "EvaluationFeedback"("trialId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationFeedback_id_runId_key" ON "EvaluationFeedback"("id", "runId");

-- CreateIndex
CREATE INDEX "FeedbackObservation_observationId_runId_idx" ON "FeedbackObservation"("observationId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "Reflection_feedbackId_key" ON "Reflection"("feedbackId");

-- CreateIndex
CREATE INDEX "Approval_runId_createdAt_idx" ON "Approval"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_status_expiresAt_idx" ON "Approval"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionExecution_approvalId_key" ON "ActionExecution"("approvalId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionExecution_idempotencyKey_key" ON "ActionExecution"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActionExecution_providerRequestMarker_key" ON "ActionExecution"("providerRequestMarker");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionScope" ADD CONSTRAINT "ConnectionScope_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionCredential" ADD CONSTRAINT "ConnectionCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_requestMessageId_conversationId_fkey" FOREIGN KEY ("requestMessageId", "conversationId") REFERENCES "Message"("id", "conversationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_connectionId_userId_fkey" FOREIGN KEY ("connectionId", "userId") REFERENCES "Connection"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunGoal" ADD CONSTRAINT "RunGoal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEvent" ADD CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_trialId_runId_fkey" FOREIGN KEY ("trialId", "runId") REFERENCES "Trial"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_toolCallId_runId_fkey" FOREIGN KEY ("toolCallId", "runId") REFERENCES "ToolCall"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationFeedback" ADD CONSTRAINT "EvaluationFeedback_trialId_runId_fkey" FOREIGN KEY ("trialId", "runId") REFERENCES "Trial"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackObservation" ADD CONSTRAINT "FeedbackObservation_feedbackId_runId_fkey" FOREIGN KEY ("feedbackId", "runId") REFERENCES "EvaluationFeedback"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackObservation" ADD CONSTRAINT "FeedbackObservation_observationId_runId_fkey" FOREIGN KEY ("observationId", "runId") REFERENCES "Observation"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "EvaluationFeedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_runId_connectionId_fkey" FOREIGN KEY ("runId", "connectionId") REFERENCES "Run"("id", "connectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ActionExecution" ADD CONSTRAINT "ActionExecution_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
