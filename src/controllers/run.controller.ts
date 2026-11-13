import type { Response } from "express";
import { z } from "zod";
import { MessageRole, RunStatus } from "../db/enums.ts";
import { prisma } from "../db/prisma.ts";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.ts";
import ApiResponse from "../utils/ApiResponse.ts";



export class RunController {

    static async getRun(req: AuthenticatedRequest, res: Response) {
        
        const id = z.uuid().safeParse(req.params.runId);

        if (!id.success) {
            ApiResponse.error(res, { statusCode: 400, message: "Invalid run ID" });
            return;
        }


        const run = await prisma.run.findFirst({
            where: { id: id.data, userId: req.user!.id },
            select: {
                id: true,
                conversationId: true,
                requestMessageId: true,
                status: true,
                errorCode: true,
                createdAt: true,
                statusChangedAt: true,
                completedAt: true,
                toolCalls: {
                    orderBy: { startedAt: "asc" },
                    select: {
                        toolName: true,
                        status: true,
                        errorCode: true,
                        startedAt: true,
                        finishedAt: true,
                    },
                },
                requestMessage: { select: { createdAt: true } },
                transitions: {
                    where: { toStatus: RunStatus.COMPLETED },
                    orderBy: { version: "desc" },
                    take: 1,
                    select: { createdAt: true },
                },
                events: {
                    where: { type: "ANSWER_SAVED" },
                    orderBy: { sequence: "desc" },
                    take: 1,
                    select: { metadata: true },
                },
            },
        });
        if (!run) {
            ApiResponse.error(res, { statusCode: 404, message: "Run not found" });
            return;
        }

        const { events, requestMessage, transitions, ...details } = run;
        const result = z.object({ messageId: z.uuid() }).safeParse(events[0]?.metadata);
        const answerFields = { id: true, content: true, createdAt: true } as const;
        let answer = run.status === RunStatus.COMPLETED && result.success
            ? await prisma.message.findFirst({
                where: {
                    id: result.data.messageId,
                    conversationId: run.conversationId,
                    role: MessageRole.ASSISTANT,
                },
                select: answerFields,
            })
            : null;

        // Older runs had no answer event. Only match an unambiguous single-run chat.
        if (!answer && !events.length && run.status === RunStatus.COMPLETED && run.completedAt) {
            const runCount = await prisma.run.count({ where: { conversationId: run.conversationId } });
            if (runCount === 1) {
                const messages = await prisma.message.findMany({
                    where: {
                        conversationId: run.conversationId,
                        role: MessageRole.ASSISTANT,
                        createdAt: {
                            gte: requestMessage.createdAt,
                            lte: transitions[0]?.createdAt ?? run.completedAt,
                        },
                    },
                    select: answerFields,
                    take: 2,
                });
                if (messages.length === 1) answer = messages[0]!;
            }
        }

        ApiResponse.success(res, { data: { run: details, answer } });
    }

    static async cancelRun(req: AuthenticatedRequest, res: Response) {

        const id = z.uuid().safeParse(req.params.runId);


        if (!id.success) {
            ApiResponse.error(res, { statusCode: 400, message: "Invalid run ID" });
            return;
        }


        const result = await prisma.$transaction(async (tx) => {

            const run = await tx.run.findFirst({
                where: { 
                    id: id.data, 
                    userId: req.user!.id 
                },
            });


            if (!run) return { 
                code: 404, 
                message: "Run not found" 
            };



            if (run.status === RunStatus.CANCELLED) return { 
                runId: run.id, 
                status: run.status 
            };


            if (run.status !== RunStatus.QUEUED && run.status !== RunStatus.RUNNING) {
                return { 
                    code: 409, 
                    message: "This run cannot be cancelled in its current state" 
                };
            }

            const now = new Date();

            const updated = await tx.run.updateMany({
                where: { 
                    id: run.id, 
                    stateVersion: run.stateVersion, 
                    status: run.status 
                },
                data: {
                    status: RunStatus.CANCELLED,
                    stateVersion: { increment: 1 },
                    statusChangedAt: now,
                    completedAt: now,
                    leaseOwner: null,
                    leaseExpiresAt: null,
                    nextAttemptAt: null,
                },
            });


            if (updated.count !== 1)
                return { 
                    code: 409, 
                    message: "Run changed; retry cancellation" 
                };

            await tx.runTransition.create({
                data: {
                    runId: run.id,
                    version: run.stateVersion + 1,
                    fromStatus: run.status,
                    toStatus: RunStatus.CANCELLED,
                    reasonCode: "USER_CANCELLED",
                },
            });


            return { 
                runId: run.id, 
                status: RunStatus.CANCELLED 
            };
            
        });

        if ("code" in result) {

            ApiResponse.error(res, { 
                statusCode: result.code,
                message: result.message
             });
             
            return;
        }
        
        ApiResponse.success(res, 
            {
                 message: "Run cancelled", 
                 data: result 
                
            });
    }
}
