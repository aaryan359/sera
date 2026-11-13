import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { z } from "zod";
import { config } from "../config.ts";
import { registry, callTool, type Context } from "../tools/index.ts";
import { groq } from "./models/groq.ts";
import { ToolError } from "../tools/safety.ts";
import { SYSTEM_PROMPT } from "../prompts/system.ts";


// find out all the tools
const enabledTools = registry
    .forModel()
    .filter((tool) => ["web.search", "web.fetch_page"].includes(tool.name));




const tools = enabledTools.map((tool) => {
    const { $schema, ...parameters } = z.toJSONSchema(tool.input, {
        io: "input",
    });

    return {
        type: "function" as const,
        function: {
            name: tool.name.replaceAll(".", "__"),
            description: tool.description,
            parameters,
        },
    };
});




// exectute a tool and return the result
async function executeTool(name: string, argumentsJson: string, ctx: Context) {
    const tool = enabledTools.find((tool) => tool.name.replaceAll(".", "__") === name);

    if (!tool) {
        throw new Error("Requested tool is not enabled");
    }

    const args = JSON.parse(argumentsJson);

    return callTool(registry, tool.name, args, ctx);
}






export class AgentError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "AgentError";
    }
}


interface AgentOptions {
    maxModelCalls?: number;
    maxToolCalls?: number;
    maxConsecutiveErrors?: number;
    signal?: AbortSignal;
    checkRun?: () => Promise<void>;
    onToolCall?: (entry: {
        name: string;
        startedAt: Date;
        finishedAt: Date;
        errorCode: string | null;
    }) => Promise<void>;
}




export async function askModel(message: string, ctx: Context, options: AgentOptions = {}) {
    
    const maxModelCalls = options.maxModelCalls ?? 20;
    const maxToolCalls = options.maxToolCalls ?? 40;
    const maxErrors = options.maxConsecutiveErrors ?? 3;
    
    for (const limit of [maxModelCalls, maxToolCalls, maxErrors]) {
        if (!Number.isSafeInteger(limit) || limit <= 0) {
            throw new Error("Agent limits must be positive integers");
        }
    }

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: `${SYSTEM_PROMPT}\nCurrent UTC date and time: ${ctx.now().toISOString()}` },
        { role: "user", content: message },
    ];


    let modelCalls = 0;
    let toolCalls = 0;
    let errorStreak = 0;


    async function checkActive() {
        options.signal?.throwIfAborted();
        await options.checkRun?.();
        options.signal?.throwIfAborted();
    }

    while (true) {

        await checkActive();

        if (modelCalls >= maxModelCalls) {
            throw new AgentError("MODEL_CALL_LIMIT", "Agent model-call budget exhausted");
        }

        modelCalls++;

        const completion = await groq.chat.completions.create(
            {
                model: config.groqModel,
                messages,
                tools,
                tool_choice: "auto",
                reasoning_effort: "low",
                max_completion_tokens: 2048,
            },
            // Retries also spend quota. Keep each counted model call to one attempt.
            { signal: options.signal, timeout: 30_000, maxRetries: 0 },
        );

        await checkActive();

        const choice = completion.choices[0];
        const reply = choice?.message;


        if (!reply) throw new AgentError("EMPTY_RESPONSE", "Groq returned no response");

        if (choice.finish_reason === "length") {
            throw new AgentError("OUTPUT_LIMIT", "Groq response exceeded the token limit");
        }

        if (!reply.tool_calls?.length) {

            const answer = reply.content?.trim();

            if (!answer || choice.finish_reason !== "stop") {
                throw new AgentError("INVALID_RESPONSE", "Groq returned no complete answer");
            }

            return answer;
        }

        messages.push(reply);


        for (const call of reply.tool_calls) {

            await checkActive();

            if (toolCalls >= maxToolCalls) {
                throw new AgentError("TOOL_CALL_LIMIT", "Agent tool-call budget exhausted");
            }

            toolCalls++;

            let result: unknown;
            let errorCode: string | null = null;
            const startedAt = new Date();
            const toolName = call.function.name.replaceAll("__", ".");
            console.log(`[${ctx.runId}] Calling ${toolName}`);

            try {
                result = await executeTool(call.function.name, call.function.arguments, ctx);
                errorStreak = 0;
            } catch (error) {
                errorStreak++;
                errorCode = error instanceof ToolError ? error.code :
                    error instanceof SyntaxError ? "INVALID_INPUT" : "TOOL_FAILED";
                result = {
                    error: errorCode,
                };
            }

            console.log(`[${ctx.runId}] ${toolName}: ${errorCode ?? "SUCCEEDED"}`);
            await options.onToolCall?.({
                name: toolName,
                startedAt,
                finishedAt: new Date(),
                errorCode,
            });
            if (errorStreak >= maxErrors) {
                throw new AgentError("TOOL_ERROR_LIMIT", "Too many consecutive tool failures");
            }

            await checkActive();


            messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result),
            });

        }
    }
}
