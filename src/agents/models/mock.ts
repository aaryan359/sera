import type { ChatRequest, Model, ToolCallRequest, Usage } from "../llm.ts";

// A fake model for tests and for running Sera with no API key.
// It replays a fixed script: reply 1 on the first call, reply 2 on the second, and so on.

export interface ScriptStep {
    content?: string | null;
    toolCalls?: ToolCallRequest[];
    usage?: Usage;
}

let nextId = 0;

// A tool call as a model would write it. `args` may be an object or raw text (to test bad JSON).
export function toolCall(name: string, args: unknown) {
    return {
        id: `call_${++nextId}`,
        name,
        arguments: typeof args === "string" ? args : JSON.stringify(args),
    };
}

export function scriptedModel(script: ScriptStep[]): Model & { requests: ChatRequest[] } {
    const requests: ChatRequest[] = [];
    return {
        requests,
        async chat(request) {
            requests.push(structuredClone(request)); // keep what the model saw at this moment
            const step = script[requests.length - 1];
            if (!step) throw new Error("the mock model ran out of scripted replies");
            return {
                content: step.content ?? null,
                toolCalls: step.toolCalls ?? [],
                usage: step.usage ?? { inputTokens: 100, outputTokens: 20 },
            };
        },
    };
}
