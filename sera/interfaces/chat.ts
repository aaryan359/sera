/** Shared UI message shape. Assistant text can contain Markdown. */
export interface ChatMessage {
    id: string;
    role: "assistant" | "user";
    text: string;
}

export interface SavedChatMessage {
    id: string;
    role: "USER" | "ASSISTANT";
    content: string;
    createdAt: string;
}

export interface ConversationSummary {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SavedConversation extends ConversationSummary {
    messages: SavedChatMessage[];
}

export interface ConversationHistory {
    conversation: SavedConversation;
    nextCursor: string | null;
    pendingRun: { id: string; status: RunStatus } | null;
}

export type RunStatus =
    | "QUEUED"
    | "PLANNING"
    | "RUNNING"
    | "EVALUATING"
    | "REFLECTING"
    | "REPLANNING"
    | "NEEDS_CLARIFICATION"
    | "AWAITING_APPROVAL"
    | "EXECUTING"
    | "VERIFYING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "OUTCOME_UNKNOWN";

export interface ChatSubmission {
    conversationId: string;
    message: SavedChatMessage;
    runId: string;
}

export interface ChatRunResult {
    run: {
        id: string;
        status: RunStatus;
        errorCode: string | null;
    };
    answer: Pick<SavedChatMessage, "id" | "content" | "createdAt"> | null;
}
