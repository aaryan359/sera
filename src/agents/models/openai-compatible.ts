import { z } from "zod";
import { ModelError, type ChatMessage, type Model, type ToolSpec } from "../llm.ts";

// Talks to any server that speaks the OpenAI chat-completions format:
// DeepSeek, NVIDIA's API catalog, OpenRouter, Groq, OpenAI itself, and so on.
// Switching model means changing three settings, not code.

export interface OpenAiCompatibleOptions {
    baseUrl: string; // for example "https://api.deepseek.com"
    apiKey: string;
    model: string;
    maxRetries?: number; // retries after a 429 or a 5xx; default 3
    fetch?: typeof fetch; // replaceable in tests
    sleep?: (ms: number) => Promise<void>; // replaceable in tests
}

// Providers only allow letters, digits, "_" and "-" in tool names, but ours contain a dot.
// So "gmail.search_threads" travels as "gmail__search_threads" and is turned back on arrival.
const DOT = "__";

function toWireName(name: string) {
    if (name.includes(DOT)) throw new Error(`tool name may not contain "${DOT}": ${name}`);
    return name.replaceAll(".", DOT);
}

function fromWireName(name: string) {
    return name.replaceAll(DOT, ".");
}

function toWireTool(tool: ToolSpec) {
    return {
        type: "function",
        function: {
            name: toWireName(tool.name),
            description: tool.description,
            parameters: tool.parameters,
        },
    };
}

function toWireMessage(message: ChatMessage) {
    switch (message.role) {
        case "tool":
            return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
        case "assistant":
            return {
                role: "assistant",
                content: message.content,
                ...(message.toolCalls?.length
                    ? {
                          tool_calls: message.toolCalls.map((call) => ({
                              id: call.id,
                              type: "function",
                              function: { name: toWireName(call.name), arguments: call.arguments },
                          })),
                      }
                    : {}),
            };
        default:
            return { role: message.role, content: message.content };
    }
}

// Checks only the parts of the reply we use. Providers add many extra fields.
const replySchema = z.object({
    choices: z
        .array(
            z.object({
                message: z.object({
                    content: z.string().nullish(),
                    tool_calls: z
                        .array(
                            z.object({
                                id: z.string(),
                                function: z.object({
                                    name: z.string(),
                                    // Some servers send the arguments as an object instead of text.
                                    arguments: z.union([
                                        z.string(),
                                        z.record(z.string(), z.unknown()),
                                    ]),
                                }),
                            }),
                        )
                        .nullish(),
                }),
            }),
        )
        .min(1),
    usage: z
        .object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
        .nullish(),
});

export function createOpenAiCompatibleModel(options: OpenAiCompatibleOptions): Model {
    const send = options.fetch ?? fetch;
    const sleep =
        options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const maxRetries = options.maxRetries ?? 3;
    const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    return {
        async chat(request) {
            const body = JSON.stringify({
                model: options.model,
                messages: request.messages.map(toWireMessage),
                ...(request.tools.length > 0
                    ? { tools: request.tools.map(toWireTool), tool_choice: "auto" }
                    : {}),
            });

            for (let attempt = 0; ; attempt++) {
                const response = await send(url, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        authorization: `Bearer ${options.apiKey}`,
                    },
                    body,
                });

                // Too many requests, or a server error: wait and try again, up to maxRetries times.
                const retryable = response.status === 429 || response.status >= 500;
                if (retryable && attempt < maxRetries) {
                    await sleep(waitMs(response, attempt));
                    continue;
                }
                if (!response.ok) {
                    const code = response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR";
                    const detail = (await response.text()).slice(0, 200);
                    throw new ModelError(
                        code,
                        `model server answered ${response.status}: ${detail}`,
                    );
                }

                const parsed = replySchema.safeParse(await response.json());
                if (!parsed.success)
                    throw new ModelError("BAD_REPLY", "the model server sent an unreadable reply");

                const message = parsed.data.choices[0]!.message;
                return {
                    content: message.content ?? null,
                    toolCalls: (message.tool_calls ?? []).map((call) => ({
                        id: call.id,
                        name: fromWireName(call.function.name),
                        arguments:
                            typeof call.function.arguments === "string"
                                ? call.function.arguments
                                : JSON.stringify(call.function.arguments),
                    })),
                    usage: {
                        inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
                        outputTokens: parsed.data.usage?.completion_tokens ?? 0,
                    },
                };
            }
        },
    };
}

// Use the server's Retry-After if it sent one, otherwise 1s, 2s, 4s... plus a little jitter.
function waitMs(response: Response, attempt: number) {
    const seconds = Number(response.headers.get("retry-after"));
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 60) * 1000;
    return 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
}
