import Groq from "groq-sdk";
import { config } from "../../config.ts";

export const groq = new Groq({
    apiKey: config.groqApiKey,
    // The Groq SDK adds /openai/v1 itself. Accept the earlier compatible-API URL too.
    baseURL: config.groqBaseUrl.replace(/\/openai\/v1\/?$/, ""),
});
