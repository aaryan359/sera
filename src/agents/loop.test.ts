import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { registry as realRegistry } from "../tools/index.ts";
import { createRegistry, defineTool, requestApproval } from "../tools/safety.ts";
import { makeContext } from "../tools/test-kit.ts";
import { runAgentLoop, toToolSpecs } from "./loop.ts";
import { scriptedModel, toolCall } from "./models/mock.ts";

// ---------- three small fake tools ----------

const lookup = defineTool({
    name: "demo.lookup",
    kind: "READ",
    description: "Looks up a word.",
    scopes: [],
    timeoutMs: 1_000,
    input: z.object({ word: z.string().min(1) }),
    output: z.object({ meaning: z.string() }),
    run: async ({ word }) => ({ meaning: `meaning of ${word}` }),
});

const flaky = defineTool({
    name: "demo.flaky",
    kind: "READ",
    description: "Always crashes.",
    scopes: [],
    timeoutMs: 1_000,
    input: z.object({ n: z.number() }),
    output: z.object({}),
    run: async () => {
        throw new Error("secret database password is hunter2");
    },
});

const propose = defineTool({
    name: "demo.propose",
    kind: "PROPOSE",
    description: "Prepares a message for approval.",
    scopes: [],
    timeoutMs: 1_000,
    input: z.object({ text: z.string() }),
    output: z.object({ approvalId: z.string(), preview: z.object({ text: z.string() }) }),
    run: async ({ text }, ctx) => {
        const approval = await requestApproval(ctx, "demo.send", { text });
        return { approvalId: approval.id, preview: { text } };
    },
});

const send = defineTool({
    name: "demo.send",
    kind: "EXECUTE",
    description: "Sends the message.",
    scopes: [],
    timeoutMs: 1_000,
    input: z.object({ text: z.string() }),
    output: z.object({}),
    run: async () => ({}),
});

const registry = createRegistry([lookup, flaky, propose, send]);

function setup() {
    const { ctx, approvals } = makeContext({ now: new Date("2026-11-02T09:00:00Z") });
    return { ctx, approvals };
}

const base = { registry, system: "You are Sera.", user: "hello" };

// ---------- tests ----------

test("a plain answer ends the run in one step", async () => {
    const { ctx } = setup();
    const model = scriptedModel([{ content: "Hi there" }]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.deepEqual(result.outcome, { kind: "ANSWERED", answer: "Hi there" });
    assert.equal(result.steps, 1);
});

test("the model sees a tool result and then answers", async () => {
    const { ctx } = setup();
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.lookup", { word: "sera" })] },
        { content: "It means: meaning of sera" },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.equal(result.outcome.kind, "ANSWERED");
    const second = model.requests[1]!.messages.at(-1)!;
    assert.equal(second.role, "tool");
    assert.match(second.content, /meaning of sera/);
    assert.deepEqual(result.trace, [{ step: 1, tool: "demo.lookup", ok: true }]);
});

test("a bad argument goes back to the model, which fixes it", async () => {
    const { ctx } = setup();
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.lookup", { word: "" })] }, // fails the schema
        { toolCalls: [toolCall("demo.lookup", { word: "sera" })] },
        { content: "done" },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.equal(result.outcome.kind, "ANSWERED");
    assert.match(model.requests[1]!.messages.at(-1)!.content as string, /INVALID_INPUT/);
    assert.deepEqual(
        result.trace.map((t) => t.ok),
        [false, true],
    );
});

test("arguments that are not JSON are reported, not crashed on", async () => {
    const { ctx } = setup();
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.lookup", "{not json")] },
        { content: "ok" },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.match(model.requests[1]!.messages.at(-1)!.content as string, /not valid JSON/);
    assert.equal(result.trace[0]!.errorCode, "INVALID_INPUT");
});

test("an unknown tool and a send tool are both refused", async () => {
    const { ctx, approvals } = setup();
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.nope", {}), toolCall("demo.send", { text: "hi" })] },
        { content: "ok" },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.deepEqual(
        result.trace.map((t) => t.errorCode),
        ["UNKNOWN_TOOL", "NOT_CALLABLE_BY_MODEL"],
    );
    assert.equal(approvals.rows.size, 0);
});

test("a tool that crashes does not leak its error to the model", async () => {
    const { ctx } = setup();
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.flaky", { n: 1 })] },
        { content: "ok" },
    ]);
    await runAgentLoop({ ...base, ctx, model });
    const seen = model.requests[1]!.messages.at(-1)!.content as string;
    assert.match(seen, /INTERNAL/);
    assert.doesNotMatch(seen, /hunter2/);
});

test("a proposal pauses the run and sends nothing", async () => {
    const { ctx, approvals } = setup();
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.propose", { text: "see you at 3" })] },
        { content: "this must never be asked for" },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.equal(result.outcome.kind, "AWAITING_APPROVAL");
    if (result.outcome.kind !== "AWAITING_APPROVAL") return;
    assert.deepEqual(result.outcome.preview, { text: "see you at 3" });
    assert.equal(approvals.rows.get(result.outcome.approvalId)!.status, "PENDING");
    assert.equal(model.requests.length, 1); // the model was not called again
});

test("the same successful call twice is blocked the second time", async () => {
    const { ctx } = setup();
    const same = { word: "sera" };
    const model = scriptedModel([
        { toolCalls: [toolCall("demo.lookup", same)] },
        { toolCalls: [toolCall("demo.lookup", same)] },
        { content: "ok" },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.deepEqual(
        result.trace.map((t) => t.errorCode),
        [undefined, "REPEATED_CALL"],
    );
});

test("three failures in a row stop the run", async () => {
    const { ctx } = setup();
    const bad = () => ({ toolCalls: [toolCall("demo.lookup", { word: "" })] });
    const model = scriptedModel([bad(), bad(), bad(), { content: "never reached" }]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.deepEqual(result.outcome, { kind: "STOPPED", reason: "TOO_MANY_ERRORS" });
    assert.equal(model.requests.length, 3);
});

test("a run that never finishes stops at the step limit", async () => {
    const { ctx } = setup();
    const script = Array.from({ length: 5 }, (_, i) => ({
        toolCalls: [toolCall("demo.lookup", { word: `w${i}` })],
    }));
    const model = scriptedModel(script);
    const result = await runAgentLoop({ ...base, ctx, model, maxSteps: 3 });
    assert.deepEqual(result.outcome, { kind: "STOPPED", reason: "MAX_STEPS" });
    assert.equal(result.steps, 3);
});

test("token usage is added up across steps", async () => {
    const { ctx } = setup();
    const model = scriptedModel([
        {
            toolCalls: [toolCall("demo.lookup", { word: "a" })],
            usage: { inputTokens: 100, outputTokens: 10 },
        },
        { content: "done", usage: { inputTokens: 150, outputTokens: 5 } },
    ]);
    const result = await runAgentLoop({ ...base, ctx, model });
    assert.deepEqual(result.usage, { inputTokens: 250, outputTokens: 15 });
});

test("every real tool can be shown to a model, and no send tool is offered", () => {
    const specs = toToolSpecs(realRegistry);
    assert.ok(specs.length > 0);
    for (const spec of specs) {
        assert.equal(spec.parameters.type, "object", spec.name);
        assert.equal("$schema" in spec.parameters, false, spec.name);
    }
    assert.equal(
        specs.some((s) => s.name === "gmail.send_reply"),
        false,
    );
    assert.equal(
        specs.some((s) => s.name === "gmail.propose_reply"),
        true,
    );
});
