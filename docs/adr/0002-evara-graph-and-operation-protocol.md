# ADR 0002: Evara Graph and Operation Protocol

## Status
Accepted

## Context

Studio Core currently understands modules, components, and blueprints through separate registries. Those registries are useful, but they cannot safely power drag-and-drop editing, role-aware previews, undo/redo, history, branching, or atomic publishing because they do not share one canonical document model.

EvaraOS needs a framework-neutral source of truth that represents the operating system itself rather than rendered HTML or individual pages.

## Decision

Studio Core will use two foundational protocols:

1. **Evara Graph** — a normalized, declarative graph containing every editable operating-system object and every typed relationship between those objects.
2. **Evara Operation Protocol** — an append-only stream of typed, reversible mutations applied to an Evara Graph draft.

Rendered DOM, CSS, framework components, and Firebase documents are runtime projections. None of them is the canonical Studio document.

## Graph invariants

- Every graph has a globally unique `graphId` and semantic `schemaVersion`.
- Every node has a stable ID, a registered node kind, props, metadata, and revision number.
- Every edge has a stable ID, registered relationship kind, source node, target node, and optional props.
- Node and edge IDs are unique within a graph.
- Every edge must reference existing nodes.
- Published releases are immutable.
- Drafts may only be changed through operations.
- Permission visibility is modeled explicitly and is never inferred only from hidden UI.
- Theme values should resolve through tokens rather than hardcoded component values.
- Responsive behavior is represented as contextual overrides on one semantic tree, not duplicated device page trees.

## Initial node families

- Experience: workspace, application, page, route, modal, panel, navigation, frame, container
- Interface: component definition, component instance, slot, text, icon, image, button, card, chart, map, form, table, list, calendar
- Design: theme, token collection, token, token mode, variable, style rule, effect, animation, transition, responsive condition
- Operations: data entity, data field, query, filter, action, workflow, notification, automation, integration
- Security: role, capability, permission policy, visibility rule, data scope, field mask, approval policy
- Lifecycle: blueprint, blueprint instance, draft, branch, snapshot, release, environment, migration, audit event

## Initial edge kinds

- contains
- inherits
- instantiates
- bindsTo
- visibleTo
- triggers
- readsFrom
- writesTo
- styledBy
- overrides
- dependsOn
- publishesAs
- guards
- navigatesTo
- emits
- consumes

## Operation protocol

Every edit is represented by an envelope containing:

- operation ID
- protocol version
- graph ID
- actor
- timestamp
- operation type
- payload
- optional precondition
- optional inverse data
- transaction ID
- correlation ID

The first supported operation set is:

- `node.create`
- `node.delete`
- `node.patch`
- `edge.create`
- `edge.delete`
- `graph.meta.patch`
- `selection.set` (ephemeral; never published)
- `transaction.commit`

Operations are validated before application. Transactions apply atomically to a cloned draft and are committed only if the final graph passes structural validation.

## Undo and redo

Undo is based on inverse operations, not whole-document replacement. Operations that destroy or overwrite data must carry enough prior state to produce a deterministic inverse.

Checkpoints and release snapshots still exist for recovery, comparison, and publishing, but they are not the primary undo mechanism.

## Draft and release boundary

- A draft contains the graph plus its operation journal.
- Autosave persists accepted operations and the draft head revision.
- Publishing validates and compiles a draft into an immutable release manifest.
- Runtime applications consume immutable releases, never mutable Studio drafts.
- Rollback activates a previously compiled release rather than attempting to reverse production field-by-field.

## Compatibility

Existing Studio component, module, and blueprint registries remain supported through a legacy registry adapter. The adapter converts registry entries into graph nodes and edges without changing the original registry files.

This allows incremental migration rather than a destructive rewrite.

## Consequences

### Positive

- One source of truth can power canvas, layers, role preview, history, blueprints, and publishing.
- Undo/redo becomes deterministic.
- Change impact can be calculated by traversing graph relationships.
- Runtime technology can evolve without rewriting Studio documents.
- Existing registry investments can be absorbed gradually.

### Tradeoffs

- Every new Studio feature must register its node, edge, and operation contracts.
- Migrations are required when graph schemas change.
- Runtime rendering requires a compiler/projection layer.
- Strict validation may initially expose inconsistencies currently hidden across registries.

## Non-goals for this phase

- Building the visual canvas
- Replacing current production pages
- Connecting drafts to Firestore
- Publishing compiled releases to production
- Changing the current application UI

This phase establishes the engine contract those systems will use.