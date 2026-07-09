# Evara Intelligence Layer Progress

Last updated: 2026-07-08

## Overall progress

`[████░░░░░░] 40%`

The Intelligence Layer is being delivered as five isolated milestones. Each milestone must remain reviewable, reversible, and independently mergeable.

| Milestone | Weight | Status |
|---|---:|---|
| 1. Governed intelligence foundation | 20% | Complete |
| 2. Approval governance and executor protocol | 20% | Complete in draft PR |
| 3. Smart operations and document understanding | 20% | Not started |
| 4. Recommendations and predictive intelligence | 20% | Not started |
| 5. Policy-bounded autonomous workflows | 20% | Not started |

## Completed delivery checklist

### Milestone 1 — Foundation

- [x] Replace disconnected AI command prototype
- [x] Export the active Firebase callable
- [x] Resolve role and company context on the server
- [x] Add tenant-safe aggregate operational context
- [x] Add strict AI tool contracts
- [x] Add risk classifications
- [x] Add redacted run logging
- [x] Add idempotent action-request creation
- [x] Keep all business-changing execution disabled

### Milestone 2 — Governance

- [x] Add a central action lifecycle registry
- [x] Add explicit allowed state transitions
- [x] Add role-aware approval checks
- [x] Add tenant-aware queue retrieval
- [x] Add approve and reject decisions
- [x] Add requester and leadership cancellation
- [x] Add append-only governance events
- [x] Add expiration handling
- [x] Add deterministic idempotency keys
- [x] Add unique execution-attempt IDs
- [x] Add recoverable five-minute execution leases
- [x] Add retry limits
- [x] Add reversible internal artifact executors
- [x] Add rollback by voiding artifacts instead of deleting history
- [x] Keep high-risk executors disabled
- [x] Add governance lifecycle tests

## Current callable surface

```text
aiCommand
getAiActionQueue
reviewAiActionRequest
cancelAiActionRequest
executeAiActionRequest
rollbackAiActionRequest
```

## Current execution boundary

The executor may only create reversible internal artifacts for:

- customer message drafts
- schedule change proposals
- assignment proposals
- quote drafts

The executor cannot currently:

- send messages
- change a schedule
- assign staff
- publish a quote
- issue a refund
- modify permissions
- publish application changes
- delete business records

Those operations require separate domain-owned executors and security review.

## Self-audit checklist

### Scope control

- [x] Intelligence backend files only
- [x] No Marketplace production logic changed
- [x] No Evara Studio files changed
- [x] No design-system files changed
- [x] No frontend page or component added
- [x] New milestone isolated on its own branch
- [x] Stacked on the foundation branch instead of mixing both reviews

### Authorization

- [x] Authentication required for every callable
- [x] Firebase App Check enforced
- [x] Role is loaded from trusted server data
- [x] Company scope is loaded from trusted server data
- [x] Organization users cannot approve or execute actions
- [x] Admins cannot approve high-risk actions
- [x] Owners are required for high-risk approval
- [x] Unknown action types default to denied

### Tenant isolation

- [x] Organization queue reads are filtered by company ID
- [x] Cross-tenant request access is denied
- [x] Tenant IDs are not accepted from callable input
- [x] New governance collections remain blocked from direct client access

### State integrity

- [x] State transitions are explicit and testable
- [x] Terminal states cannot restart execution
- [x] Expired actions cannot execute
- [x] Rejected actions cannot execute
- [x] Cancelled actions cannot execute
- [x] Rolled-back actions cannot execute again
- [x] Retries are limited to three attempts
- [x] Idempotency keys are deterministic per request
- [x] Execution-attempt IDs change on retry or lease recovery
- [x] Active execution leases block duplicate workers
- [x] Stale execution leases can be safely reclaimed
- [x] Artifact IDs match request IDs for retry safety

### Auditability

- [x] Approval and rejection events are logged
- [x] Cancellation events are logged
- [x] Execution start, retry, reclaim, completion, and failure are logged
- [x] Rollback events are logged
- [x] Errors and notes are redacted before storage
- [x] Rollback voids artifacts instead of deleting them

### Safety boundary

- [x] No payment executor enabled
- [x] No permission executor enabled
- [x] No publishing executor enabled
- [x] No deletion executor enabled
- [x] No customer message is sent
- [x] No operational record is mutated by an artifact executor

### Verification

- [x] Pure policy tests exist
- [x] Pure action lifecycle tests exist
- [x] Pure governance suite passes: 11 tests, 0 failures
- [ ] Full Functions workspace test pending
- [ ] Firebase emulator test pending
- [ ] Callable integration test pending
- [ ] Security review pending
- [ ] Production deployment pending

## Firestore collections introduced by Intelligence

```text
ai_runs
ai_action_requests
ai_action_events
ai_action_artifacts
```

All are server-written. Direct client access should remain denied until a dedicated governance interface and Security-owned rules are approved.

## Known limitations

- The queue currently returns a bounded page without cursor pagination.
- Artifact executors create proposals and drafts only.
- No scheduled expiration sweeper exists yet; expiration is enforced when actions are read, reviewed, cancelled, or executed.
- No domain executor is enabled for Marketplace, finance, permissions, publishing, or deletion.
- No governance UI exists yet.

## Next narrow milestone

Milestone 3 should begin with one contained operational pilot rather than broad automation:

1. Staff application document understanding
2. Missing-document and incomplete-field detection
3. Evidence-based applicant review summary
4. Human approval recommendation only
5. No automatic hiring, rejection, role assignment, or onboarding activation

This keeps the next build measurable and prevents the Intelligence Layer from spreading across unrelated product areas before its governance foundation is proven.
