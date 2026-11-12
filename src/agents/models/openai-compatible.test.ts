import assert from "node:assert/strict";
import { test } from "node:test";
import { ModelError } from "../llm.ts";
import { createOpenAiCompatibleModel } from "./openai-compatible.ts";

// A fake server: answers with the given replies in order and records each request.
function fakeServer(
    replies: { status?: number; body: unknown; headers?: Record<string, string> }[],
) {
    const requests: { url: string; headers: Record<string, string>; body: any }[] = [];
    const fetchFake = (async (url: string, init: any) => {
        requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        const reply = replies[requests.length - 1];
        if (!reply) throw new Error("fake server ran out of replies");
        return new Response(JSON.stringify(reply.body), {
            status: reply.status ?? 200,
            ...(reply.headers ? { headers: reply.headers } : {}),
        });
    }) as unknown as typeof fetch;
    return { fetchFake, requests };
}

const noSleep = async () => {};

function model(replies: Parameters<typeof fakeServer>[0], extra: { maxRetries?: number } = {}) {
    const server = fakeServer(replies);
    const m = createOpenAiCompatibleModel({
        baseUrl: "https://example.test/v1/",
        apiKey: "key-123",
        model: "test-model",
        fetch: server.fetchFake,
        sleep: noSleep,
        ...extra,
    });
    return { m, ...server };
}

const tool = {
    name: "gmail.search_threads",
    description: "Search mail",
    parameters: { type: "object" },
};

test("sends the request in OpenAI format and renames dotted tool names", async () => {
    const { m, requests } = model([{ body: { choices: [{ message: { content: "hi" } }] } }]);
    await m.chat({
        messages: [
            { role: "system", content: "s" },
            { role: "user", content: "u" },
            {
                role: "assistant",
                content: null,
                toolCalls: [{ id: "c1", name: "gmail.search_threads", arguments: "{}" }],
            },
            { role: "tool", toolCallId: "c1", content: "[]" },
        ],
        tools: [tool],
    });

    const req = requests[0]!;
    assert.equal(req.url, "https://example.test/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer key-123");
    assert.equal(req.body.model, "test-model");
    assert.equal(req.body.tools[0].function.name, "gmail__search_threads");
    assert.equal(req.body.messages[2].tool_calls[0].function.name, "gmail__search_threads");
    assert.equal(req.body.messages[3].tool_call_id, "c1");
});

test("reads tool calls, restores the dotted name, and reports usage", async () => {
    const { m } = model([
        {
            body: {
                choices: [
                    {
                        message: {
                            content: null,
                            tool_calls: [
                                {
                                    id: "c9",
                                    function: {
                                        name: "gmail__search_threads",
                                        arguments: '{"query":"maya"}',
                                    },
                                },
                            ],
                        },
                    },
                ],
                usage: { prompt_tokens: 120, completion_tokens: 8 },
            },
        },
    ]);
    const reply = await m.chat({ messages: [], tools: [tool] });
    assert.deepEqual(reply.toolCalls, [
        { id: "c9", name: "gmail.search_threads", arguments: '{"query":"maya"}' },
    ]);
    assert.deepEqual(reply.usage, { inputTokens: 120, outputTokens: 8 });
});

test("accepts arguments that arrive as an object", async () => {
    const { m } = model([
        {
            body: {
                choices: [
                    {
                        message: {
                            tool_calls: [
                                {
                                    id: "c1",
                                    function: {
                                        name: "time__now",
                                        arguments: { timeZone: "Asia/Kolkata" },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ]);
    const reply = await m.chat({ messages: [], tools: [] });
    assert.equal(reply.toolCalls[0]!.arguments, '{"timeZone":"Asia/Kolkata"}');
});

test("omits the tools field when there are no tools", async () => {
    const { m, requests } = model([{ body: { choices: [{ message: { content: "hi" } }] } }]);
    await m.chat({ messages: [], tools: [] });
    assert.equal("tools" in requests[0]!.body, false);
});

test("retries after a 429 and then succeeds", async () => {
    const { m, requests } = model([
        { status: 429, body: {}, headers: { "retry-after": "2" } },
        { body: { choices: [{ message: { content: "ok" } }] } },
    ]);
    const reply = await m.chat({ messages: [], tools: [] });
    assert.equal(reply.content, "ok");
    assert.equal(requests.length, 2);
});

test("gives up with RATE_LIMITED after the retries are used", async () => {
    const { m, requests } = model(
        [
            { status: 429, body: {} },
            { status: 429, body: {} },
        ],
        { maxRetries: 1 },
    );
    await assert.rejects(
        m.chat({ messages: [], tools: [] }),
        (err: unknown) => err instanceof ModelError && err.code === "RATE_LIMITED",
    );
    assert.equal(requests.length, 2);
});

test("a 401 is not retried", async () => {
    const { m, requests } = model([{ status: 401, body: { error: "bad key" } }]);
    await assert.rejects(
        m.chat({ messages: [], tools: [] }),
        (err: unknown) => err instanceof ModelError && err.code === "PROVIDER_ERROR",
    );
    assert.equal(requests.length, 1);
});

test("an unreadable reply is reported as BAD_REPLY", async () => {
    const { m } = model([{ body: { nothing: true } }]);
    await assert.rejects(
        m.chat({ messages: [], tools: [] }),
        (err: unknown) => err instanceof ModelError && err.code === "BAD_REPLY",
    );
});

test("a tool name that already contains the separator is rejected", async () => {
    const { m } = model([{ body: {} }]);
    await assert.rejects(
        m.chat({ messages: [], tools: [{ ...tool, name: "a__b" }] }),
        /may not contain/,
    );
});
