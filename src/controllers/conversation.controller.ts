import type { Response } from "express";
import { z } from "zod";
import { MessageRole, RunStatus } from "../db/enums.ts";
import { prisma } from "../db/prisma.ts";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.ts";
import ApiResponse from "../utils/ApiResponse.ts";

export class ConversationController {


    static async startConversation(req: AuthenticatedRequest, res: Response) {
        const parsed = z
            .object({
                message: z.string().trim().min(1).max(20_000),
            })
            .safeParse(req.body);

        if (!parsed.success) {
            ApiResponse.error(res, {
                statusCode: 400,
                message: "Provide a message between 1 and 20000 characters",
                error: "INVALID_INPUT",
            });
            return;
        }

        const data = await prisma.$transaction(async (tx) => {

            const conversation = await tx.conversation.create({
                data: {
                    userId: req.user!.id,
                    messages: {
                        create: { role: MessageRole.USER, content: parsed.data.message },
                    },
                },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    updatedAt: true,
                    messages: true,
                },
            });

            const run = await tx.run.create({
                data: {
                    userId: req.user!.id,
                    conversationId: conversation.id,
                    requestMessageId: conversation.messages[0]!.id,
                    status: RunStatus.QUEUED,
                },
                select: { id: true, status: true },
            });

            return { conversation, runId: run.id, status: run.status };
        });

        ApiResponse.success(res, {
            statusCode: 201,
            message: "Conversation, message and run created",
            data,
        });
    }




    static async getUserConversations(req: AuthenticatedRequest, res: Response) {
        const parsed = z.object({
            limit: z.coerce.number().int().min(1).max(50).default(20),
        }).safeParse(req.query);
        if (!parsed.success) {
            ApiResponse.error(res, { statusCode: 400, message: "Provide a limit between 1 and 50" });
            return;
        }

        const conversations = await prisma.conversation.findMany({
            where: { userId: req.user!.id },
            select: { id: true, title: true, createdAt: true, updatedAt: true },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: parsed.data.limit,
        });
        ApiResponse.success(res, { data: { conversations } });
    }

    static async getConversationById(req: AuthenticatedRequest, res: Response) {
        const parsed = z.object({
            conversationId: z.uuid(),
            limit: z.coerce.number().int().min(1).max(50).default(20),
            before: z.uuid().optional(),
        }).safeParse({ ...req.query, conversationId: req.params.conversationId });

        if (!parsed.success) {
            ApiResponse.error(res, { statusCode: 400, message: "Provide a valid conversation ID, message cursor, and limit (1–50)" });
            return;
        }

        const { conversationId, limit, before } = parsed.data;

        const conversation = await prisma.conversation.findUnique({
            where: { id_userId: { id: conversationId, userId: req.user!.id } },
            select: {
                id: true, title: true, createdAt: true, updatedAt: true,
                runs: {
                    where: { status: { notIn: [RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED, RunStatus.OUTCOME_UNKNOWN] } },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    take: 1,
                    select: { id: true, status: true },
                },
            },
        });
        if (!conversation) {
            ApiResponse.error(res, { statusCode: 404, message: "Conversation not found", error: "NOT_FOUND" });
            return;
        }

        // A cursor must belong to this conversation, not another user's history.
        const cursor = before ? await prisma.message.findFirst({
            where: { id: before, conversationId },
            select: { id: true, createdAt: true },
        }) : null;
        if (before && !cursor) {
            ApiResponse.error(res, { statusCode: 400, message: "Invalid message cursor" });
            return;
        }

        const page = await prisma.message.findMany({
            where: {
                conversationId,
                ...(cursor ? {
                    OR: [
                        { createdAt: { lt: cursor.createdAt } },
                        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                    ]
                } : {}),
            },
            select: { id: true, role: true, content: true, createdAt: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
        });
        const messages = page.slice(0, limit).reverse();
        const { runs, ...details } = conversation;
        ApiResponse.success(res, {
            data: {
                conversation: { ...details, messages },
                nextCursor: page.length > limit ? messages[0]!.id : null,
                pendingRun: runs[0] ?? null,
            }
        });
    }

    static async sendConversationMessage(req: AuthenticatedRequest, res: Response) {
        const parsed = z
            .object({
                conversationId: z.uuid(),
                message: z.string().trim().min(1).max(20_000),
            })
            .safeParse({ conversationId: req.params.conversationId, message: req.body?.message });

        if (!parsed.success) {
            ApiResponse.error(res, {
                statusCode: 400,
                message:
                    "Provide a valid conversation ID and a message between 1 and 20000 characters",
                error: "INVALID_INPUT",
            });
            return;
        }

        const { conversationId, message } = parsed.data;

        const conversation = await prisma.conversation.findUnique({
            where: {
                id_userId: { id: conversationId, userId: req.user!.id },
            },

            select: {
                id: true,
            },
        });

        if (!conversation) {
            ApiResponse.error(res, {
                statusCode: 404,
                message: "Conversation not found",
                error: "NOT_FOUND",
            });
            return;
        }

        const data = await prisma.$transaction(async (tx) => {
            await tx.conversation.update({
                where: { id_userId: { id: conversationId, userId: req.user!.id } },
                data: { updatedAt: new Date() },
            });
            const savedMessage = await tx.message.create({
                data: { conversationId, role: MessageRole.USER, content: message },
            });

            const run = await tx.run.create({
                data: {
                    userId: req.user!.id,
                    conversationId,
                    requestMessageId: savedMessage.id,
                    status: RunStatus.QUEUED,
                },
                select: { id: true, status: true },
            });

            return { message: savedMessage, runId: run.id, status: run.status };
        });

        ApiResponse.success(res, {
            statusCode: 201,
            message: "Message and run created",
            data,
        });
    }



    static deleteConversation(_req: AuthenticatedRequest, res: Response) {
        ApiResponse.error(res, {
            statusCode: 501,
            message: "This endpoint is not implemented yet",
            error: "NOT_IMPLEMENTED",
        });
    }
}
