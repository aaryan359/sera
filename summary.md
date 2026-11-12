# Sera project summary

Updated: 2026-11-13

## 1. What we are building

Sera is an Instinct-style personal assistant. A user gives it a request, the agent uses connected tools to complete the task, asks for approval before external actions, and reports the result with evidence.

The current direction is to build the core assistant first. A dedicated job-search product, Habit-SVF, fuzzy DAG composition, advanced model routing and Android overlays are deferred. The existing job tools remain available; the immediate product is not limited to job search. Instinct is a reference for the experience, not a verified specification of its private architecture.

The first complete workflow is:

1. A signed-in user connects Google.
2. The user asks Sera to find an email and check calendar availability.
3. Sera reads the relevant information and prepares a reply or event.
4. The user reviews the exact proposed action and approves or rejects it.
5. The server executes an approved action, verifies the provider result and records a receipt.
6. Task status and results remain available if the user disconnects or the worker restarts.

This complete workflow is not implemented yet. The repository currently contains backend components, tool adapters, database definitions and route scaffolding.

## 2. Technology and local infrastructure

| Area | Current setup |
| --- | --- |
| Backend | Node.js, TypeScript, Express, ES modules and tsx |
| Validation | Zod tool input/output schemas |
| Database | PostgreSQL, Prisma schema and migrations |
| Application authentication | Google ID-token identity resolution and application JWTs |
| Model access | Swappable model interface and OpenAI-compatible HTTP adapter |
| Testing | Node test runner with tsx and synthetic/scripted dependencies |
| Formatting | Prettier |
| Local services | Docker Compose: PostgreSQL, Redis, SearXNG and optional Adminer |

Compose defines local services; this summary does not establish that they are currently running. It does not yet define a deployed API/worker application. Redis is configured as local infrastructure, but the durable queue/worker implementation is still missing.

Default local ports in `compose.yaml` are PostgreSQL `15432`, Redis `16379`, SearXNG `18888` and Adminer `18080`. They bind to loopback and can be overridden through environment variables. Adminer is enabled through the `tools` profile. SearXNG requires `SEARXNG_SECRET` to be configured.

## 3. Server setup

The server entry point is [src/server.ts](src/server.ts).

- API prefix: `/v1/api`.
- Default application port: `3333`.
- `GET /health`: basic process health response.
- `GET /v1/api`: API welcome response.
- CORS, JSON parsing and URL-encoded body parsing are enabled.
- Request bodies are limited to 1 MB.
- Unknown routes return a JSON 404 response.
- A shared error handler returns client errors or a generic internal-error response.

At the user's request, the bootstrap was simplified. Request-ID logging, database readiness probes, shutdown middleware and custom graceful-shutdown handling are not part of the current implementation. Earlier notes describing those additions are superseded by the current file.

## 4. Authentication and user profiles

Implemented components include:

- Registration and login controllers.
- Google ID-token verification through Google's tokeninfo endpoint.
- Application JWT creation and verification.
- Authentication middleware that resolves the authenticated database user.
- Profile updates, timezone/locale fields and profile-picture updates.

The middleware accepts `Authorization: Bearer <token>` and also supports the custom `x-access-token: <token>` fallback. These are alternative ways for a client to supply the same application token.

Google sign-in identifies the user. It does not implement the separate consent/token lifecycle needed to connect Gmail and Calendar.

Before hosted use, the existing email-only development identity fallback needs an explicit isolated-test/development restriction. Production configuration and identity validation also need hardening; a working login controller is not evidence that production authentication is finished.

Relevant files: [auth middleware](src/middleware/auth.middleware.ts), [auth utilities](src/utils/auth.ts), [user controllers](src/controllers/user.controller.ts).

## 5. Route structure and status

Routes are grouped in [src/routes](src/routes) and mounted by [src/routes/index.ts](src/routes/index.ts).

All paths in the following tables are relative to `/v1/api`. Most new routes are declarations with comments and a shared `501 NOT_IMPLEMENTED` handler. Protected placeholders check authentication first, so an unauthenticated request normally receives 401 before reaching the placeholder.

### Implemented authentication/profile handlers

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Sign in |
| GET | `/auth/check-auth` | Get the authenticated user |
| PUT | `/users/update` | Update profile fields |
| PUT | `/users/profile-picture` | Update the profile picture |

Existing compatibility aliases are retained: `/users/register`, `/users/login`, `/users/check-auth`, `/users/verifyauth`, `/auth/verifyauth`, `/auth/update` and `/auth/profile-picture`, with the corresponding registration/login/check/update methods.

### Declared routes awaiting implementation

| File | Method and path | Intended behavior |
| --- | --- | --- |
| `conversation.routes.ts` | `POST /conversations` | Start a conversation |
| | `GET /conversations` | List conversations |
| | `GET /conversations/:conversationId` | Conversation details |
| | `GET /conversations/:conversationId/messages` | Message history |
| | `POST /conversations/:conversationId/messages` | Submit a request or clarification |
| | `DELETE /conversations/:conversationId` | Delete conversation history |
| `run.routes.ts` | `GET /runs` | List task runs |
| | `GET /runs/:runId` | Run status and result |
| | `GET /runs/:runId/events` | Stream progress through SSE |
| | `POST /runs/:runId/cancel` | Request cancellation |
| | `GET /runs/:runId/actions` | Actions and receipts |
| `approval.routes.ts` | `GET /approvals` | Pending approvals |
| | `GET /approvals/:approvalId` | Exact action preview |
| | `POST /approvals/:approvalId/decision` | Approve or reject |
| `integration.routes.ts` | `GET /integrations` | Supported integrations and connection status |
| | `POST /integrations/google/start` | Start Google consent |
| | `GET /integrations/google/callback` | Complete Google consent |
| `connection.routes.ts` | `DELETE /connections/:connectionId` | Disconnect an account |
| | `GET /connections/:connectionId/grants` | List permissions |
| | `PUT /connections/:connectionId/grants/:toolName` | Enable/update permission |
| | `DELETE /connections/:connectionId/grants/:toolName` | Revoke permission |
| `activity.routes.ts` | `GET /activity` | Action history |
| | `GET /activity/:activityId` | Action details and evidence |
| `schedule.routes.ts` | `POST /schedules` | Create a recurring task |
| | `GET /schedules` | List schedules |
| | `GET /schedules/:scheduleId` | Schedule details |
| | `PATCH /schedules/:scheduleId` | Edit, pause or resume |
| | `DELETE /schedules/:scheduleId` | Stop future scheduled runs |
| `device.routes.ts` | `POST /devices` | Register a device/push token |
| | `DELETE /devices/:deviceId` | Unregister a device |
| `notification.routes.ts` | `GET /notifications` | List notifications |
| | `PATCH /notifications/:notificationId` | Mark a notification as read |
| `notification-settings.routes.ts` | `GET /notification-settings` | Read preferences |
| | `PATCH /notification-settings` | Update preferences and quiet hours |
| `user.routes.ts` | `POST /users/me/export` | Request data export |
| | `DELETE /users/me` | Request account/data deletion |

The Google callback is intentionally not guarded by application bearer-token middleware. Its future controller must verify the OAuth state and PKCE flow and bind the result to the initiating user.

Gmail, Calendar, contacts, files, search and browser operations belong behind the internal agent tool boundary. They do not each need a public HTTP endpoint.

## 6. Existing tool capabilities

The shared registry is [src/tools/index.ts](src/tools/index.ts).

| Group | Implemented operations |
| --- | --- |
| Gmail | Search/read threads, propose a reply or new email, execute approved sends, marker-based send reconciliation |
| Calendar | List events, compute free slots, propose an event, execute approved creation, marker-based event reconciliation |
| Time | Current time and deterministic timezone/slot utilities |
| Contacts | Search Google contacts |
| Drive/Docs | Search files, read Google Docs, download attachment bytes, propose/execute document append |
| Web | SearXNG search and bounded public-page text extraction with URL/network checks |
| Jobs | Search configured public Greenhouse boards and read postings |
| Applications | Record applications, list them and update status |

These are implemented adapters and tool functions, not finished user-facing integrations. Account-specific service wiring, durable permissions/stores and full workflow verification remain.

The application tracker currently stores records in memory. A comment describing database storage does not mean a database-backed application store exists. Contacts search is also not a complete person-disambiguation workflow.

## 7. Agent loop and model adapter

The basic agent implementation is in [src/agents](src/agents).

- `llm.ts` defines the model, message, tool-call, usage and error contracts.
- `loop.ts` sends the request to the model, executes permitted tool calls and returns tool results to the model.
- The loop defaults to at most eight model calls and three consecutive tool errors.
- Successful exact repeated calls are blocked within a run.
- Invalid JSON and tool errors are returned to the model for correction.
- Unexpected tool exceptions are hidden behind a generic error.
- Token usage, tool trace and conversation messages are collected in memory.
- A proposal ends the loop with `AWAITING_APPROVAL`; the loop itself does not execute the proposed external action.
- `models/mock.ts` provides scripted model responses for tests.
- `models/openai-compatible.ts` supports configurable base URL, key and model, tool-name mapping, reply parsing and bounded HTTP 429/5xx retries.

The loop is not wired into conversation/task APIs or a durable worker. Persisted resume, stronger-model escalation, independent goal verification, context pruning and grounded reflection are not implemented. A model answer is not proof of task completion.

## 8. Safety and execution foundation

[src/tools/safety.ts](src/tools/safety.ts) defines four tool kinds:

- `READ`: inspect permitted data.
- `PROPOSE`: prepare an action for approval.
- `WRITE_LOCAL`: modify Sera's own records.
- `EXECUTE`: perform an approved external action; excluded from model-callable tools.

The current foundation includes schema checks, scope/grant checks, action fingerprints, approval expiry, an atomic-claim store interface, timeout handling and uncertain-write states. Some tools also recheck thread freshness, calendar conflicts or attachment content.

Durable approval/execution stores, complete authenticated ownership checks, versioned policy, an execution outbox, crash recovery, background reconciliation and consistent provider read-back are still required. The test helpers use in-memory approvals and permissive grants; those are not production stores.

Do not promise universal exactly-once external effects. Prevent known duplicate dispatches and quarantine uncertain outcomes rather than blindly retrying. A timed-out Docs append currently has no automatic reconciliation method and needs a visible review path.

## 9. Database and persistence

The Prisma schema already describes users, conversations/messages, connections/scopes/credentials, grants, runs/transitions, run connections/goals/events, trials, tool calls, observations, feedback, reflections, approvals and action executions.

Most of the runtime repositories and lifecycle operations for these models are not implemented. The schema provides a foundation, not a functioning persistent task engine. Runtime tool/approval states also need alignment with the database contracts.

Still needed: transactional state changes, execution claims, worker leases/heartbeats, checkpointing, safe retry budgets, cancellation, recovery sweeps, uncertain-action reconciliation and durable event history.

## 10. Immediate next feature: Google account connections

This is the next agreed implementation step:

1. Implement `POST /integrations/google/start` with state, PKCE and required scopes.
2. Implement `GET /integrations/google/callback`, exchange the code and bind the account to the authenticated initiating user.
3. Store credentials encrypted with expiry and key-version information.
4. Refresh access tokens safely and wire the existing Gmail/Calendar clients to the authorized account.
5. Implement `GET /integrations` to expose connection and permission status without secrets.
6. Implement `DELETE /connections/:connectionId` to disconnect/revoke access.
7. Add meaningful tests for invalid state, token failures, ownership and revoked access.

Completion means a signed-in user can connect Google, read their permitted inbox/calendar through the adapters, and lose future access when disconnected. Credentials must never be returned to the client or model.

## 11. Work after Google connections

Recommended sequence:

1. Conversation/message persistence and task submission returning a run ID.
2. Persistent run orchestration, worker execution, progress events and restart handling.
3. Approval preview/decision APIs connected to durable execution and receipts.
4. Complete the email/calendar workflow with success, rejection, duplicate-request and uncertain-write coverage.
5. Add a usable client for conversations, connections, approvals and history.
6. Add recurring schedules, notifications and narrow supported browser workflows.
7. Expand capabilities only after each supported workflow works end to end.

Later research and product ideas include cheap/strong-model routing, context optimization, grounded reflection, verified reusable workflows, fuzzy DAG composition, Habit-SVF, on-device inference, Android overlays, voice, bookings and multi-user coordination. These should not block the current core assistant implementation.

## 12. Research and planning documents

- [requirement.md](requirement.md): broad product requirements, workflow acceptance criteria, architecture and release phases.
- [remaining_work.md](remaining_work.md): the detailed November 12 audit with 193 checklist items spanning implementation, validation, optional features and research. It predates the final route scaffolding and some subsequent decisions; use current code and this summary for present status.
- [improvements.md](improvements.md) and [Design-Improvements.md](Design-Improvements.md): earlier architecture/product ideas; not every claim or proposal is adopted.
- Local `reports/` and `research_notes/`: product differentiation, cheap-model scaffolding, model/provider considerations, escalation, verification and competitor research.
- Local `research/`: cost research, supplied papers and an SLM discussion export.

`research/`, `research_notes/` and `reports/` are ignored by Git and are not part of the recent push. Links or references to those local materials may not resolve in a fresh clone. Historical external claims in the notes have not been reverified for this summary.

## 13. Coding and collaboration preferences

- Keep changes simple, focused and incremental.
- Work within the file/folder scope requested by the user.
- Let TypeScript infer return types where appropriate; keep annotations needed for inputs, interfaces, recursion, narrowing or deliberate contracts.
- Use Prettier with four spaces, double quotes, semicolons, trailing commas, LF endings and a 100-character print width.
- Existing formatting commands cover `src`, `.prettierrc.json`, `package.json` and `tsconfig.json`; they do not automatically format Markdown or Compose.
- Commit and push each completed feature separately with a clear one-line message.
- Do not publish secrets or force-add ignored research folders.

## 14. Development and verification commands

```bash
npm run dev
npm start
npm run build
npm test
npm run format
npm run format:check
```

`build` currently runs `tsc --noEmit`, so it checks types rather than generating a production build. `dev` watches the server with tsx; `start` runs it without watching. Use `.env.example` for documented local service settings; Google connection credentials/configuration still need to be completed with the integration feature.

Formatting checks, TypeScript and the existing 12 test files passed at the previous feature completion and are rechecked for this summary. They do not establish live Google integration, a running deployment or complete end-to-end assistant behavior.

## 15. Git history and delivery state

Repository: https://github.com/aaryan359/sera

The following eight commits were pushed to `main` before this summary:

| Commit | Message |
| --- | --- |
| `b51070c` | chore: add Prettier with four-space formatting |
| `f457969` | refactor: remove redundant return type annotations |
| `d81fd64` | feat: add bounded agent tool loop |
| `e688b9f` | feat: add OpenAI-compatible model adapter |
| `0a20829` | feat: serve the API under /v1/api |
| `d3f0fb0` | feat: add separate route files for assistant features |
| `a065ca8` | docs: add remaining work checklist |
| `9370c56` | chore: ignore local research files |

This document is a separate documentation change. No new runtime feature is implemented by adding it.
