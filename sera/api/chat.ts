import apiClient from "../config/client";
import type {
    ChatRunResult,
    ChatSubmission,
    ConversationSummary,
    ConversationHistory,
} from "../interfaces/chat";

interface ApiResult<T> {
    success: boolean;
    data: T;
}

export const ChatService = {

    async getUserConversations(limit = 20) {
        const response = await apiClient.get<ApiResult<{ conversations: ConversationSummary[] }>>(
            "/api/v1/conversations",
            { params: { limit } },
        );
        return response.data.data;
    },

    async getConversationById(conversationId: string, before?: string) {
        const response = await apiClient.get<ApiResult<ConversationHistory>>(
            `/api/v1/conversations/${conversationId}`,
            { params: { limit: 20, before } },
        );
        return response.data.data;
    },

    async deleteConversation(conversationId: string) {
        const response = await apiClient.delete(
            `/api/v1/conversations/${conversationId}`,
        );
        return response.data.data;
    },

    async sendMessage(message: string, conversationId: string | null): Promise<ChatSubmission> {

        // if conversation already exists
        if (conversationId) {
            const response = await apiClient.post(`/api/v1/conversations/${conversationId}/messages`, { message });
            return { ...response.data.data, conversationId };
        }



        const response = await apiClient.post("/api/v1/conversations", { message });

        const { conversation, runId } = response.data.data;
        const savedMessage = conversation.messages[0];

        if (!savedMessage) throw new Error("The server did not return the saved message.");

        return { conversationId: conversation.id, message: savedMessage, runId };
    },

    async getRun(runId: string) {
        const response = await apiClient.get<ApiResult<ChatRunResult>>(`/api/v1/runs/${runId}`);
        return response.data.data;
    },
};
