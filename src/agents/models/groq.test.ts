import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../../config.ts";

// Reproduce the original configuration without using a real key or network.
config.groqApiKey = "test-key";
config.groqBaseUrl = "https://api.groq.com/openai/v1/";

test("Groq SDK does not duplicate the compatible-API path", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | Request | URL) => {
        requests.push(input instanceof Request ? input.url : String(input));
        return new Response(JSON.stringify({
            id: "test", object: "chat.completion", created: 0, model: "test",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Hello" } }],
        }), { headers: { "content-type": "application/json" } });
    });
    const { groq } = await import("./groq.ts");
    await groq.chat.completions.create({
        model: "test",
        messages: [{ role: "user", content: "Hi" }],
    }, { maxRetries: 0 });
    assert.deepEqual(requests, ["https://api.groq.com/openai/v1/chat/completions"]);
});
