# Phase 4M Addendum — CanvasSession Journal Reconciliation

Date: **2026-07-09**  
Status: **Controlled active-sandbox integration; authenticated execution pending**

## Context

After the Phase 4M architecture record was published, coordinated Canvas commits introduced and activated:

- `canvas-operation-journal.js`
- `canvas-session.js`
- `canvas-history-controller.js`
- `canvas-session-sandbox.js`
- startup replay of operation envelopes
- compensating undo and redo
- durability-before-graph-acceptance
- a dedicated authenticated CanvasSession test
- CI and static architecture enforcement

These additions touch the same authority boundary as Phase 4M and are therefore governed by this reconciliation.

## Architecture Review

The activated Canvas sandbox is compatible with Phase 4M because it reuses:

- `window.EvaraStudioJournal`
- `appendOperationTransaction`
- `listOperationTransactions`
- `getGraphHead`
- Evara Operation Protocol replay
- inverse operations
- the existing transaction and session stores
- the Blueprint component-document compiler
- existing GraphProjection, controllers, layout, and snap systems

It does not open another IndexedDB database, write localStorage, call Firebase, or create another operation protocol.

## Active Runtime

`public/website-builder.html` now loads:

```text
studio-document-model.js
studio-blueprint-serialization.js
blueprint-operation-adapter.js
canvas-session-sandbox.js
```

The previous `canvas-sandbox.js` remains in the repository as rollback/reference code but is not loaded by the Studio entrypoint.

The Canvas Engine remains classified as **active-sandbox**, not production-published runtime.

## Direct CanvasSession Flow

CanvasSession performs this sequence:

1. Compile the current authored Blueprint graph or create the sandbox recovery fixture.
2. Replay durable operation envelopes in sequence order.
3. Compare replayed graph revision with the Journal graph head.
4. Prepare a semantic command through the registered dispatcher.
5. Apply the transaction to a candidate graph.
6. Await the canonical Journal append.
7. Accept the candidate graph only after the append resolves.
8. Reproject the accepted graph.
9. Refresh persistent history state.
10. Emit the durable CanvasSession snapshot.

This ordering satisfies the local durability-before-accepted-projection rule inside the active sandbox.

## Recovery

`CanvasOperationJournal.initialize()` replays every durable operation envelope for its graph ID. Recovery fails closed when:

- a transaction has no operations;
- an operation cannot be replayed;
- the resulting graph is invalid; or
- replayed revision differs from the Journal graph head.

Failures emit `recovery-required` rather than silently accepting a stale graph.

## Persistent Undo and Redo

`HistoryController` derives undo and redo stacks from the durable transaction stream.

Undo appends a new `history.undo` transaction containing the target transaction's inverse operations.

Redo appends a new `history.redo` transaction containing the undo transaction's inverse operations.

History records are immutable and are not deleted or rewritten.

## Controlled Activation Gate

The activation is protected by:

- `tools/studio-canvas-sandbox-audit.js`
- `tools/studio-blueprint-operation-audit.js`
- `tests/visual/specs/studio-canvas-session.spec.mjs`
- the focused Studio GitHub Actions suite

The audits verify:

- the canonical Journal remains the only persistence authority;
- operation replay and graph-head checks fail closed;
- Journal durability resolves before graph promotion;
- compensating undo and redo remain present;
- CanvasSession owns no direct storage or network transport;
- the deprecated rollback sandbox is not loaded;
- the active runtime loads after Blueprint operation integration;
- syntax checks pass when the GitHub workflow executes.

## Current Risks

1. The authenticated CanvasSession test is authored and wired but has not been observed executing successfully.
2. Canvas graph checkpoints remain deferred to the trusted Backend journal service.
3. Server-confirmed revisions and authoritative sequence values are not connected.
4. Multi-tab writer coordination is not implemented.
5. The compatibility visual builder still mutates its browser projection before Phase 4M observes and journals that separate path.
6. The active CanvasSession is still an authenticated sandbox, not the production page-authoring replacement.
7. Corruption and deliberate graph-head mismatch recovery require executed browser tests.
8. Local durability must not be represented as publication or trusted server confirmation.

## Impact Assessment

### Positive

- The active Canvas sandbox now uses the canonical operation Journal.
- Accepted Canvas state is promoted only after local durability succeeds.
- Reload recovery can replay durable operation envelopes.
- Undo and redo append compensating transactions.
- Blueprint graphs and Canvas history share stable graph IDs and revision heads.
- The prior isolated mock sandbox is no longer the loaded runtime.

### Constraints

- The sandbox classification remains mandatory.
- Trusted checkpoints, server commits, conflicts, and immutable releases remain external dependencies.
- The compatibility builder and the CanvasSession are two migration surfaces and must not become competing production editors.

## Recommendation

Proceed to Phase 4N with emphasis on execution and hardening rather than another history system:

- execute and review authenticated CanvasSession tests;
- verify undo and redo survive reloads;
- test corrupted operations and graph-head mismatch recovery;
- add writer-lease or read-only multi-tab behavior;
- add unsynchronized-change indicators;
- define trusted checkpoint and branch-commit interfaces;
- prove the active sandbox can replace compatibility editing before removing the migration adapter.

## Approval Status

**🟡 Approved with Changes**

Controlled CanvasSession activation is architecturally approved for the Studio sandbox. Authenticated execution, artifact review, multi-tab control, trusted checkpoints, and server confirmation remain required before production authoring approval.
