import { z } from "zod";
import { callTool, fingerprint, ToolError, type Context, type Registry } from "../tools/safety.ts";
import type { ChatMessage, Model, ToolCallRequest, ToolSpec, Usage } from "./llm.ts";

// The agent loop: ask the model, run the tools it asks for, show it the results, repeat.
// The model never touches the outside world directly. Every call goes through callTool,
// which checks the tool exists, the arguments are valid, and the user allowed it.

// Turns our tool list into what the model sees. Only tools the model may call are listed,
// so send tools (EXECUTE) are never offered.
export function toToolSpecs(registry: Registry): ToolSpec[] {
    return registry.forModel().map((tool) => {
        const { $schema: _version, ...parameters } = z.toJSONSchema(tool.input, { io: "input" });
        return { name: tool.name, description: tool.description, parameters };
    });
}

export interface LoopInput {
    registry: Registry;
    ctx: Context;
    model: Model;
    system: string; // the instructions the model always sees first
    user: string; // the user's request
    maxSteps?: number; // most model calls in one run; default 8
    maxConsecutiveErrors?: number; // stop after this many failed tool calls in a row; default 3
}

// How the run ended.
export type Outcome =
    // The model answered in words and needs nothing more.
    | { kind: "ANSWERED"; answer: string }
    // The model prepared an action. Nothing was sent. The run now waits for the user.
    | { kind: "AWAITING_APPROVAL"; approvalId: string; preview: unknown }
    // The loop gave up before an answer, so the caller can retry or ask the user.
    | { kind: "STOPPED"; reason: "MAX_STEPS" | "TOO_MANY_ERRORS" };

// One line per tool call, for logs and later for escalation decisions.
export interface TraceEntry {
    step: number;
    tool: string;
    ok: boolean;
    errorCode?: string;
}

export interface LoopResult {
    outcome: Outcome;
    steps: number; // model calls used
    usage: Usage; // tokens, summed over all model calls
    trace: TraceEntry[];
    messages: ChatMessage[]; // the full conversation, including tool results
}

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_MAX_ERRORS = 3;

export async function runAgentLoop(input: LoopInput): Promise<LoopResult> {
    const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;
    const maxErrors = input.maxConsecutiveErrors ?? DEFAULT_MAX_ERRORS;
    const tools = toToolSpecs(input.registry);

    const messages: ChatMessage[] = [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
    ];
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    const trace: TraceEntry[] = [];
    const succeededCalls = new Set<string>(); // exact calls that already worked this run
    let errorStreak = 0;
    let steps = 0;

    const finish = (outcome: Outcome): LoopResult => ({ outcome, steps, usage, trace, messages });

    while (steps < maxSteps) {
        steps++;
        const reply = await input.model.chat({ messages, tools });
        usage.inputTokens += reply.usage.inputTokens;
        usage.outputTokens += reply.usage.outputTokens;

        messages.push({
            role: "assistant",
            content: reply.content,
            ...(reply.toolCalls.length > 0 ? { toolCalls: reply.toolCalls } : {}),
        });

        // No tool calls means the model is done talking.
        if (reply.toolCalls.length === 0) {
            return finish({ kind: "ANSWERED", answer: reply.content ?? "" });
        }

        for (const call of reply.toolCalls) {
            const result = await attempt(call, input, succeededCalls);
            trace.push({
                step: steps,
                tool: call.name,
                ok: result.ok,
                ...(result.ok ? {} : { errorCode: result.code }),
            });

            if (result.ok) {
                errorStreak = 0;
                messages.push({
                    role: "tool",
                    toolCallId: call.id,
                    content: JSON.stringify(result.value),
                });
                // A prepared action ends the loop. The user decides; the model does not continue.
                if (result.proposal) {
                    return finish({ kind: "AWAITING_APPROVAL", ...result.proposal });
                }
            } else {
                errorStreak++;
                // The error goes back to the model so it can correct the call.
                messages.push({
                    role: "tool",
                    toolCallId: call.id,
                    content: JSON.stringify({ error: result.code, message: result.message }),
                });
                if (errorStreak >= maxErrors)
                    return finish({ kind: "STOPPED", reason: "TOO_MANY_ERRORS" });
            }
        }
    }

    return finish({ kind: "STOPPED", reason: "MAX_STEPS" });
}

type Attempt =
    | { ok: true; value: unknown; proposal?: { approvalId: string; preview: unknown } }
    | { ok: false; code: string; message: string };

// Runs one tool call the model asked for. Never throws: a failure becomes a result
// the model can read and fix.
async function attempt(
    call: ToolCallRequest,
    input: LoopInput,
    done: Set<string>,
): Promise<Attempt> {
    let args: unknown;
    try {
        args = call.arguments.trim() === "" ? {} : JSON.parse(call.arguments);
    } catch {
        return { ok: false, code: "INVALID_INPUT", message: "the arguments were not valid JSON" };
    }

    // The same call that already worked will give the same answer. Make the model move on.
    const key = fingerprint(input.ctx.connectionId, call.name, args);
    if (done.has(key)) {
        return {
            ok: false,
            code: "REPEATED_CALL",
            message:
                "you already made this exact call; use its earlier result or try something different",
        };
    }

    try {
        const value = await callTool(input.registry, call.name, args, input.ctx);
        done.add(key);
        const proposal = readProposal(input.registry, call.name, value);
        return { ok: true, value, ...(proposal ? { proposal } : {}) };
    } catch (err) {
        if (err instanceof ToolError) return { ok: false, code: err.code, message: err.message };
        // A bug or an outage inside a tool. Tell the model it failed, but not the details.
        return { ok: false, code: "INTERNAL", message: "the tool failed unexpectedly" };
    }
}

// A PROPOSE tool saves an approval and returns its id and a preview for the user.
function readProposal(registry: Registry, name: string, value: unknown) {
    if (registry.get(name).kind !== "PROPOSE") return undefined;
    const { approvalId, preview } = value as { approvalId?: unknown; preview?: unknown };
    return typeof approvalId === "string" ? { approvalId, preview } : undefined;
}
