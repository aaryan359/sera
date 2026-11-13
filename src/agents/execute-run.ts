import type { Run } from "@prisma/client";
import { MessageRole, RunStatus, ToolCallStatus, ToolKind } from "../db/enums.ts";
import { prisma } from "../db/prisma.ts";
import type { Context } from "../tools/index.ts";
import { AgentError, askModel } from "./agent.ts";



export async function executeRun(run: Run, ctx: Context, signal?: AbortSignal) {
    
    
    if (!run.leaseOwner || ctx.runId !== run.id) {
        throw new Error("A claimed run and matching tool context are required");
    }

    // The version fences off an older worker after a run is reclaimed.
    const ownership = {
        id: run.id,
        leaseOwner: run.leaseOwner,
        stateVersion: run.stateVersion,
        status: RunStatus.RUNNING,
    };


    const current = await prisma.run.findFirst({
        where: { ...ownership, leaseExpiresAt: { gt: new Date() } },
        include: { requestMessage: true },
    });


    if (!current) {
        throw new Error("Run is no longer owned by this worker");
    }

    const conversationId = current.conversationId;
    const workerId = run.leaseOwner;
    const control = new AbortController();
    const deadline = current.deadlineAt ?? new Date(Date.now() + 5 * 60_000);
    const remainingMs = Math.max(0, deadline.getTime() - Date.now());


    const deadlineTimer = setTimeout(
        () => {
            control.abort(new AgentError("DEADLINE_EXCEEDED", "Run deadline exceeded"));
        },
        Math.min(remainingMs, 2_147_483_647),
    );

    const executionSignal = signal ? AbortSignal.any([signal, control.signal]) : control.signal;


    async function checkRun() {
        executionSignal.throwIfAborted();
        const now = new Date();
        if (now >= deadline) {
            throw new AgentError("DEADLINE_EXCEEDED", "Run deadline exceeded");
        }
        const active = await prisma.run.updateMany({
            where: {
                ...ownership,
                leaseExpiresAt: { gt: now },
                OR: [{ deadlineAt: null }, { deadlineAt: { gt: now } }],
            },
            data: {
                lastHeartbeatAt: now,
                leaseExpiresAt: new Date(now.getTime() + 60_000),
                deadlineAt: deadline,
            },
        });



        if (active.count !== 1) {
            throw new AgentError("RUN_NOT_ACTIVE", "Run cancelled, changed or lease expired");
        }


        executionSignal.throwIfAborted();
    }

    // Detect database cancellation during an in-flight model request, too.
    let heartbeat: Promise<void> | undefined;
    
    const heartbeatTimer = setInterval(() => {
        if (heartbeat) return;
        heartbeat = checkRun()
            .catch((error) => control.abort(error))
            .finally(() => {
                heartbeat = undefined;
            });
    }, 5_000);



    // Commit the outcome, transition and optional answer together.
    async function finish(status: "COMPLETED" | "FAILED", answer?: string, errorCode?: string) {

        return prisma.$transaction(async (tx) => {
            
            const now = new Date();

            const updated = await tx.run.updateMany({
                where: {
                    ...ownership,
                    leaseExpiresAt: { gt: now },
                    ...(status === RunStatus.COMPLETED
                        ? { OR: [{ deadlineAt: null }, { deadlineAt: { gt: now } }] }
                        : {}),
                },
                data: {
                    status,
                    stateVersion: { increment: 1 },
                    statusChangedAt: now,
                    completedAt: now,
                    errorCode:
                        status === RunStatus.FAILED
                            ? (errorCode ?? "AGENT_EXECUTION_FAILED")
                            : null,
                    leaseOwner: null,
                    leaseExpiresAt: null,
                },
            });

            if (updated.count !== 1) return false;

            if (answer !== undefined) {
                const savedMessage = await tx.message.create({
                    data: {
                        conversationId,
                        role: MessageRole.ASSISTANT,
                        content: answer,
                    },
                });
                const lastEvent = await tx.runEvent.aggregate({
                    where: { runId: run.id },
                    _max: { sequence: true },
                });
                await tx.runEvent.create({
                    data: {
                        runId: run.id,
                        sequence: (lastEvent._max.sequence ?? 0) + 1,
                        type: "ANSWER_SAVED",
                        summary: "Assistant answer saved",
                        metadata: { messageId: savedMessage.id },
                    },
                });
                await tx.conversation.update({
                    where: {
                        id: conversationId,
                    },
                    data: {
                        updatedAt: now,
                    },
                });
            }

            await tx.runTransition.create({
                data: {
                    runId: run.id,
                    version: run.stateVersion + 1,
                    fromStatus: RunStatus.RUNNING,
                    toStatus: status,
                    reasonCode: status === RunStatus.COMPLETED ? "ANSWER_SAVED" : "AGENT_ERROR",
                    workerId,
                },
            });
            return true;
        });
    }

    try {
        

        const answer = await askModel(current.requestMessage.content, ctx, {
            signal: executionSignal,
            checkRun,
            async onToolCall(entry) {
                await prisma.toolCall.create({
                    data: {
                        runId: run.id,
                        toolName: entry.name,
                        kind: ToolKind.READ,
                        status: entry.errorCode ? ToolCallStatus.FAILED : ToolCallStatus.SUCCEEDED,
                        errorCode: entry.errorCode,
                        startedAt: entry.startedAt,
                        finishedAt: entry.finishedAt,
                    },
                });
            },
        });


        await checkRun();


        if (!(await finish(RunStatus.COMPLETED, answer))) {
            throw new AgentError("RUN_NOT_ACTIVE", "Run changed before its answer could be saved");
        }


        return answer;


    } catch (error) {
        
        const failure = executionSignal.aborted ? executionSignal.reason : error;
        const code = failure instanceof AgentError ? failure.code : "AGENT_EXECUTION_FAILED";
        
        
        // A cancelled or reclaimed run no longer matches ownership: leave it alone.
        await finish(RunStatus.FAILED, undefined, code);
        throw failure;

    } finally {

        clearInterval(heartbeatTimer);
        clearTimeout(deadlineTimer);

        await heartbeat;
    }
}
