import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../config.ts";
import { makeContext } from "../tools/test-kit.ts";

config.groqApiKey ||= "test-key";
const { askModel } = await import("./agent.ts");
const { groq } = await import("./models/groq.ts");

function setup() {
    let searches = 0;
    const { ctx } = makeContext({
        now: new Date(),
        web: {
            async search() {
                searches++;
                return [{ title: "News", url: "https://example.com", snippet: "A report" }];
            },
            async fetchPage() {
                throw new Error("Unexpected page request");
            },
        },
    });
    return { ctx, searches: () => searches };
}

function searchCall(id: string, argumentsJson = '{"query":"news"}') {
    return {
        id,
        type: "function",
        function: { name: "web__search", arguments: argumentsJson },
    };
}

function reply(content: string | null, toolCalls: ReturnType<typeof searchCall>[] = []) {
    return {
        choices: [
            {
                finish_reason: toolCalls.length ? "tool_calls" : "stop",
                message: { role: "assistant", content, tool_calls: toolCalls },
            },
        ],
    };
}

test("continues past five model calls and retains tool history", async (t) => {
    const { ctx, searches } = setup();
    let calls = 0;
    let lastMessages: unknown[] = [];
    t.mock.method(groq.chat.completions, "create", async (...args: unknown[]) => {
        const request = args[0] as { messages: unknown[] };
        lastMessages = [...request.messages];
        calls++;
        return calls <= 6 ? reply(null, [searchCall(`call-${calls}`)]) : reply("Final answer");
    });
    assert.equal(await askModel("news", ctx), "Final answer");
    assert.equal(calls, 7);
    assert.equal(searches(), 6);
    assert.equal(lastMessages.length, 14);
});

test("stops at the model budget and disables hidden SDK retries", async (t) => {
    const { ctx } = setup();
    let calls = 0;
    t.mock.method(groq.chat.completions, "create", async (...args: unknown[]) => {
        const options = args[1] as { maxRetries: number };
        assert.equal(options.maxRetries, 0);
        return reply(null, [searchCall(`call-${++calls}`)]);
    });
    await assert.rejects(askModel("news", ctx, { maxModelCalls: 2 }), { code: "MODEL_CALL_LIMIT" });
    assert.equal(calls, 2);
});

test("enforces tool budget even when a response requests multiple tools", async (t) => {
    const { ctx, searches } = setup();
    t.mock.method(groq.chat.completions, "create", async () =>
        reply(null, [searchCall("one"), searchCall("two")]),
    );
    await assert.rejects(askModel("news", ctx, { maxToolCalls: 1 }), { code: "TOOL_CALL_LIMIT" });
    assert.equal(searches(), 1);
});

test("stops after repeated invalid tool calls", async (t) => {
    const { ctx, searches } = setup();
    let calls = 0;
    t.mock.method(groq.chat.completions, "create", async () =>
        reply(null, [searchCall(`bad-${++calls}`, "{invalid")]),
    );
    await assert.rejects(askModel("news", ctx), { code: "TOOL_ERROR_LIMIT" });
    assert.equal(calls, 3);
    assert.equal(searches(), 0);
});

test("aborted execution does not start a model request", async (t) => {
    const { ctx } = setup();
    const create = t.mock.method(groq.chat.completions, "create");
    const control = new AbortController();
    control.abort(new Error("User interrupted"));
    await assert.rejects(askModel("news", ctx, { signal: control.signal }), /User interrupted/);
    assert.equal(create.mock.callCount(), 0);
});

test("cancellation after model response prevents tool execution", async (t) => {
    const { ctx, searches } = setup();
    let checks = 0;
    t.mock.method(groq.chat.completions, "create", async () => reply(null, [searchCall("one")]));
    await assert.rejects(
        askModel("news", ctx, {
            async checkRun() {
                if (++checks === 2) throw new Error("Run cancelled");
            },
        }),
        /Run cancelled/,
    );
    assert.equal(searches(), 0);
});

test("provider failures stop execution without repeated model requests", async (t) => {
    const { ctx } = setup();
    const create = t.mock.method(groq.chat.completions, "create", async () => {
        throw new Error("Provider unavailable");
    });
    await assert.rejects(askModel("news", ctx), /Provider unavailable/);
    assert.equal(create.mock.callCount(), 1);
});

test("records every failed tool attempt before stopping at the error limit", async (t) => {
    const { ctx } = setup();
    const entries: { name: string; errorCode: string | null; startedAt: Date; finishedAt: Date }[] = [];
    t.mock.method(groq.chat.completions, "create", async () => reply(null, [searchCall("bad", "{invalid")]));
    await assert.rejects(askModel("news", ctx, {
        async onToolCall(entry) { entries.push(entry); },
    }), { code: "TOOL_ERROR_LIMIT" });
    assert.equal(entries.length, 3);
    assert.ok(entries.every(entry => entry.name === "web.search" && entry.errorCode === "INVALID_INPUT"));
    assert.ok(entries.every(entry => entry.finishedAt >= entry.startedAt));
});

test("successful tool execution produces a trace without storing result contents", async (t) => {
    const { ctx } = setup();
    let calls = 0;
    const entries: { name: string; errorCode: string | null }[] = [];
    t.mock.method(groq.chat.completions, "create", async () =>
        ++calls === 1 ? reply(null, [searchCall("search")]) : reply("Answer"));
    await askModel("news", ctx, { async onToolCall(entry) { entries.push(entry); } });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.name, "web.search");
    assert.equal(entries[0]!.errorCode, null);
    assert.ok(!("result" in entries[0]!));
});
