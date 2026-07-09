# Phase 4M Addendum — CanvasSession Journal Reconciliation

Date: **2026-07-09**  
Status: **Architecture reconciled; direct Canvas activation deferred**

## Context

After the Phase 4M architecture record was published, additional Canvas foundation commits introduced:

- `canvas-operation-journal.js`
- a CanvasSession bridge to the canonical Studio Journal
- startup replay of operation envelopes
- compensating undo and redo through `HistoryController`
- durability-before-graph-acceptance inside CanvasSession

These additions touch the same authority boundary as Phase 4M and therefore require explicit reconciliation.

## Architecture Review

The new Canvas foundation is compatible with Phase 4M because it reuses:

- `window.EvaraStudioJournal`
- `appendOperationTransaction`
- `listOperationTransactions`
- `getGraphHead`
- Evara Operation Protocol replay
- inverse operations
- the existing transaction and session stores

It does not open another IndexedDB database, write localStorage, call Firebase, or create another operation protocol.

## Direct CanvasSession Flow

CanvasSession now performs this sequence:

1. Compile or obtain a base Evara Graph.
2. Replay durable operation envelopes in sequence order.
3. Compare the replayed graph revision with the Journal graph head.
4. Prepare a semantic command through the existing dispatcher.
5. Apply the transaction to a candidate graph.
6. Await the canonical Journal append.
7. Accept the candidate graph only after the append resolves.
8. Reproject the accepted graph.
9. Refresh persistent history state.

This ordering satisfies the local durability-before-accepted-projection rule inside CanvasSession.

## Recovery

`CanvasOperationJournal.initialize()` replays every durable operation envelope for its graph ID. Recovery fails closed when:

- a transaction has no operations;
- an operation cannot be replayed;
- the resulting graph is invalid; or
- replayed revision differs from the Journal graph head.

Failures emit `recovery-required` rather than silently falling back to a potentially stale graph.

## Persistent Undo and Redo

`HistoryController` derives undo and redo stacks from the durable transaction stream.

Undo appends a new `history.undo` transaction containing the target transaction's inverse operations.

Redo appends a new `history.redo` transaction containing the undo transaction's inverse operations.

History records are not deleted or rewritten.

## Current Activation Boundary

The active `canvas-sandbox.js` still imports and owns `MockOperationDispatcher` directly. It does not import `CanvasSession` or `CanvasOperationJournal`.

Therefore:

- the CanvasSession journal bridge is staged foundation code;
- the currently visible Canvas sandbox remains an isolated sandbox;
- Phase 4M's active production-page integration remains the Blueprint compatibility adapter;
- direct CanvasSession activation requires a separate migration and authenticated test gate.

## Static Enforcement

`tools/studio-blueprint-operation-audit.js` now verifies:

- CanvasSession reuses the canonical Journal;
- Canvas operation recovery uses protocol replay;
- graph-head mismatch fails closed;
- the Journal append occurs before CanvasSession accepts the graph;
- compensating undo and redo remain present;
- CanvasSession owns no direct storage or network transport;
- the active sandbox does not silently activate CanvasSession.

## Current Risks

1. CanvasSession replay and compensating history have not been executed in authenticated browser QA.
2. The active sandbox still uses its isolated mock dispatcher.
3. Canvas graph checkpoints remain deferred to the trusted Backend journal service.
4. Server-confirmed revisions and authoritative sequence values are not connected.
5. Multi-tab writer coordination is not implemented.
6. The compatibility builder still mutates browser projection before Phase 4M observes and journals its change.

## Recommendation

Phase 4N should activate and validate persistent Canvas history in a controlled sandbox migration. It must add:

- authenticated CanvasSession replay tests;
- compensating undo and redo tests across reloads;
- corruption and graph-head mismatch recovery tests;
- writer-lease or read-only multi-tab behavior;
- unsynchronized-change indicators;
- trusted checkpoint and server-commit interfaces.

The existing sandbox must not be switched to CanvasSession merely by changing an import.

## Approval Status

**🟡 Approved with Changes**

The CanvasSession foundation is architecturally compatible and now statically guarded. Runtime activation and authenticated execution remain unapproved.
