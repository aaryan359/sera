import { randomUUID } from "node:crypto";
import { claimRun } from "../agents/claim-run.ts";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "../db/prisma.ts";
import { config } from "../config.ts";
import { AgentError } from "../agents/agent.ts";
import { executeRun } from "../agents/execute-run.ts";
import { createWebContext } from "../agents/web-context.ts";
import Groq from "groq-sdk";



const workerId = randomUUID();

async function main() {

    if (!config.groqApiKey) throw new Error("GROQ_API_KEY is missing");
    
    console.log(`Worker ${workerId} started`);

    try {
        while (true) {

            try {
                const run = await claimRun(workerId);

                if (!run) {
                    await sleep(1000);
                    continue;
                }

                console.log(`Running ${run.id}`);

                const ctx = createWebContext(run.id);
                
                console.log(`Context created for ${run.id}`);

                await executeRun(run, ctx);

                console.log(`Completed ${run.id}`);

            } catch (error) {

                // Keep the worker alive without logging private provider responses.
                console.error("Worker operation failed:",
                    error instanceof AgentError ? error.code :
                    error instanceof Groq.APIError ? `GROQ_HTTP_${error.status ?? "UNKNOWN"}` :
                    error instanceof Error ? error.name : "UNKNOWN_ERROR");
                await sleep(1000);
            }
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(() => {
    console.error("Worker could not start; check the environment and database configuration");
    process.exitCode = 1;
});

