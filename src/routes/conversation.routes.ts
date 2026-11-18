import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { ConversationController } from "../controllers/conversation.controller.ts";

const conversationRouter = Router();
conversationRouter.use(requireAuth);

// /api/v1/conversations
conversationRouter.post("/", ConversationController.startConversation); // Create a conversation with its first message.
conversationRouter.get("/", ConversationController.getUserConversations); // List conversations.
conversationRouter.get("/:conversationId", ConversationController.getConversationById); // Conversation details with messages.
conversationRouter.post(
    "/:conversationId/messages",
    ConversationController.sendConversationMessage,
);

// Add a message to an existing conversation.
conversationRouter.delete("/:conversationId", ConversationController.deleteConversation); // Delete history.
export default conversationRouter;
