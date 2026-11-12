# Sera: remaining work

Audit date: 2026-11-12. Compared the requirements, architecture documents, both reports, all eleven research-note files, the cost research, supplied PDF research, and current source tree. This is an implementation audit of the local workspace; external competitor, pricing, policy and research claims have not been independently reverified here.

Unchecked items are remaining work, including completion of partially implemented features. Later ideas and experiments are explicitly separated from release requirements. A database model, adapter or passing unit test does not establish that a complete product workflow works.

## Current position

| Area | What exists | What remains |
| --- | --- | --- |
| API | Express, health endpoint, sign-in/profile routes | Task, conversation, integration, approval, activity and streaming APIs |
| Database | Users plus extensive run/permission/evaluation/approval/execution schema and migrations | Runtime repositories, transactions, durable lifecycle, application tracker persistence |
| Tools | Gmail, Calendar, time, contacts, Drive/Docs, public web, Greenhouse jobs and application tracking | Authenticated service wiring, production stores, complete connector verification and end-to-end flows |
| Agent | In-memory tool loop, swappable model interface, OpenAI-compatible adapter, scripted model | Durable orchestration, goal evaluation, clarification/resume, reflection, escalation and context policy |
| Safety | Schema and scope/grant checks, executor-only writes, approval fingerprint, claim interface, timeout uncertainty and some reconciliation | User/run/account checks, versioned policy, durable claims/outbox, authenticated decisions, recovery and full verification |
| Quality | Existing tool/loop/adapter tests | Integration, stateful fault injection, adversarial scenarios, real-model evaluation and mobile E2E |
| Product | Research and backend components | A supported user workflow, client, onboarding, operating setup and pilot validation |

Validation at audit: `npm run build` passes; `npm test` passes all 12 reported test files. These checks do not exercise a hosted product or prove live Google-account workflows.

## 1. Resolve scope and document conflicts

- [ ] Confirm the first customer workflow: the original email/calendar assistant slice, or the later report's job-search inbox loop as the initial market wedge. The larger assistant remains the requirements' longer-term goal.
- [ ] Choose the initial client and sequence: backend/API first is consistent; Expo mobile is in the requirements, whereas the strategy report suggests web/PWA before mobile and the blueprint proposes Android-first ambient UI.
- [ ] Resolve auth architecture: the requirements table says Supabase Auth; current code issues its own JWT after Google identity resolution.
- [ ] Keep exact approval for external writes as the current requirement. The older blueprint's medium-risk auto-execute/undo rule must not silently override it.
- [ ] Decide whether biometric confirmation is an optional UX layer or a requirement; it does not replace server authorization.
- [ ] Reconcile allowlisted browser workflows with the older on-device WebView/session proposal and the requirements' limits on arbitrary device control and credentials.
- [ ] Reconcile model-side dynamic tool subsets with cache stability. Measure the trade-off; permission enforcement must remain in code whichever representation is chosen.
- [ ] Select cheap and escalation model/provider pairs using Sera's fixtures and verified data terms; pin model IDs and configurations.
- [ ] Select hosting, secrets, queue, telemetry, search and eventual places providers.
- [ ] Update the requirements and architecture docs to record adopted decisions, deferred proposals and actual implementation status.
- [ ] Replace older unqualified claims about zero cost, universal exactly-once guarantees, precise latency, novelty and competitor internals with measured or explicitly hypothetical statements.

## 2. Authentication and account connections

- [ ] Restrict email-only identity/test payloads to an explicitly isolated local/test mode. `resolveGoogleUserInfo` currently accepts them without an environment gate.
- [ ] Require production secrets/configuration at startup; remove reliance on the development JWT-secret fallback in hosted environments.
- [ ] Make Google identity checks strict for expected audience and relevant issuer, expiry, subject and verified-email requirements; validate auth/profile request bodies.
- [ ] Add auth integration and cross-user isolation tests.
- [ ] Implement Google integration start/callback with state, PKCE and exact redirect allowlists. Sign-in alone does not connect Gmail/Calendar permissions.
- [ ] Support incremental scopes, connected-account ownership checks and account selection.
- [ ] Store credentials separately with encryption, key versioning, refresh/expiry handling and safe concurrent token refresh.
- [ ] Implement connection listing, reconnect, disconnect, revocation and explicit data deletion.
- [ ] Implement persistent, connection-bound, versioned, expiring tool grants and revocation APIs/policy.
- [ ] Construct each run's real provider clients from its authorized connection and token service; do not use permissive test grants in production.
- [ ] Keep synthetic identity, model and provider modes visibly labeled and isolated from real accounts.
- [ ] Verify applicable Google consent/verification requirements and model-provider handling terms before a real-user pilot; resolve assessment scope, cost and lead-time uncertainties from primary sources.

## 3. Public API and durable stores

- [ ] Add conversation creation, message submission and history APIs.
- [ ] Return a persisted run ID promptly when a task is submitted; make duplicate submissions idempotent.
- [ ] Add run status/details, clarification response/resume and cancellation APIs.
- [ ] Add approval detail and approve/reject endpoints with ownership, expiry and duplicate-decision handling.
- [ ] Add authenticated SSE progress with event IDs, reconnection/replay and persisted history.
- [ ] Add activity, receipts and user-safe trial/feedback/lesson APIs.
- [ ] Add readiness checks for database, queue and other required dependencies.
- [ ] Publish OpenAPI schemas, examples and stable errors matching actual routes.
- [ ] Implement repositories for conversations/messages, runs/transitions, goals, observations/tool calls, feedback/reflections, grants/connections and approvals/executions.
- [ ] Persist run events and usage/cost data; define payload bounds and retention.
- [ ] Add a user-owned application model/migration and database-backed `ApplicationStore`. The existing implementation stores records in a process-local Map despite a comment describing a database store.
- [ ] Reconcile runtime and Prisma contracts: runtime tool kinds and approval/execution states currently differ from the database enums and separate execution model.

## 4. Durable agent orchestration

- [ ] Wire `runAgentLoop` into the API and worker with a model factory and authorized tool context.
- [ ] Implement router/planner and a validated goal contract covering every subgoal, target, constraint and allowed effect.
- [ ] Build the explicit run state machine and reject illegal/terminal-state transitions.
- [ ] Persist each transition atomically with state-version checks and an audit event.
- [ ] Add Redis/BullMQ queue delivery, worker startup and safe job deduplication.
- [ ] Implement worker claim leases, heartbeats, stale-worker rejection and deadline handling.
- [ ] Checkpoint pre-write steps and resume from durable state after interruption.
- [ ] Add startup/periodic recovery sweeps, bounded safe retries, persisted backoff and retry exhaustion.
- [ ] Pause without holding worker leases during approval and clarification; resume without losing completed work.
- [ ] Handle compound requests and multiple actions; the current loop stops at its first proposal and has no durable resume controller.
- [ ] Add explicit ask-user handling for missing information and ambiguous entities.
- [ ] Enforce tool-call, token, time, trial and escalation budgets in addition to the current model-step/error limits; bound oversized call batches too.
- [ ] Implement cancellation across queued/running/waiting states and honestly report writes already dispatched.
- [ ] Emit understandable progress and errors without exposing raw reasoning or private payloads.

## 5. Approval, execution and recovery

- [ ] Add tool versions and complete user/run/account/grant/scope checks to every dispatch.
- [ ] Bind approval to user, run, connection, tool/version and canonical exact arguments; prevent validation from silently changing the approved action.
- [ ] Persist immutable action previews, approval decisions, expiry and invalidation.
- [ ] Implement PostgreSQL approval/execution stores and atomic claims rather than relying on the in-memory test helper.
- [ ] Create one durable `ActionExecution` per approval with stable request marker and idempotency key before dispatch.
- [ ] Keep decision and execution states separate and transactional, matching the schema.
- [ ] Revalidate ownership, run/dispatch lease, grants/scopes, resource versions and approved conditions immediately before execution.
- [ ] Reject changed conditions with a fresh proposal; include calendar-slot freshness for scheduling replies as well as event creation.
- [ ] Verify approved recipients/attendees and resource IDs against trusted user input or authorized observations; don't accept fabricated identities.
- [ ] Record provider receipts and use read-back to compare actual effects with the intended action before completion.
- [ ] Quarantine interrupted or ambiguous writes, including crash-after-dispatch, receipt-persistence failure and response-parsing failure after a possible commit.
- [ ] Implement background reconciliation, bounded polling and visible manual-review paths; absence of a search hit is not proof that a write never happened.
- [ ] Harden reconciliation's user/run/connection, fingerprint and permission checks; `reconcileApproval` currently checks status but lacks the matching run/connection guard used by `runApproved`.
- [ ] Recover expired execution leases independently of run heartbeats and never blindly redispatch uncertain writes.
- [ ] Keep timed-out Docs appends in visible manual review until a reliable reconciliation strategy exists.
- [ ] Provide inspectable/exportable action history and receipts.

## 6. Complete the first supported Gmail/Calendar workflow

- [ ] Build shared seeded mailbox/calendar fixtures and development mock providers; existing per-test fakes are not a complete runnable mock product.
- [ ] Complete D1 through the API: find the relevant email, resolve the recipient, calculate two slots, preview a reply, approve/reject, execute once, verify and record the result.
- [ ] Complete D2: resolve attendee/date/timezone, check conflicts, preview an event, approve, create and verify it.
- [ ] Add or explicitly narrow planned missing adapter operations: connected Gmail profile/account verification, sent-message detail read-back, calendar listing/selection and event detail read-back.
- [ ] Implement person disambiguation beyond a contact-search tool, including overlapping names and user correction.
- [ ] Preserve all requested scheduling constraints and recheck them at commit time.
- [ ] Define behavior for ambiguous/nonexistent DST wall times, all-day events, crossing midnight, workdays/weekends and relative dates; expand meaningful coverage beyond current timezone utilities.
- [ ] Handle unavailable/revoked scopes and dependencies used during execution, not just the final write's nominal scope.
- [ ] Run dedicated-account live tests of supported Google adapters, approval decisions and reconciliation. HTTP adapters exist; production support is not yet demonstrated.

## 7. Cheap-model gateway and reliability scaffolding

- [ ] Add a `dataClass` gate and provider allowlist to prevent routing real user content to endpoints approved only for synthetic tests.
- [ ] Add model/provider configuration, prompt/schema versions, dated model IDs and reproducible settings.
- [ ] Add model request deadlines, cancellation, normalized network/JSON errors and bounded transport retry/failover.
- [ ] Add provider-wide quotas/concurrency limits and budget-aware fallback; the current adapter already retries HTTP 429/5xx with backoff.
- [ ] Test strict-mode, reasoning-mode, call-format and streaming differences per selected provider.
- [ ] Evaluate a tightly validated fallback parser for text/fenced tool calls only if needed; parsed text still cannot bypass the normal registry/policy gate.
- [ ] Log parse failure, missing-call, invalid-schema and wrong-but-valid-call rates separately using synthetic or redacted payloads.
- [ ] Add closed-world ID membership and alias mapping so the model selects known handles rather than inventing identifiers.
- [ ] Return structured field-level validation feedback with a bounded repair attempt.
- [ ] Choose the legal tools per task/state and evaluate modest task-level consolidation, compact rich descriptions and concise/detailed results.
- [ ] Keep filtering, deduplication, time calculations and dependency validation in deterministic code.
- [ ] Evaluate sequential single-call behavior for weak models and correctly handle all assistant/tool messages around interruption or proposal pauses.
- [ ] Test semantic grounding and missing-field clarification, not just JSON validity.

## 8. Context management, evaluation and reflection

- [ ] Build a task ledger from persisted canonical state: requested subgoals, constraints, resolved identities, authoritative snapshots and completed effects.
- [ ] Build bounded model context with pinned constraints, recent complete call/result pairs and source-linked summaries/stubs for older observations.
- [ ] Store older observations for protected audit without resending all of them to the model.
- [ ] Apply field-aware output limits, staleness/version rules and newer-evidence precedence.
- [ ] Tune recent-only versus recent-plus-summary versus full history on Sera fixtures; do not treat the papers' window sizes as universal defaults.
- [ ] Add stable prompt prefixes, deterministic schema serialization and cache-aware batched context edits; measure actual cache hits.
- [ ] Implement independent goal evaluation with explicit pass/recoverable/needs-user/uncertain/hard-failure outcomes and evidence references.
- [ ] Require provider evidence for success; a tool-free model answer must not imply that an unperformed action succeeded.
- [ ] Implement structured, evidence-linked reflections and reject unsupported references or permission-changing lessons.
- [ ] Add bounded pre-write replan trials with no-new-evidence and repeated-observation stop rules.
- [ ] Keep user rejection outside the failure-repair loop and uncertain writes outside retry/reflection loops.
- [ ] Implement D6: a wrong pre-write candidate is rejected by evidence, corrected through a grounded lesson and retried safely.
- [ ] Keep run state, run-scoped error lessons and durable user preferences separate, with distinct trust and retention rules.

## 9. Strong-model escalation and verified reuse

- [ ] Implement harness-controlled escalation on exhausted structured repair, repeated calls, error streaks and grounded semantic failures.
- [ ] Evaluate an additional proposal reviewer for writes that already pass deterministic checks; a reviewer never grants user approval.
- [ ] Start escalated runs with the task, current canonical state, committed effects and verified observations; compare compact failure notes with raw-history handoff experimentally.
- [ ] Cap strong calls, latency and spend; escalate to the user when useful progress is no longer justified.
- [ ] Compare cheap-only, strong-only, strong-planner/cheap-worker and selective-review/escalation variants under equal scenarios and budgets.
- [ ] Capture successful strong-model corrections as candidate parameterized strategies/workflows.
- [ ] Admit reusable skills only after regression replay; track provenance, scope, versions and measured utility.
- [ ] Add narrow retrieval, stale-skill retirement and injection/permission checks; test for exemplar-induced inaction and context bloat.
- [ ] Measure escalation rate as the verified library grows; defer learned/calibrated routing until enough trustworthy traces exist.

## 10. Job-search product loop from the strategy report

These are additional product requirements if the report's suggested wedge is adopted; basic job search and manual tracker tools already exist.

- [ ] Associate applications, recruiter contacts and Gmail threads using evidence and explicit ambiguity handling.
- [ ] Detect recruiter replies, interview requests, offers and rejections; avoid treating a weak classification as an established fact.
- [ ] Propose or apply permitted internal tracker updates with source evidence, correction and audit history.
- [ ] Connect interview requests to calendar availability and exact approval-gated reply/event workflows.
- [ ] Add user-defined no-reply/follow-up rules and prepare follow-up drafts without automatic external sends.
- [ ] Add reminders, application pipeline views, supporting documents/resume selection and source-linked activity.
- [ ] Extend job sources only as needed; the existing search covers configured public Greenhouse boards, not the entire job market.
- [ ] Keep application-form submission manual/link-out until a specific supported adapter, policy and verification flow exists; mass auto-apply is not the report's proposed wedge.
- [ ] Add recurring monitoring triggers, incremental ingestion/deduplication and user-controlled notifications.

## 11. Evaluation and proof of reliability

- [ ] Build 15-25 initial synthetic multi-turn scenarios with hidden final-state expectations and forbidden actions.
- [ ] Grade policy/approval timing, user-facing evidence and final provider state independently of model self-reports.
- [ ] Cover paraphrases, two-part requests, missing fields, overlapping names, stale state, correction, OAuth failure and injected mail/web text.
- [ ] Add API-level integration tests for submit -> run -> proposal -> decision -> dispatch -> receipt -> completion.
- [ ] Add rejection/expiry, wrong-user, revoked/expired grants, missing scope, tampered approval and unknown/version-mismatched tool cases.
- [ ] Add concurrent decisions/workers, duplicate queue delivery and stale lease/heartbeat tests.
- [ ] Add process-kill/fault injection before and after each critical step, late commit, response lost after commit and receipt persistence failure.
- [ ] Add deterministic time/DST, identity resolution, context staleness and reflection false/no-feedback regressions.
- [ ] Add adversarial tests for unauthorized reads, data exfiltration and secret disclosure as well as unapproved writes; approval gates alone do not cover read leaks.
- [ ] Run repeated live-model fixtures with pinned versions/settings and report first-attempt success, bounded recovery, full-task success and pass^k consistency.
- [ ] Run A/B/C/D ablations: one-pass, feedback/retry only, grounded reflection and reflection plus context pruning.
- [ ] Compare cheap models with scaffolding against the same cheap models without it and a stronger plain-loop baseline.
- [ ] Report parse/schema/executable/semantic accuracy, ask/confirm behavior, wrong-recipient rate and clarification-versus-completion trade-offs.
- [ ] Report duplicate effects, false success, uncertain writes, recovery success/time, unsafe resume and scope violations separately.
- [ ] Report median/p95 latency, all model/retry/reviewer tokens, escalation rate, non-token fees and cost per solved task.
- [ ] Publish reproducible fixture/config versions and per-case failures; do not claim superiority over competitors without comparable access and measurements.

## 12. Client, personal context and additional P1 tools

- [ ] Build the selected client with sign-in, onboarding, account connections and permission management.
- [ ] Add conversations/task submission, live run timeline, history and reconnect/resume.
- [ ] Add exact action cards showing recipient/thread/body or calendar/timezone/attendees, approve/reject/edit and expired/changed-action handling.
- [ ] Add clarification, cancel, failed/uncertain/manual-review states and provider receipts.
- [ ] Add app lifecycle recovery, notification/deep-link handling and client E2E tests for supported platforms.
- [ ] Build opt-in local preference storage with source/consent, scope, timestamps, conflict handling and expiry.
- [ ] Add preference inspect/confirm/edit/delete/export and send only a relevant bounded snapshot with a task.
- [ ] Make fresh user corrections override older preferences; keep learned task-error lessons separate.
- [ ] Finish D3 source-linked research output, retrieval timestamps, stale/inaccessible-source handling and concise result cards.
- [ ] Add licensed places search/details with explicit location, hours and attribution.
- [ ] Add first-party tasks/reminders, schedules, notification delivery, completion and permission rules.
- [ ] Test whether user-defined event alerts are useful; add quiet hours, deduplication, dismissal controls and notification precision metrics.

## 13. Operations, privacy and release engineering

- [ ] Add startup environment validation, consistent API error handling, request/body limits, rate limiting and per-user/global concurrency limits.
- [ ] Configure intended client origins and deployment-specific HTTP/security settings.
- [ ] Add structured redacted logs, correlation IDs, tracing and run/tool/model duration and usage metrics.
- [ ] Monitor queue backlog, lease expiry, stuck runs, uncertain executions, provider failures and spending; add operational reconciliation tools/runbooks.
- [ ] Redact credentials, OTPs and irrelevant private content before model requests, events and logs.
- [ ] Define and implement retention/TTL cleanup, user data deletion/export and provider disconnect semantics.
- [ ] Complete secret/key management, rotation, database backup/restore and migration/release procedures.
- [ ] Add worker/API deployment artifacts, health/readiness behavior and graceful shutdown that preserves uncertain-write state.
- [ ] Add lint/format/typecheck workflow and CI for meaningful unit, contract and integration checks; existing `build` already type-checks.
- [ ] Add setup/architecture/API/testing/operations documentation and a clean-environment reproducibility check.
- [ ] Decide and commit intended source/research changes. Agent code, reports and research notes are currently untracked; `research/` is ignored, so choose how shared research artifacts should be retained.
- [ ] Verify dependency/release configuration as part of clean setup, including directly imported packages and generated Prisma assets.

## 14. Product validation and launch work from the reports

- [ ] Hands-on verify the exact proposed job-loop gap in Simplify, G-Track, Teal and Huntr; earlier notes overstate the absence of Gmail-aware trackers.
- [ ] Recheck primary sources behind competitor capabilities, model pricing/terms, Gmail processing requirements and platform restrictions before using them for product or launch decisions.
- [ ] Interview target job seekers and test the full workflow with consenting pilot users after the release gates work.
- [ ] Instrument time-to-first-value, proposal accept/edit/reject rates, recurring usage, D7/D30 retention, wrong-action incidents and support burden.
- [ ] Test transparent pricing, short plans, cancellation and actual willingness to pay; add billing/entitlements only for an adopted paid launch.
- [ ] Set measurable continuation/kill criteria before the pilot; the reports' sample cohort sizes/prices are proposals, not validated decisions.
- [ ] Validate career-CRM or freelancer adjacency before expanding beyond job search; test regional/language demand before adding local connectors.
- [ ] Evaluate distribution options and platform requirements; BYO-key/self-host/exportable memory are optional positioning ideas, not current release requirements.

## 15. Later product capabilities

- [ ] Drive file reading beyond current Docs text/attachment use and exact approved destructive file actions, with preconditions and receipts.
- [ ] Specific booking/commerce connectors with search, price/terms snapshot, approved confirmation, receipt and reconciliation.
- [ ] SMS/voice provider integration, ownership verification, authenticated webhooks and exact communication previews.
- [ ] Narrow allowlisted browser actions with inspection, guarded execution and provider/site verification.
- [ ] Invite/consent-based multi-user scheduling and revocation/isolation controls.
- [ ] Narrow device actions only if a supported isolated integration is deliberately adopted.

## 16. Longer-term blueprint ideas, not first-release blockers

- [ ] Experiment with fuzzy preference ranges, confidence ranking and ambiguity thresholds; keep hard authorization rules deterministic.
- [ ] Evaluate Android floating bubble, hold-to-talk, speech recognition/output, haptics and microphone/overlay permissions on current supported OS versions.
- [ ] Evaluate foreground on-device WebView automation, scoped local sessions, user takeover and stopping at checkout; resolve the conflict with the narrower browser/security requirements first.
- [ ] Evaluate native biometric action confirmation and concise visual cards.
- [ ] Build trace-to-macro compilation only from verified flows, with typed parameters and text/role/accessibility/structural anchors.
- [ ] Add guarded replay, step timeout, repair, verification and safe full-agent fallback without bypassing approvals.
- [ ] Evaluate flexible device background work versus server scheduling for deadlines; measure actual OS limits, execution reliability and cost.
- [ ] Evaluate user-controlled communication style adaptation and proactive-alert restraint rather than silently inferring permanent traits.

## 17. Separate research tracks from the cost and SLM material

- [ ] Measure task repetition/habit concentration from consented, minimized traces before optimizing for assumed habits.
- [ ] Start with parameter-stripped intent/plan caching, safe hit thresholds, verification gates and guarded fallback.
- [ ] Implement typed workflow graphs and evaluate structural sketch-DAG matching against text/intent/keyword retrieval at a fixed false-hit rate.
- [ ] Test partial graph reuse and multi-intent composition, including data-flow dependencies, committed effects and approval nodes.
- [ ] Measure reused nodes, false matches, success, latency and full cost per completion; include failed matches and escalation.
- [ ] For Habit-SVF, establish 1B/3B tool-use baselines before building training machinery.
- [ ] Compare SVF with SFT-LoRA, distillation, activation steering and memory-only strategies; continue only if it adds measured value.
- [ ] Prototype habit routing and teacher-guided verifiable learning with held-out tool tasks and strict exclusion of private user content from training under current product requirements.
- [ ] Test forgetting, harmful drift, reward gaming, rare-task performance and the escalation curve over repeated tasks.
- [ ] Measure on-device RAM, prefill/decoding latency, energy, thermal behavior and feasible training budgets.
- [ ] Compare one adapter/vector per task with per-step swaps and cache recomputation; test graph-node boundaries as possible adaptation points.
- [ ] Treat graph novelty, SVF gains on tiny tool models and estimated large cost savings as hypotheses requiring original experiments.
- [ ] Add batch/off-peak processing and search-result caching only for eligible asynchronous/freshness-safe work; measure savings rather than importing report projections.

## Suggested implementation sequence

1. Harden authentication/configuration and align runtime/database contracts.
2. Implement durable repositories, state transitions, claims and the worker.
3. Add conversation/run/approval/SSE APIs and complete D1 on shared synthetic providers.
4. Complete dispatch/reconciliation, restart and adversarial failure tests.
5. Add independent goal verification and the baseline scenario evaluation suite.
6. Add context scaffolding, bounded reflection and measured strong-model escalation.
7. Connect real Google accounts through the proper consent/token lifecycle and verify D1/D2 on dedicated accounts.
8. Complete the chosen client and, if adopted, the job-search loop; instrument a small pilot.
9. Add verified reuse and research experiments only once traces and baselines exist; broaden connectors after supported workflows work.

The requirements put reflection before live-integration hardening; the research report puts the baseline/evaluation gateway first and more sophisticated learning later. The sequence above preserves both: establish the observable baseline first, then measure added recovery mechanisms before making live workflows supported.

## Source map

- [Product requirements and acceptance criteria](requirement.md): product scope, D1-D6, lifecycle, tool inventory, API, safety, evaluation and phases.
- [Architecture blueprint](improvements.md) and [older design notes](Design-Improvements.md): local/fuzzy memory, Android/WebView, approval UX, macros and dispatcher ideas; not all are adopted or substantiated.
- [Cheap-model reliability report](reports/Cheap%20model%20agent%20reliability%20methods.md): gateway/data-class policy, scaffolds, context, escalation, verification, evaluation and staged skill reuse.
- [Product differentiation report](reports/Personal%20agent%20differentiation%20strategy.md): job-loop hypothesis, competitive validation, pilot metrics, distribution and pricing experiments.
- [Cost research](research/Cutting%20token%20costs%20for%20AI%20agents.md): caching, routing, lean context/tools, compiled plans, fuzzy DAG and Habit-SVF experiments.
- `research_notes/Cheap model agent reliability methods/`: `scaffolding_for_weak_models.md`, `free_cheap_model_landscape.md`, `escalation_and_verification.md`, `competitor_architectures.md`, `beating_funded_competitors.md`.
- `research_notes/Personal agent differentiation strategy/`: `competitor_landscape.md`, `defensible_advantages.md`, `failures_and_trust.md`, `job_search_competitors.md`, `usage_retention_payment.md`, `wedge_niches.md`.
- `research/`: supplied Reflexion, tau-bench, context, memory and Transformer-Squared papers, plus the SLM discussion export. `language_agent.pdf` and `verbel_reflexive_agents.pdf` have identical SHA-256 hashes; `research on slms.pdf` is a saved assistant conversation rather than an independent research paper.
- Code evidence: `src/routes/`, `src/controllers/`, `src/utils/auth.ts`, `src/config.ts`, `src/agents/`, `src/tools/`, `prisma/`, `compose.yaml`, `package.json` and current build/test output.
