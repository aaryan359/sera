import type { Request, Response } from "express";
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





    static getUserConversations(_req: Request, res: Response) {
        ApiResponse.error(res, {
            statusCode: 501,
            message: "This endpoint is not implemented yet",
            error: "NOT_IMPLEMENTED",
        });
    }

    static getConversationById(_req: Request, res: Response) {
        ApiResponse.error(res, {
            statusCode: 501,
            message: "This endpoint is not implemented yet",
            error: "NOT_IMPLEMENTED",
        });
    }

    static getConversationMessages(_req: Request, res: Response) {
        ApiResponse.error(res, {
            statusCode: 501,
            message: "This endpoint is not implemented yet",
            error: "NOT_IMPLEMENTED",
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

    static deleteConversation(_req: Request, res: Response) {
        ApiResponse.error(res, {
            statusCode: 501,
            message: "This endpoint is not implemented yet",
            error: "NOT_IMPLEMENTED",
        });
    }
}
