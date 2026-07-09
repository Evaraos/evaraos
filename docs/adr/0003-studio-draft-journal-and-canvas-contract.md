# ADR 0003: Studio Draft Journal and Canvas Contract

## Status
Accepted

## Context

EvaraOS now has a canonical Evara Graph and reversible Operation Protocol, but the current Studio visual builder still owns an independent browser-only state model. It stores complete editor state in localStorage, keeps undo/redo history in memory, and treats browser storage as publication. That prototype is useful for validating interaction concepts, but it cannot become the authoritative Studio runtime.

Studio needs a durable draft model that survives reloads, supports autosave and persistent undo, rejects stale writes, and allows Canvas work to progress without creating a second source of truth.

## Decision

Studio Core will use an append-only draft journal with transaction boundaries, branch revisions, local recovery, trusted server acceptance, and immutable release boundaries.

The Canvas Engine is a projection and interaction surface for Evara Graph. It never owns canonical document state and never writes production configuration directly.

## Canonical edit flow

1. A user performs a visual interaction.
2. The interaction controller groups temporary pointer or text activity into one semantic intent.
3. The intent compiles into one or more Evara operations.
4. The operations apply atomically to a cloned graph.
5. The resulting transaction and inverse transaction are written to a local write-ahead journal.
6. The accepted local graph becomes the active Canvas projection.
7. Autosave submits the transaction to a trusted server service.
8. The service verifies identity, company scope, permissions, protocol versions, idempotency, and expected branch revision.
9. The service assigns authoritative sequence and revision values.
10. The client marks the transaction server-confirmed or enters conflict recovery.

## Persistence layers

### Active memory

The active graph, selection, viewport, interaction previews, and unsaved editor state live in memory while Studio is open.

### Local recovery journal

IndexedDB stores pending and confirmed transaction envelopes, inverse transactions, recovery metadata, and the latest trusted checkpoint reference. localStorage is limited to small preferences and must not store the canonical graph.

### Trusted server journal

Canonical projects, branches, transactions, operation ranges, checkpoints, and releases are written only by trusted server code. Direct client writes to canonical journal collections are prohibited.

## Required branch invariants

- Every branch has a stable branch ID, graph ID, head revision, and head sequence.
- Every committed transaction is immutable.
- Every operation ID and transaction ID is idempotent.
- Server sequence numbers define canonical order; client timestamps do not.
- Expected head revision is checked for every commit.
- Published releases are immutable and never edited in place.
- Undo and redo append compensating transactions; they never delete history.
- Selection and pointer previews are ephemeral and never published.

## Canvas authority boundary

The Canvas may:

- project graph nodes into visual render objects;
- display selection, hover, drag, resize, snap, viewport, and role-preview state;
- generate semantic commands;
- request transactions through the Operation Dispatcher;
- render local optimistic results after journal durability succeeds.

The Canvas may not:

- maintain an independent canonical page/component model;
- write complete editor state to localStorage;
- mutate Evara Graph outside the Operation Protocol;
- write Firestore or Cloud Storage directly;
- publish by copying browser state;
- infer authorization solely from hidden UI;
- bypass branch revision checks, journaling, or release validation.

## Canvas interfaces

- `CanvasSession`: active project, branch, graph, revision, page, viewport, preview role, and durability state.
- `GraphProjection`: read-only conversion from Evara Graph to Canvas render objects.
- `OperationDispatcher`: exclusive path for persistent graph mutations.
- `InteractionController`: temporary pointer and keyboard gesture state.
- `SelectionController`: ephemeral selected, hovered, focused, and marquee state.
- `LayoutResolver`: Flow, Grid, and Spatial layout resolution.
- `SnapResolver`: grid, sibling, parent, baseline, and breakpoint snapping.
- `ViewportController`: zoom, pan, device frame, and responsive context.
- `HistoryController`: semantic transaction history, undo, redo, and checkpoint requests.

## Minimum semantic Canvas commands

- `canvas.component.insert`
- `canvas.component.move`
- `canvas.component.resize`
- `canvas.component.reparent`
- `canvas.component.duplicate`
- `canvas.component.delete`
- `canvas.property.set`
- `canvas.layout.set`
- `canvas.visibility.set`
- `canvas.token.bind`
- `canvas.data.bind`

These commands compile into the registered low-level graph operation types. Semantic commands are history and interaction contracts, not a second persistence protocol.

## Production Canvas unblock gate

Production Canvas integration is allowed only when all of the following are true:

- completed Canvas gestures generate semantic transactions;
- transactions persist to the local write-ahead journal before being reported durable;
- startup recovery restores the graph and pending transactions;
- undo and redo survive reloads;
- server commits are idempotent;
- stale branch revisions return explicit conflicts rather than overwriting;
- unsynchronized changes block release publication;
- the Canvas reads and writes only through Evara Graph and journal contracts.

Canvas interaction work may proceed earlier in a sandbox using in-memory fixtures and a mock dispatcher, provided it does not write production data.

## Ownership

- Chief Architect owns this contract, system boundaries, compatibility rules, and approval gates.
- Studio Engine owns Canvas and local journal implementation.
- Backend owns trusted commit, checkpoint, and operation-range services.
- Security owns authorization enforcement and company isolation.
- Design System owns reusable visual primitives, not Canvas persistence.

## Compatibility

The current visual builder remains an interaction prototype during migration. Its component rendering, selection, role-preview, and editing concepts may be adapted, but its browser-only canonical state, whole-state undo, hardcoded page library, and local publication path must not be extended as production architecture.

The existing trusted blueprint service remains a compatibility projection until Evara Graph becomes the single source of truth.

## Consequences

### Positive

- Canvas and journal work can proceed in parallel.
- One canonical graph powers Canvas, layers, inspector, history, blueprints, role preview, and publishing.
- Autosave, recovery, persistent undo, and future collaboration share one protocol.
- AI and human edits use the same governed path.

### Tradeoffs

- The visual builder prototype must be adapted instead of simply expanded.
- Backend and Studio teams must implement against stable interfaces.
- Semantic command registration becomes mandatory for new Canvas capabilities.
- Conflict handling and checkpointing add implementation complexity before production editing is enabled.

## Non-goals

- Directly redesigning Studio UI.
- Replacing current production pages in this ADR.
- Implementing collaborative CRDT behavior.
- Publishing mutable draft graphs to runtime applications.
