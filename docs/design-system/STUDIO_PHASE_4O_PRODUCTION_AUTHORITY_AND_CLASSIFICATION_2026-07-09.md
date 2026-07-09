# Phase 4O — Production Authoring Authority, Conflict Resolution & Classification

Date: **2026-07-09**  
Branch: **`evaraos`**  
Production authoring authority: **CanvasSession / Evara Graph**  
Compatibility editor classification: **migration-only projection**  
Trusted Journal adapter: **trusted-studio-journal-v2**  
Production authority contract: **studio-production-authority-v1**

## Classification Decision

### Source classification

**✅ Production-ready source**

The repository now contains the architecture, implementation, security boundaries, recovery paths, release gates, and automated checks required for production deployment.

### Deployment classification

**🟡 Release candidate — deployment required**

The trusted Firebase Functions and updated hosting assets must be deployed from an exact reviewed `evaraos` commit.

### Runtime classification

**🔴 Not yet verified as active production**

A runtime may be called active production only after:

1. Static GitHub validation passes.
2. Trusted Firebase Functions deploy successfully.
3. Updated hosting deploys successfully.
4. Authenticated Studio QA passes against the deployed origin.
5. Trusted synchronization, checkpoint creation, recovery, and immutable release artifacts are reviewed.

No document, UI label, or architecture status may imply that an undeployed or unverified runtime is live production.

## Architecture Review

Evara Studio now has one production authoring authority:

```text
Graph Canvas
  → CanvasSession
  → semantic command
  → Evara Operation Protocol
  → canonical local Journal
  → recomputed idempotency guard
  → graph-scoped writer lease
  → trusted callable adapter
  → atomic server branch commit
  → canonical server sequence
  → trusted checkpoint
  → immutable release preparation
```

The original visual builder remains loaded only to support:

- Blueprint migration
- compatibility comparison
- export
- rollback reference
- migration QA

It cannot create a trusted checkpoint or immutable release. The release guard rejects every graph whose ID does not begin with:

```text
graph:canvas:
```

Therefore the compatibility builder is not a second production editor.

## Production Authority Enforcement

`studio-production-authority.js` provides:

- `canvas-session` as the single production authority
- `migration-only` classification for the compatibility builder
- a visible authority badge
- a visible compatibility migration notice
- Canvas-only trusted checkpoint enforcement
- Canvas-only immutable release enforcement
- conflict and recovery UI
- retry synchronization
- reject-local and recover-trusted flow
- trusted recovery branch creation
- immutable local history retention

The browser body exposes:

```text
data-studio-authoring-authority="canvas-session"
data-studio-compatibility-mode="migration-only"
```

## Conflict Resolution

Trusted synchronization never uses silent last-write-wins behavior.

When a conflict or recovery-required response occurs, Studio provides:

1. **Retry synchronization**
   - Re-runs the graph synchronization queue.
   - Succeeds only if the canonical server head accepts the transaction chain.

2. **Create recovery branch**
   - Uses the latest trusted checkpoint.
   - Creates a new graph-scoped server branch.
   - Does not rewrite the current trusted branch.

3. **Reject local and recover trusted**
   - Preserves rejected local records as immutable history.
   - Restores the latest trusted checkpoint and confirmed transactions.
   - Reloads Canvas from the verified graph.

4. **Keep local draft**
   - Dismisses the conflict UI without discarding local records.
   - Publishing remains blocked.

## Immutable Release Gate

A release may be prepared only when all conditions are true:

- Firebase user is authenticated.
- Firestore profile is active and approved.
- Caller has publisher authority.
- Canvas integrity is `verified`.
- Current tab owns the graph writer lease.
- Graph ID is a Canvas graph.
- No conflict or recovery-required transaction exists.
- No unsynchronized transaction remains.
- Server branch head equals the requested graph revision.
- A trusted checkpoint exists at the exact branch head.
- Checkpoint graph hash is valid.
- App Check succeeds.

The release record is immutable and is classified as `prepared`. Product publishing or customer traffic cutover remains a separate operational action.

## Current Risks

1. GitHub Actions results have not been observed through the connected GitHub interface.
2. Trusted Firebase Functions deployment has not been observed.
3. Updated hosting deployment has not been observed.
4. Authenticated Studio QA has not been observed against the deployed origin.
5. App Check acceptance for the deployed QA/production origin has not been verified.
6. Recovery branch creation is implemented, but branch switching and selective transaction replay can be expanded later.
7. Real-time multi-user collaboration remains future work; the current guarantee is one browser writer per graph.
8. Immutable release preparation is not the same as traffic activation or final product publishing.

## Impact Assessment

### Positive

- One production editor and one release authority.
- No dual-authority production writes.
- Local-first durability remains available during network outages.
- Unsynchronized changes are visible and block releases.
- Same transaction ID with changed content fails closed.
- Server branch revisions are atomic.
- Server operation sequences are canonical.
- Corrupt records and graph-head mismatches fail closed.
- Multi-tab writes are serialized.
- Trusted checkpoints provide verified recovery.
- Conflicts provide operator choices instead of silent overwrites.
- Releases require explicit publisher authority.

### Compatibility

- Existing local visual-builder state is preserved.
- Existing Blueprint serialization remains available.
- Existing compatibility checkpoints remain available.
- Existing local operation history is not deleted.
- Trusted records are not rewritten during rollback.

## Affected Systems

- Evara Studio
- Canvas Engine
- Blueprint Engine
- Evara Graph Core
- Operation & History Engine
- Trusted Journal & Release Engine
- Firebase Authentication
- Firebase App Check
- Cloud Functions
- Firestore
- Cloud Storage
- audit logs
- GitHub Actions
- authenticated visual QA

## Dependencies

- Evara Graph schema `0.1.0`
- Evara Operation Protocol `0.1.0`
- Blueprint component-document contract
- canonical IndexedDB Journal
- Studio Journal Authority v2
- Firebase project `evaraos-web`
- Node 20 Functions runtime
- active user profile and company scope
- registered App Check origin
- synthetic owner QA account

## Future Scalability

This authority supports:

- multiple graph-scoped branches
- trusted branch recovery
- conflict branch creation
- AI and human operations through one protocol
- canonical cloud history
- offline transaction synchronization
- future selective transaction replay
- future multi-user collaboration
- immutable release manifests
- audit-grade authoring history

## Production Activation Procedure

### Gate 1 — Review exact commit

Record the final `evaraos` commit SHA. Do not deploy a moving branch reference without verifying the resolved SHA.

### Gate 2 — Run static validation

Run **Design System Visual QA** with suite `static` and confirm:

- design-system audit
- component catalog audit
- action and icon audit
- Blueprint serialization audit
- Blueprint operation audit
- CanvasSession audit
- trusted Journal audit
- production-authority audit
- master visual-QA audit
- trusted backend unit tests

### Gate 3 — Deploy trusted backend and hosting

Use the repository workflow:

```text
Firebase Production Release
```

Required confirmation phrase:

```text
DEPLOY EVARAOS PRODUCTION
```

Recommended mode after reviewing the exact SHA:

```text
all
```

This deploys:

- hosting
- trusted Functions
- Firestore rules and indexes
- Storage rules

### Gate 4 — Run authenticated Studio QA

Run **Design System Visual QA** with suite `studio` against the deployed base URL.

Required evidence:

- Canvas insert, undo, redo, and reload recovery
- secondary-tab read-only behavior
- writer takeover
- same-ID idempotent retry
- changed-content ID conflict
- trusted synchronization
- canonical server sequence
- trusted checkpoint
- immutable release preparation
- corrupt transaction fail-closed
- graph-head mismatch fail-closed
- no uncaught browser errors

### Gate 5 — Review artifacts

Review:

- Playwright report
- recovery JSON
- writer-lease JSON
- idempotency JSON
- trusted release JSON
- screenshots
- console output
- Firebase Functions logs
- audit-log records

### Gate 6 — Runtime classification update

Only after all gates pass, update:

```text
classification: active-production
deploymentState: deployed
validationState: verified
```

## Rollback Plan

If the trusted transport regresses after deployment:

1. Disable immutable release preparation.
2. Remove the trusted adapter from the Studio entrypoint in a reviewed rollback commit.
3. Keep Journal Authority v2 active.
4. Keep CanvasSession active in local-first mode.
5. Preserve local transactions.
6. Preserve server transactions, checkpoints, releases, and audit logs.
7. Do not delete or rewrite history.
8. Re-run static and authenticated validation before restoring transport.

## Architecture Dashboard

### Completed

- [x] canonical local Journal
- [x] strong local idempotency guard
- [x] trusted backend Journal core
- [x] eight callable contracts
- [x] App Check enforcement
- [x] company and role authorization
- [x] atomic branch heads
- [x] canonical operation sequences
- [x] trusted checkpoints
- [x] trusted recovery
- [x] immutable release preparation
- [x] unsynchronized release blocking
- [x] writer lease
- [x] corrupt-record recovery
- [x] head-mismatch recovery
- [x] conflict UI
- [x] recovery branch action
- [x] Canvas-only release authority
- [x] migration-only compatibility classification
- [x] production audits
- [x] source classification registry

### Pending external execution

- [ ] static workflow observed green
- [ ] trusted Functions deployed
- [ ] hosting deployed
- [ ] App Check verified
- [ ] authenticated Studio QA observed green
- [ ] artifacts reviewed
- [ ] runtime classified active production

## Progress

Source implementation: `████████████████████ 100%`  
Production readiness: `██████████████████░░ 90%`  
Deployment: `░░░░░░░░░░░░░░░░░░░░ 0%`  
Authenticated runtime verification: `░░░░░░░░░░░░░░░░░░░░ 0%`

## Recommendation

Deploy the exact reviewed `evaraos` commit through the protected Firebase production workflow, then run the authenticated Studio suite and review the trusted release artifacts. No additional architecture or source implementation is required to begin that activation process.

## Approval Status

**🟡 Approved with Changes**

The source is approved as a production-ready release candidate. Active-production classification remains blocked only by protected deployment and authenticated runtime verification. This boundary is intentional and must not be bypassed.
