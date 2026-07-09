# Phase 4L — Blueprint Component Instances & Serialization

Date: **2026-07-09**  
Blueprint registry: **blueprint-engine-v2**  
Blueprint document schema: **1.0.0**  
Component instance schema: **1.0.0**  
Serializer: **blueprint-serializer-v1**  
Graph compiler: **blueprint-graph-compiler-v1**  
Phase status: **Implementation complete; authenticated execution pending**

## Progress

Overall Design System: `[███████████████████░] 98%`  
Phase 4L implementation: `[███████████████████░] 98%`  
Evara Studio: `[███████████░░░░░░░░░] 56%`  
Component Engine: `[██████████████░░░░░░] 70%`  
Blueprint Engine: `[████████████░░░░░░░░] 60%`  
Evara Graph Core: `[██████░░░░░░░░░░░░░░] 28%`  
Operation & History Engine: `[████░░░░░░░░░░░░░░░░] 20%`

## Architecture Review

Phase 4L defines one versioned, non-executable Blueprint component-instance document that can represent the current Studio page without making the browser prototype authoritative.

The document includes:

- stable document identity
- canonical Blueprint role
- state and revision
- pages and sections
- component definition references
- component properties
- canonical icon references
- semantic action bindings
- grid and Auto Layout metadata
- responsive values
- explicit role visibility
- validation findings
- migration metadata
- deterministic fingerprint

The document can be projected back into a Studio-compatible page and compiled into Evara Graph.

The implementation reuses:

- the canonical access-control role and route policy
- the Studio component registry
- Design System component contracts
- the icon registry
- the action-binding contract
- Auto Layout state
- Evara Graph node and edge constructors
- the existing visual builder only as a compatibility input

It does not introduce another editor, inspector, permission system, component registry, graph format, state writer, history stack, publication runtime, or backend API.

## Blueprint document contract

Top-level contract:

```text
kind: evara.blueprint.component-document
schemaVersion: 1.0.0
documentId: blueprint-document:{blueprint}:{page}
blueprintId: canonical Blueprint identifier
role: canonical access role
state: draft | review | release-candidate | published | archived
revision: non-negative integer
pages: ordered page and section structure
instances: component-instance object map
metadata: version and migration envelope
validation: valid, warning, or invalid
```

Each component instance contains:

- instance ID
- component definition ID
- Studio component-engine version
- Design System version and contract ID
- normalized properties
- icon registry and icon ID
- action label, intent, destination, and route finding
- layout mode, span, order, group, radius, and glass values
- base, tablet, and mobile behavior
- canonical role visibility map
- validation warnings and errors
- source migration metadata

## Deterministic identity

Active-page documents use page-scoped IDs:

```text
blueprint-document:owner:owner-dashboard
blueprint-document:owner:settings
```

The Blueprint role remains canonical while each page capture remains independently identifiable.

Fingerprints exclude the generation timestamp and validation envelope. Repeated captures of the same semantic document produce the same `bp_XXXXXXXX` fingerprint when the actor and content remain unchanged.

## JSON Schema

Machine-readable schema:

```text
docs/schemas/blueprint-component-document.schema.json
```

The schema uses JSON Schema 2020-12 and defines:

- canonical roles
- document states
- page and section limits
- Auto Layout groups
- component instances
- icon references
- action bindings
- layout spans
- responsive modes
- complete role visibility maps
- migration metadata
- document metadata
- fingerprint format

The JSON Schema is the required trust-boundary validator for future server acceptance.

## Legacy migration

The serializer accepts three source shapes:

1. current schema `1.0.0` documents
2. current Studio visual-builder state
3. legacy Blueprint registry entries containing navigation, sections, and component IDs

Legacy component IDs become component instances with:

- canonical definition references
- registry defaults
- default grid layout
- normalized icon IDs
- default `none` action binding
- canonical role visibility
- migration source and version metadata

The migration is non-destructive. It returns a new document and does not overwrite the source.

## Studio compatibility projection

A valid Blueprint document can be projected back into:

- one Studio page
- component node properties
- icon and action values
- style values
- responsive values
- role visibility
- Auto Layout groups
- source document and fingerprint diagnostics

The projection does not write to Studio storage. Applying the projection requires a future Operation Dispatcher transaction.

## Evara Graph compilation

The compiler creates:

### Nodes

- workspace
- blueprint
- role
- page
- route
- frame
- component-definition
- component-instance
- action

### Edges

- `contains`
- `instantiates`
- `visibleTo`
- `triggers`
- `navigatesTo`

Every generated graph is passed through `validateEvaraGraph` before being returned.

The graph is currently a deterministic compatibility fixture. It is not committed to the trusted graph journal by the browser.

## Authority boundary

The Studio bridge is explicitly labeled:

```text
authority: read-only-compatibility-projection
trustedPublishRequired: true
```

It may:

- read current local prototype state
- capture a Blueprint document
- validate it
- serialize it
- produce diagnostics
- project it back to a Studio shape
- compile it into an in-memory Evara Graph

It may not:

- write local Studio state
- create a second persistence writer
- call the legacy `saveBlueprintDraft` function
- call publish or rollback functions
- write canonical Evara Graph state
- bypass the Draft Journal
- publish browser state

## Trusted server compatibility

The existing trusted Blueprint endpoint currently sanitizes input to:

- ID
- name
- role
- navigation
- section IDs and titles
- component definition IDs
- permissions
- engine version

It does not preserve component instances, properties, actions, icons, layout, responsive values, visibility, migration metadata, or graph identity.

Therefore Phase 4L intentionally does not send the new document to the current endpoint.

A new reviewed server schema, storage model, authorization layer, optimistic-concurrency contract, migration, and release compiler are required before trusted persistence.

## Automated validation

### Static audit

```bash
node tools/studio-blueprint-serialization-audit.js
```

The audit verifies:

- canonical Blueprint roles
- schema and version constants
- component-instance contracts
- migration functions
- round-trip projection
- graph compilation
- icon and action versions
- route policy reuse
- absence of direct persistence
- absence of legacy Blueprint mutation calls
- absence of unsafe DOM or execution sinks
- JSON Schema structure
- Studio load order
- focused browser-test coverage
- CI wiring

### Authenticated browser test

```text
tests/visual/specs/studio-blueprint-serialization.spec.mjs
```

The test configures a real component through Studio, creates an Auto Layout stack, captures a document, verifies a stable fingerprint, round-trips the document, compiles the graph, and attaches:

- Blueprint document JSON
- Studio projection JSON
- graph summary JSON
- screenshot
- console diagnostics when present

The focused Studio workflow runs this test with the Phase 4J and Phase 4K suites.

## Migration Requirements

No production data migration is executed in this phase.

Future trusted migration must:

1. read legacy role Blueprint state
2. resolve every component definition against the canonical registry
3. generate stable component-instance IDs
4. preserve section ordering
5. normalize icons and actions
6. validate role visibility
7. validate routes and capabilities
8. compile a candidate Evara Graph
9. write through the trusted Operation Protocol
10. create a checkpoint
11. retain the legacy projection until runtime parity is proven
12. publish only through an immutable release

## Rollback Plan

If the Phase 4L compatibility layer causes a regression:

1. Remove `studio-blueprint-serialization.js` from `website-builder.html`.
2. Keep the JSON Schema and document module for offline architecture review.
3. Keep the canonical Blueprint registry role corrections.
4. Continue using the current Studio prototype and legacy trusted Blueprint projection.
5. Do not delete or rewrite existing local Studio drafts.
6. Re-run the component, action/icon, Blueprint serialization, and visual-QA audits.

No production records require rollback because Phase 4L performs no server writes.

## Live Checklist

- [x] Canonical Blueprint roles
- [x] Manager Blueprint added
- [x] Sales role normalized
- [x] Versioned document kind
- [x] Versioned component instances
- [x] Machine-readable JSON Schema
- [x] Stable page-scoped document IDs
- [x] Deterministic fingerprints
- [x] Component definition references
- [x] Properties serialized
- [x] Icons serialized
- [x] Actions serialized
- [x] Grid layout serialized
- [x] Auto Layout serialized
- [x] Responsive values serialized
- [x] Role visibility serialized
- [x] Validation envelope
- [x] Migration metadata
- [x] Legacy registry migration
- [x] Studio-state migration
- [x] Studio round-trip projection
- [x] Evara Graph compiler
- [x] Graph validation
- [x] Read-only Studio bridge
- [x] No direct localStorage writer
- [x] No legacy publish calls
- [x] Static architecture audit
- [x] Focused authenticated test
- [x] CI workflow integration
- [x] QA operating guide
- [x] Module dashboard update
- [ ] Repository QA secrets confirmed
- [ ] Static GitHub Action execution confirmed
- [ ] Authenticated focused suite executed
- [ ] Generated artifacts reviewed
- [ ] Trusted server document schema
- [ ] Operation Dispatcher integration
- [ ] Server journal integration
- [ ] Conflict handling
- [ ] Release compiler

## Current Risks

1. The repository connector exposes no completed status context for the latest commits.
2. The authenticated test cannot run until the QA URL and owner credentials are available to GitHub Actions.
3. The current browser visual builder remains a compatibility source rather than canonical graph state.
4. The legacy trusted Blueprint service cannot store the new document without losing most fields.
5. Runtime role normalization supports legacy aliases, while the JSON Schema must remain strict at the trust boundary.
6. Graph compilation is in-memory and does not yet use the Operation Dispatcher or trusted journal.
7. Collaboration, branch conflict resolution, and immutable releases remain unimplemented.

## Impact Assessment

### Positive impact

- Blueprint instances now have stable, inspectable contracts.
- Component properties survive serialization.
- Icons and actions use canonical references.
- Layout and responsive behavior are portable.
- Explicit role visibility is preserved.
- Legacy Blueprints have a migration path.
- Studio can generate an Evara Graph fixture without creating a second graph format.
- Future AI and human editing can target the same document model.

### Change risk

The document is intentionally ahead of the trusted storage service. Connecting it prematurely to the legacy endpoint would silently discard critical fields.

## Affected Systems

- Evara Studio
- Blueprint Engine
- Component Engine
- Design System registry
- Icon Registry
- Action Binding
- Auto Layout
- Role Preview
- Access Control
- Evara Graph Core
- Visual QA
- CI architecture audits
- Studio module registry

## Dependencies

- Component Engine v4
- Design System registry
- Icon Registry v1
- Action Binding v1
- canonical access-control roles and routes
- Evara Graph schema `0.1.0`
- Studio property and action systems
- Auto Layout state
- Draft Journal architecture
- future trusted Blueprint document service

## Future Scalability

The contract can support:

- multiple pages per role Blueprint
- nested frames and slots
- component variants
- token and variable bindings
- data bindings
- workflow bindings
- breakpoint-specific property overrides
- organization overrides
- Blueprint inheritance
- reusable Blueprint packages
- migration chains
- AI-generated component transactions
- release manifests
- runtime diffing
- collaboration branches

Executable JavaScript and raw business logic must never be stored in component properties or action bindings.

## Recommendation

Proceed to:

# Phase 4M — Blueprint Operation Adapter & Draft Journal Integration

Phase 4M should compile Blueprint changes into semantic Canvas commands and Evara operations, including:

- component insert
- property update
- action update
- icon update
- layout update
- responsive update
- visibility update
- component move and delete

Transactions must become durable in the local Draft Journal before the Canvas reports them saved. Browser-local whole-state writes must remain a temporary compatibility projection, and trusted publication must remain blocked.

## Approval Status

**🟡 Approved with Changes**

Phase 4L is architecturally approved and source-complete. Static workflow execution, authenticated browser execution, and artifact review remain external validation gates.
