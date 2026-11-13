import { ToolError, type Context } from "../tools/safety.ts";
import { webServiceFromConfig } from "../tools/wiring.ts";

function unavailable(): never {
    throw new ToolError("NO_GRANT", "This worker only supports public web tools");
}

export function createWebContext(runId: string): Context {
    
    return {
        runId,
        // Public web tools have no connected Google account.
        connectionId: "",

        web: webServiceFromConfig(),

        now: () => new Date(),

        grants: {
            async hasGrant(connectionId, toolName) {
                return connectionId === "" &&
                    ["web.search", "web.fetch_page"].includes(toolName);
            },
            async grantedScopes() {
                return [];
            },
        },
        
        // Fail explicitly if an unsupported integration is accessed.
        get gmail() { return unavailable(); },
        get calendar() { return unavailable(); },
        get contacts() { return unavailable(); },
        get drive() { return unavailable(); },
        get jobs() { return unavailable(); },
        get applications() { return unavailable(); },
        get approvals() { return unavailable(); },
    };
}
