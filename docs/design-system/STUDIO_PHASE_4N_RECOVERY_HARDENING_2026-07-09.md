# Phase 4N — Recovery Hardening, Trusted Synchronization & Validation Unblock

Date: **2026-07-09**  
Local Journal authority: **studio-journal-authority-v2**  
Trusted client adapter: **trusted-studio-journal-v2**  
Operation envelope: **studio-journal-operation-envelope-v1**  
Semantic command contract: **canvas-semantic-command-v1**  
Evara Graph schema: **0.1.0**  
Evara Operation Protocol: **0.1.0**  
Firebase project: **evaraos-web**  
Phase status: **Source complete; external execution and deployment pending**

## Live Progress

Overall Design System: `[███████████████████░] 98%`  
Phase 4N source implementation: `[████████████████████] 100%`  
Evara Studio: `[████████████████░░░░] 78%`  
Canvas Engine: `[█████████████████░░░] 84%`  
Operation & History Engine: `[██████████████░░░░░░] 72%`  
Evara Graph Core: `[████████████░░░░░░░░] 58%`  
Blueprint Engine: `[██████████████░░░░░░] 72%`  
Static workflow execution: `[░░░░░░░░░░░░░░░░░░░░] 0%`  
Authenticated Studio execution: `[░░░░░░░░░░░░░░░░░░░░] 0%`  
Trusted Firebase Functions deployment: `[░░░░░░░░░░░░░░░░░░░░] 0%`

## Architecture Review

Phase 4N hardens the operation-backed Studio runtime and connects it to the trusted server journal without creating another graph, history, storage, or publishing system.

The final architecture is:

```text
Canvas / Blueprint semantic command
  → Evara Operation Protocol
  → canonical browser Journal
  → Journal Authority v2
  → graph-scoped writer lease
  → trusted callable client
  → Firebase callable service
  → canonical server sequence
  → trusted checkpoint
  → immutable release preparation
```

The browser remains local-first. An edit becomes locally durable before Canvas accepts it. The trusted client then synchronizes pending transactions through callable contracts. Local durability and server confirmation remain separate states.

## Canonical Local Journal

The browser continues to use one database:

```text
evaraos-studio-journal
```

and the existing stores:

- `sessions`
- `transactions`
- `checkpoints`

`studio-journal-authority-v2.js` extends the existing Journal rather than replacing it.

It adds:

- immutable idempotency comparison
- transaction durability states
- operation-width sequence ranges
- graph-head resequencing
- pending transaction queries
- server-confirmed state
- offline state
- conflict state
- recovery-required state
- rejected immutable history
- trusted checkpoint records
- trusted recovery-plan installation

No parallel browser database or transaction store was introduced.

## Transaction Integrity

Canvas recovery now verifies every operation transaction before replay.

Validation includes:

- envelope version
- transaction ID
- graph ID
- expected revision chain
- accepted revision
- canonical sequence continuity
- operation count and sequence width
- operation graph and transaction references
- inverse-operation references
- commit-operation type
- commit start revision
- commit end revision
- client timestamp

Recovery fails closed with explicit codes:

- `canvas-transaction-integrity`
- `canvas-transaction-revision`
- `canvas-operation-replay`
- `canvas-graph-head-mismatch`

Invalid records are never silently skipped and a stale graph is never promoted.

## Unsynchronized-Change Diagnostics

Studio now projects the distinction between:

- saved locally
- syncing
- offline
- conflict
- recovery required
- server confirmed
- rejected

The active Canvas surface exposes:

- pending transaction count
- unsynchronized-change state
- integrity state
- graph revision
- Journal head revision
- Journal head sequence
- latest transaction ID
- writer state

The UI explicitly states when changes are waiting for trusted synchronization. Local durability is not represented as publication.

## Multi-Tab Writer Control

The Canvas writer lease uses:

1. Web Locks when available.
2. BroadcastChannel coordination as the fallback.

Only one tab may append to a graph at a time.

Secondary tabs become read-only. A takeover candidate must verify the current graph head before it becomes writable. A stale tab enters `refresh-required` and must reload.

## Trusted Backend Journal

The Backend provides callable contracts for:

- opening a Studio branch
- committing an operation transaction
- reading canonical operation ranges
- creating trusted checkpoints
- restoring trusted checkpoints
- creating branches
- closing client sessions
- preparing immutable releases

The callable service enforces:

- Firebase Authentication
- active verified Firestore profiles
- role authorization
- company isolation
- App Check
- graph identity
- protocol versions
- branch-head revision checks
- transaction idempotency hashes
- operation-ID uniqueness
- canonical server sequences
- trusted graph snapshots
- immutable release prerequisites
- audit-log writes

Direct browser access to trusted Journal collections and checkpoint storage remains denied by Firebase rules.

## Graph-Scoped Trusted Branches

The Backend branch model owns exactly one graph ID. Reusing `local-draft` across multiple page graphs would cause `graph-id-conflict`.

The trusted client now derives a deterministic server branch for every graph:

```text
{logical-local-branch}--g-{stable-graph-hash}
```

Example:

```text
local-draft--g-4fa2d189
```

The logical browser branch remains `local-draft`, while each page graph receives a stable isolated server branch.

This mapping is used consistently for:

- branch opening
- transaction commits
- operation ranges
- trusted checkpoints
- trusted recovery
- branch creation
- session closure
- immutable release preparation

## Trusted Checkpoints

A trusted checkpoint may be created only when:

- the graph is valid
- all local transactions have synchronized
- graph identity matches the branch
- graph revision matches the server branch head

The graph snapshot is stored through the trusted Backend path and its metadata is recorded in the canonical local Journal.

Recovery installs:

- checkpoint metadata
- graph snapshot
- accepted transactions after the checkpoint
- current branch head

The operation Journal replays only accepted, non-rejected records.

## Immutable Release Gate

Release preparation is blocked when:

- pending transaction IDs remain
- the branch head differs from the requested revision
- the checkpoint is not trusted
- the checkpoint does not represent the current branch head
- the graph identity differs
- the caller lacks publishing permission

The release service prepares an immutable release record. It does not bypass the existing Blueprint publishing authority.

## Static Validation

The credential-free `static` workflow now runs:

1. Design System audit
2. Studio component catalog audit
3. Studio action and icon audit
4. Blueprint serialization audit
5. Blueprint operation audit
6. CanvasSession audit
7. Trusted Studio Journal audit
8. Master visual-QA architecture audit
9. Trusted Studio Journal Backend unit tests

The Backend tests run under Node 20 through:

```bash
npm run test:studio-journal
```

The workflow is triggered by changes to:

- Studio browser runtime
- Firebase Functions
- Firebase configuration
- architecture audits
- visual tests
- design-system documentation

## Authenticated Validation

The focused `studio` workflow runs five authenticated owner tests:

- Studio interactions
- Actions and icons
- Blueprint serialization
- Blueprint operation durability
- CanvasSession recovery and writer control

CanvasSession coverage includes:

- insert
- undo
- redo
- reload recovery
- local pending state
- read-only secondary tab
- writer takeover
- corrupted transaction failure
- graph-head mismatch failure

The tests do not bypass authentication and do not clear unrelated browser state.

## User Actions Required

### Action 1 — Run credential-free static validation

In GitHub:

1. Open `Evaraos/evaraos`.
2. Open **Actions**.
3. Select **Design System Visual QA**.
4. Select **Run workflow**.
5. Choose branch `evaraos`.
6. Keep suite set to `static`.
7. Run the workflow.
8. Open the `static-audit` job and confirm every step is green.

No repository secrets are required for this action.

### Action 2 — Deploy trusted Firebase Functions

From a terminal in a current checkout of the repository:

```bash
git checkout evaraos
git pull origin evaraos
npm --prefix functions install --no-audit --no-fund
npm --prefix functions run test:studio-journal
npx firebase-tools@latest login
npx firebase-tools@latest use evaraos-web
npx firebase-tools@latest deploy --only functions --project evaraos-web
```

The repository already targets `evaraos-web`, uses `functions/` as its Functions source, and defines Node 20 for the deployed runtime.

After deployment, confirm these callables appear in Firebase Functions in region `us-central1`:

- `openStudioBranch`
- `commitStudioTransaction`
- `getStudioOperationRange`
- `createStudioCheckpoint`
- `restoreStudioCheckpoint`
- `createStudioBranch`
- `closeStudioSession`
- `prepareStudioRelease`

### Action 3 — Configure authenticated QA

Create a synthetic owner QA user. The user must:

- exist in Firebase Authentication
- have a matching `users/{uid}` Firestore profile
- have active status
- use the canonical `owner` role
- have a valid company ID
- contain no personal or production-sensitive data

Add these GitHub repository secrets:

```text
EVARA_QA_BASE_URL
EVARA_QA_OWNER_EMAIL
EVARA_QA_OWNER_PASSWORD
```

Then run **Design System Visual QA** again with suite `studio`.

## App Check

The web client already initializes Firebase App Check using ReCAPTCHA Enterprise and requests callable Functions from `us-central1`.

Because trusted Journal callables enforce App Check, the deployed QA and production domains must remain registered and accepted in the Firebase App Check configuration. Local browser testing requires an explicitly configured App Check debug token; authentication must not be bypassed.

## Migration

No destructive migration is required.

The authority extension:

1. Opens the existing Journal database.
2. Reads existing operation transactions.
3. Resequences graph records according to operation count.
4. Preserves transaction IDs and revision history.
5. Preserves rejected records as immutable history.
6. Rebuilds graph heads.
7. Preserves compatibility checkpoints.
8. Adds trusted checkpoints alongside compatibility checkpoints.

Existing locally durable records remain pending until the trusted callable service confirms them.

## Rollback Plan

If trusted synchronization causes a regression:

1. Remove `studio-trusted-journal.js` from the Studio entrypoint.
2. Keep `studio-journal-authority-v2.js` active.
3. Continue operating in local-only durability mode.
4. Do not delete local operation transactions.
5. Do not delete trusted server records.
6. Disable release preparation until the conflict is resolved.
7. Re-run static audits and Backend Journal tests.
8. Restore the trusted adapter only after graph identity and server-head compatibility are verified.

Canvas local editing, operation replay, undo, redo, checkpoints, and recovery remain available without the trusted transport.

## Current Risks

1. GitHub Actions execution has not yet been observed.
2. Trusted Firebase Functions deployment has not yet been confirmed.
3. Authenticated Studio browser tests have not yet been observed.
4. App Check domain acceptance has not been verified for the QA origin.
5. Existing server branches created before graph-scoped branch mapping may require explicit trusted recovery or archival.
6. The compatibility visual builder remains a second migration surface.
7. Immutable release preparation is not final product publishing.
8. Server conflicts still require operator-facing resolution UX.
9. Collaboration beyond one browser writer per graph remains future work.

## Impact Assessment

### Positive impact

- Corrupted transactions fail closed.
- Revision and sequence chains are validated.
- Local changes clearly show as unsynchronized.
- Secondary tabs cannot write concurrently.
- Writer takeover verifies graph freshness.
- Backend transactions are idempotent.
- Canonical server sequences are assigned.
- Trusted checkpoints support durable recovery.
- Multiple page graphs no longer collide on one server branch.
- Releases are blocked until synchronization and checkpoint requirements pass.
- Credential-free validation is available.
- Backend domain tests are part of the same static gate.

### Change risk

The trusted transport becomes active as soon as the callable Functions are deployed and an authenticated Studio session is available. Until deployment, Studio remains local-first and displays pending or offline state.

## Affected Systems

- Evara Studio
- Canvas Engine
- Blueprint Engine
- Evara Graph Core
- Operation & History Engine
- Draft Journal
- Journal Authority v2
- writer lease
- sync diagnostics
- Firebase Authentication
- Firebase App Check
- Cloud Functions
- Firestore
- Cloud Storage
- audit logs
- trusted checkpoints
- immutable releases
- GitHub Actions
- authenticated visual QA

## Dependencies

- Evara Graph schema `0.1.0`
- Evara Operation Protocol `0.1.0`
- Blueprint component document `1.0.0`
- canonical IndexedDB Journal
- Studio Journal Authority v2
- Firebase project `evaraos-web`
- Functions runtime Node 20
- Firebase Authentication
- active Firestore user profile
- company scope
- App Check
- GitHub Actions
- deployed QA origin
- synthetic owner QA account

## Future Scalability

This architecture supports:

- canonical cloud transaction history
- offline synchronization queues
- trusted branch recovery
- graph-aware branching
- immutable releases
- AI and human edits through one operation protocol
- server conflict resolution
- operation-range streaming
- collaboration sessions
- audit-grade history
- release manifests
- production publishing cutover

## Recommendation

After all three user actions pass, proceed to:

# Phase 4O — Conflict Resolution UX & Production Authoring Cutover

Phase 4O should:

- expose server conflicts in Studio
- compare local and canonical branch heads
- offer reload, reject-local, recover-checkpoint, and create-branch choices
- prove trusted checkpoint restoration in authenticated QA
- prove immutable release preparation
- migrate page authoring from the compatibility builder to CanvasSession
- retain compatibility projection only as a rollback/export view

## Live Checklist

- [x] transaction-chain integrity validation
- [x] canonical sequence validation
- [x] commit-envelope validation
- [x] corrupted transaction recovery code
- [x] graph-head mismatch recovery code
- [x] pending local transaction diagnostics
- [x] unsynchronized-change UI
- [x] graph writer lease
- [x] read-only secondary tabs
- [x] deterministic writer takeover
- [x] Journal Authority v2
- [x] trusted callable client
- [x] graph-scoped server branch mapping
- [x] trusted Backend domain core
- [x] callable service
- [x] App Check enforcement
- [x] trusted checkpoint service
- [x] trusted recovery plan
- [x] immutable release gate
- [x] credential-free static workflow
- [x] Backend Journal unit tests in CI
- [x] focused trusted Journal architecture audit
- [x] duplicate trusted adapter removed
- [ ] static GitHub workflow executed
- [ ] trusted Firebase Functions deployed
- [ ] callable deployment verified
- [ ] QA secrets configured
- [ ] authenticated Studio workflow executed
- [ ] Playwright artifacts reviewed
- [ ] trusted checkpoint restoration executed
- [ ] immutable release preparation executed

## Approval Status

**🟡 Approved with Changes**

Phase 4N is source-complete and architecturally approved. Static execution, trusted Functions deployment, authenticated execution, and artifact review remain mandatory gates before production authoring approval.
