import apiClient from "../config/client";
import type { ChatRunResult, ChatSubmission, SavedChatMessage } from "../interfaces/chat";

interface ApiResult<T> {
    success: boolean;
    data: T;
}

export const ChatService = {
    async sendMessage(message: string, conversationId: string | null): Promise<ChatSubmission> {
        if (conversationId) {
            const response = await apiClient.post<
                ApiResult<{
                    message: SavedChatMessage;
                    runId: string;
                }>
            >(`/api/v1/conversations/${conversationId}/messages`, { message });
            return { ...response.data.data, conversationId };
        }

        const response = await apiClient.post<
            ApiResult<{
                conversation: { id: string; messages: SavedChatMessage[] };
                runId: string;
            }>
        >("/api/v1/conversations", { message });
        const { conversation, runId } = response.data.data;
        const savedMessage = conversation.messages[0];
        if (!savedMessage) throw new Error("The server did not return the saved message.");
        return { conversationId: conversation.id, message: savedMessage, runId };
    },

    async getRun(runId: string, signal?: AbortSignal) {
        const response = await apiClient.get<ApiResult<ChatRunResult>>(`/api/v1/runs/${runId}`, {
            signal,
        });
        return response.data.data;
    },
};
