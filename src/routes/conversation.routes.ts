import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const conversationRouter = Router();
conversationRouter.use(requireAuth);

// /v1/api/conversations
conversationRouter.post("/", notImplemented); // Start a conversation.
conversationRouter.get("/", notImplemented); // List conversations.
conversationRouter.get("/:conversationId", notImplemented); // Conversation details.
conversationRouter.get("/:conversationId/messages", notImplemented); // Message history.
conversationRouter.post("/:conversationId/messages", notImplemented); // Request or clarification.
conversationRouter.delete("/:conversationId", notImplemented); // Delete history.

export default conversationRouter;
