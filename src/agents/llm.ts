// What the agent loop needs from a language model. Every model (DeepSeek, NVIDIA,
// Claude, a test double) is wrapped to look like this, so the loop never changes.

// One tool call the model asked for. `arguments` is the raw text the model wrote;
// it is NOT trusted until the tool's schema has checked it.
export interface ToolCallRequest {
    id: string;
    name: string; // for example "gmail.search_threads"
    arguments: string;
}

export type ChatMessage =
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | { role: "assistant"; content: string | null; toolCalls?: ToolCallRequest[] }
    | { role: "tool"; toolCallId: string; content: string };

// A tool as the model sees it: a name, a description, and a JSON schema for the arguments.
export interface ToolSpec {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface Usage {
    inputTokens: number;
    outputTokens: number;
}

export interface ChatRequest {
    messages: ChatMessage[];
    tools: ToolSpec[];
}

export interface ModelReply {
    content: string | null;
    toolCalls: ToolCallRequest[];
    usage: Usage;
}

export interface Model {
    chat(request: ChatRequest): Promise<ModelReply>;
}

export type ModelErrorCode = "RATE_LIMITED" | "PROVIDER_ERROR" | "BAD_REPLY";

// The model could not give a usable reply. The loop does not catch this:
// the run fails or is retried later, it is not something the model can fix.
export class ModelError extends Error {
    readonly code: ModelErrorCode;

    constructor(code: ModelErrorCode, message: string) {
        super(message);
        this.name = "ModelError";
        this.code = code;
    }
}
