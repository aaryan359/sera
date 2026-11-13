import { RunStatus } from "../db/enums.ts";
import { prisma } from "../db/prisma.ts";



// Claim one eligible run. Heartbeats and expired-run recovery are handled separately.
export async function claimRun(workerId: string, leaseMs = 60_000) {
    
    
    if (!workerId.trim() || !Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
        throw new Error("Provide a worker ID and a positive integer lease duration");
    }

    return prisma.$transaction(async (tx) => {
        // Skip rows another worker is claiming instead of waiting for its lock.
        const [candidate] = await tx.$queryRaw<
            { id: string; stateVersion: number; claimedAt: Date }[]
        >`
            SELECT "id", "stateVersion", CURRENT_TIMESTAMP AS "claimedAt"
            FROM "Run"
            WHERE "status" = 'QUEUED'
              AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= CURRENT_TIMESTAMP)
              AND ("deadlineAt" IS NULL OR "deadlineAt" > CURRENT_TIMESTAMP)
              AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= CURRENT_TIMESTAMP)
              AND "retryCount" <= "maxRetries"
            ORDER BY "createdAt", "id"
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `;

        if (!candidate) return null;

        const run = await tx.run.update({
            where: { id: candidate.id },
            data: {
                status: RunStatus.RUNNING,
                stateVersion: { increment: 1 },
                statusChangedAt: candidate.claimedAt,
                leaseOwner: workerId,
                leaseExpiresAt: new Date(candidate.claimedAt.getTime() + leaseMs),
                lastHeartbeatAt: candidate.claimedAt,
                nextAttemptAt: null,
            },
        });

        await tx.runTransition.create({
            data: {
                runId: run.id,
                version: run.stateVersion,
                fromStatus: RunStatus.QUEUED,
                toStatus: RunStatus.RUNNING,
                reasonCode: "WORKER_CLAIMED",
                workerId,
            },
        });

        return run;
    });
}
