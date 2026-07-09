# Phase 4M — Blueprint Operation Adapter & Draft Journal Integration

Date: **2026-07-09**  
Blueprint operation adapter: **blueprint-operation-adapter-v1**  
Semantic command contract: **canvas-semantic-command-v1**  
Journal operation envelope: **studio-journal-operation-envelope-v1**  
Evara operation protocol: **0.1.0**  
Evara Graph schema: **0.1.0**  
Phase status: **Source complete; automated execution pending**

## Live Progress

Overall Design System: `[███████████████████░] 98%`  
Phase 4M implementation: `[███████████████████░] 98%`  
Evara Studio: `[█████████████░░░░░░░] 66%`  
Blueprint Engine: `[██████████████░░░░░░] 68%`  
Evara Graph Core: `[████████░░░░░░░░░░░░] 42%`  
Operation & History Engine: `[█████████░░░░░░░░░░░] 45%`  
Canvas Engine sandbox: `[█████████░░░░░░░░░░░] 45%`

## Architecture Review

Phase 4M converts differences between two validated Blueprint component documents into semantic Canvas commands and reversible Evara operations. Those operations are persisted through the existing IndexedDB Draft Journal.

The implementation reuses:

- Blueprint document schema `1.0.0`
- Blueprint-to-Graph compiler
- Evara Graph node and edge contracts
- Evara Operation Protocol `0.1.0`
- the existing `evaraos-studio-journal` IndexedDB database
- existing sessions, transactions, and checkpoints stores
- existing legacy browser projection as a temporary compatibility input
- existing Canvas semantic command vocabulary

It does not create another:

- database
- transaction store
- history stack
- graph format
- operation protocol
- publishing service
- backend API
- Canvas runtime
- component registry
- permission system

## Canonical Edit Translation

The compatibility adapter observes the existing Studio prototype's content and Auto Layout projection writes.

For every settled change it:

1. Captures the projection before and after the write.
2. Finds the affected Studio pages.
3. Serializes each page into Blueprint documents.
4. Verifies that the durable journal fingerprint matches the source document.
5. Compiles both documents into the same stable page graph ID.
6. Infers semantic Canvas intents.
7. Computes the low-level graph delta.
8. Applies the transaction through `applyTransaction`.
9. Compares the resulting graph with the graph compiled from the target Blueprint.
10. Rejects the transaction if semantic graph parity fails.
11. Persists accepted operations, inverse operations, and the commit operation atomically in the existing Journal.
12. Advances the page graph's revision head.
13. Updates the projection hash so the delayed compatibility saver does not store the same semantic edit twice.

## Semantic Command Contract

Every durable transaction contains one primary command and all detected intents.

Supported detected intents:

- `canvas.component.insert`
- `canvas.component.delete`
- `canvas.component.move`
- `canvas.layout.set`
- `canvas.visibility.set`
- `canvas.property.set`

The command envelope includes:

- command version
- primary intent
- all detected intents
- actor
- correlation ID
- page ID
- Blueprint ID
- document ID
- source fingerprint
- target fingerprint
- added instance IDs
- removed instance IDs

These semantic commands remain history and interaction contracts. They are not a second persistence protocol.

## Graph Delta Compilation

The adapter emits only registered low-level Evara operation types:

- `node.create`
- `node.delete`
- `node.patch`
- `edge.create`
- `edge.delete`
- `graph.meta.patch`
- `transaction.commit`

Removed or structurally replaced edges are deleted before node deletion. Added nodes are created before their edges. Node changes are patched through the Operation Protocol. Graph compiler metadata is advanced to the target Blueprint fingerprint.

Every operation includes:

- semantic intent
- semantic command version
- adapter version
- page ID
- source fingerprint
- target fingerprint
- actor
- correlation ID
- transaction ID

## Semantic Graph Parity Gate

The adapter compares semantic graph signatures after applying the transaction.

The signature includes:

- graph ID
- graph state
- node IDs, kinds, names, and properties
- edge IDs, kinds, source, target, and properties
- Blueprint compiler metadata and fingerprint

Runtime timestamps and revision counters are not part of semantic parity.

If the operation result does not exactly reproduce the target Blueprint graph, the transaction is not written to the Journal and Studio enters a recovery-required diagnostic state.

## Draft Journal Operation Envelopes

The existing Journal now accepts `studio-journal-operation-envelope-v1` transactions containing:

- company, project, and branch scope
- stable graph ID
- graph schema version
- operation protocol version
- expected and accepted revisions
- local sequence values
- semantic command
- accepted operations
- inverse operations
- commit operation
- actor and correlation ID
- affected node IDs
- source document and fingerprint
- local creation timestamp
- durability state
- projection hash

The existing transactions object store remains authoritative for local recovery.

## Per-Graph Revision Heads

The Studio session record now maintains a `graphHeads` map.

Each graph head stores:

- revision
- sequence
- latest transaction ID
- update timestamp

Stable graph IDs use:

```text
graph:studio:{blueprint-role}:{page-id}
```

Examples:

```text
graph:studio:owner:owner-dashboard
graph:studio:owner:settings
graph:studio:customer:customer-portal
```

This allows independent page branches to advance without forcing unrelated pages onto one revision counter.

## Conflict Protection

The Journal rejects a transaction when its expected revision differs from the current graph head.

The adapter also rejects work when the latest durable fingerprint does not match the source Blueprint fingerprint.

A conflict emits diagnostics containing:

- graph ID
- transaction ID
- expected revision
- current revision
- error message

The adapter never overwrites a newer head.

## Idempotency

Transaction IDs are immutable.

When the same transaction ID is submitted again, the Journal returns the existing envelope instead of inserting another record or advancing the graph head.

The transactions store uses `add()` for new operation envelopes so accidental replacement of an immutable record fails.

## Compatibility Projection Suppression

The original Journal bridge schedules whole-state compatibility snapshots after the legacy builder writes localStorage.

After a semantic operation transaction becomes durable, Phase 4M updates the Journal's last projection hash. The delayed compatibility task sees the same hash and returns without writing a duplicate record.

Compatibility records remain available for:

- legacy migration
- checkpoint restoration
- temporary prototype state that does not alter the serialized Blueprint
- rollback after removing the operation adapter

## Authority Boundary

The operation adapter is labeled:

```text
authority: draft-journal-compatibility-adapter
trustedCommitRequired: true
```

It may:

- observe current prototype projection writes
- serialize before and after Blueprint documents
- compile graph deltas
- apply local Evara transactions
- verify semantic parity
- append local operation envelopes
- emit durability and conflict diagnostics

It may not:

- open another IndexedDB database
- create another object store
- write directly to localStorage
- call Firebase or external APIs
- publish or roll back a Blueprint
- write the trusted server journal
- bypass revision checks
- treat local durability as production publication

## Current Production Boundary

The legacy visual builder currently writes its browser projection before the adapter receives the settled change.

This provides reversible local migration coverage, but it does not satisfy the final production invariant that an accepted graph transaction must become journal-durable before the Canvas reports the edit saved or projects it as accepted state.

Production Canvas integration remains blocked until the Operation Dispatcher owns the edit before projection mutation.

## Automated Validation

### Static architecture audit

```bash
node tools/studio-blueprint-operation-audit.js
```

The audit checks:

- reuse of the existing Journal database and stores
- operation-envelope version
- per-graph heads
- conflict checks
- idempotent transaction insertion
- inverse operations
- semantic command coverage
- graph parity enforcement
- absence of direct localStorage writes
- absence of another IndexedDB authority
- absence of network or publishing calls
- Studio runtime load order
- focused test coverage
- CI integration

### Authenticated browser test

```text
tests/visual/specs/studio-blueprint-operations.spec.mjs
```

The test verifies:

- component insertion becomes `canvas.component.insert`
- accepted operations exclude compatibility replacement operations
- inverse operations are present
- commit operation matches the transaction
- revision advances
- duplicate submission is idempotent
- property edits become `canvas.property.set`
- Auto Layout changes become `canvas.layout.set`
- graph head sequence advances
- no compatibility transaction duplicates the latest semantic projection hash
- operation envelopes and graph heads are attached as artifacts

## Migration Requirements

No production backend migration is executed in Phase 4M.

Browser-local migration behavior:

1. Existing Journal sessions are normalized with an empty `graphHeads` map.
2. Existing compatibility transactions remain readable.
3. New semantic transactions use the existing transactions store.
4. The first semantic transaction for each page begins at revision zero.
5. Later transactions must match the page graph head.
6. Existing checkpoints remain valid compatibility projections.
7. Published browser-state writes remain blocked.

Future trusted migration must:

1. create canonical project, branch, and graph identifiers
2. migrate local operation envelopes through a trusted validator
3. verify actor, tenant, protocol, graph, and Blueprint versions
4. check expected server branch revision
5. assign authoritative sequence values
6. preserve transaction idempotency
7. store inverse operations or a trusted checkpoint reference
8. reconcile local compatibility checkpoints
9. reject unpublished or invalid component definitions
10. publish only through an immutable release

## Rollback Plan

If Phase 4M causes a regression:

1. Remove `blueprint-operation-adapter.js` from the Studio entrypoint.
2. Restore the previous `studio-document-model.js` cache version.
3. Keep the existing Journal database, stores, and compatibility records.
4. Ignore operation envelopes by filtering on `envelopeVersion`.
5. Continue using compatibility projection checkpoints.
6. Do not delete operation transactions; retain them for diagnosis and future migration.
7. Re-run all Studio architecture audits and focused tests.

No production server data requires rollback because Phase 4M performs no network writes.

## Live Checklist

- [x] Existing Evara Operation Protocol reused
- [x] Existing Evara Graph reused
- [x] Existing Blueprint serializer reused
- [x] Existing IndexedDB Journal reused
- [x] Existing transaction store reused
- [x] Operation envelope version added
- [x] Per-graph revision heads added
- [x] Idempotent transaction handling
- [x] Expected-revision conflict rejection
- [x] Durable inverse operations
- [x] Durable commit operation
- [x] Stable page graph IDs
- [x] Semantic insert inference
- [x] Semantic delete inference
- [x] Semantic move inference
- [x] Semantic layout inference
- [x] Semantic visibility inference
- [x] Semantic property inference
- [x] Graph delta compiler
- [x] Semantic graph parity gate
- [x] Projection duplicate suppression
- [x] Runtime diagnostics
- [x] Authenticated test authored
- [x] Static audit authored
- [x] Master visual-QA audit aligned
- [x] CI workflow integration
- [x] Module dashboard updated
- [x] QA operating guide updated
- [ ] Static workflow execution confirmed
- [ ] Authenticated browser test executed
- [ ] Generated artifacts reviewed
- [ ] Journal-backed undo and redo
- [ ] Startup graph replay
- [ ] Multi-tab writer coordination
- [ ] Trusted branch commit service
- [ ] Server conflict recovery
- [ ] Immutable release integration

## Current Risks

1. GitHub status checks have not yet been observed for the final Phase 4M commit.
2. Authenticated execution requires a deployed QA URL and owner credentials.
3. The legacy builder mutates browser state before semantic durability.
4. Undo and redo still use the prototype's in-memory whole-state history.
5. Startup recovery restores compatibility checkpoints rather than replaying operation envelopes into Evara Graph.
6. Multi-tab editing is not coordinated with a writer lease.
7. Local graph heads are not authoritative server revisions.
8. The current generic node patch relies on the parity gate to reject any field-removal mismatch.
9. Compatibility records can still be created for ephemeral prototype writes that do not change the serialized Blueprint.
10. The trusted backend cannot yet accept component-instance documents or operation transactions.

## Impact Assessment

### Positive impact

- Studio edits now have semantic transaction records.
- Operations and inverse operations share one protocol.
- Page graphs have independent revision heads.
- Stale local transactions are rejected.
- Duplicate semantic transactions are idempotent.
- Successful semantic edits avoid duplicate whole-state journal entries.
- Operation artifacts are inspectable by QA and future server migration tools.
- Existing Canvas sandbox ownership remains unchanged.

### Change risk

The adapter observes the legacy projection after mutation. It is a governed migration bridge, not the final production Operation Dispatcher.

## Affected Systems

- Evara Studio
- Blueprint Engine
- Evara Graph Core
- Operation & History Engine
- Draft Journal
- Component Engine
- Auto Layout
- Property Inspector
- Action and Icon configuration
- Canvas sandbox load order
- Visual QA
- CI architecture audits
- Studio module registry

## Dependencies

- Blueprint document schema `1.0.0`
- Blueprint graph compiler v1
- Evara Graph schema `0.1.0`
- Evara Operation Protocol `0.1.0`
- Studio Journal IndexedDB database
- current visual-builder projection
- current Auto Layout projection
- authenticated owner QA account
- future trusted branch commit service

## Future Scalability

The architecture can support:

- persistent undo and redo through compensating transactions
- startup graph replay
- branch checkpoints
- conflict-resolution UI
- offline queues
- server-confirmed sequence numbers
- multi-tab writer leases
- collaboration branches
- AI and human edits through the same command path
- transaction telemetry
- impact analysis
- release manifests
- immutable publishing

## Recommendation

Proceed to:

# Phase 4N — Persistent Operation History, Undo/Redo & Recovery

Phase 4N should replace prototype whole-state undo and redo with compensating Evara transactions. It should also replay durable operation envelopes at startup, create graph-aware checkpoints, detect unsynchronized changes, and preserve the compatibility projection only as a rollback view.

The production Canvas should remain blocked until commands become durable before accepted projection mutation.

## Approval Status

**🟡 Approved with Changes**

Phase 4M is source-complete and architecturally approved as a compatibility migration. Static workflow execution, authenticated browser execution, and artifact review remain required validation gates.
