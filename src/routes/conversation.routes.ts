import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { ConversationController } from "../controllers/conversation.controller.ts";

const conversationRouter = Router();
conversationRouter.use(requireAuth);

// /v1/api/conversations
conversationRouter.post("/", ConversationController.startConversation); // Create a conversation with its first message.
conversationRouter.get("/", ConversationController.getUserConversations); // List conversations.
conversationRouter.get("/:conversationId", ConversationController.getConversationById); // Conversation details.
conversationRouter.get("/:conversationId/messages", ConversationController.getConversationMessages); // Message history.
conversationRouter.post(
    "/:conversationId/messages",
    ConversationController.sendConversationMessage,
); // Add a message to an existing conversation.
conversationRouter.delete("/:conversationId", ConversationController.deleteConversation); // Delete history.

export default conversationRouter;
