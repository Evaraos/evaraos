# Phase 4K — Studio Action Configuration & Icon Library Integration

Date: **2026-07-09**  
Design-system version: **2.0.0**  
Icon registry: **icon-registry-v1**  
Action binding: **action-binding-v1**  
Property bridge: **canonical-property-bridge-v1**  
Phase status: **Implementation complete; authenticated execution pending**

## Progress

Overall Design System: `[███████████████████░] 98%`  
Phase 4K implementation: `[███████████████████░] 98%`  
Evara Studio: `[██████████░░░░░░░░░░] 50%`  
Component Engine: `[█████████████░░░░░░░] 64%`

## Architecture Review

Phase 4K extends the existing property inspector with permission-aware action configuration and one canonical SVG icon registry.

The implementation reuses:

- `access-control.js` for route authorization
- `component-registry.js` for component ownership
- `studio-visual-builder.js` for state, persistence, rendering, undo, and redo
- `studio-property-bridge.js` for synchronous property edit compatibility
- `studio-component-inspector.js` for the existing inspector surface
- the Draft Journal for compatibility transactions and recovery
- the current role-preview selector
- the existing `.eva-icon` rendering and motion contracts

No second navigation system, route policy, permission system, editor, persistence writer, icon painter, or action runtime was introduced.

## Action model

Action configuration is separated into three values:

| Property | Purpose |
|---|---|
| `action` | Visible CTA label |
| `actionIntent` | Semantic behavior identifier |
| `actionTarget` | Permission-approved route, when applicable |

Supported semantic intents:

- no action
- navigate
- open messages
- open scheduling
- submit workflow
- approve record
- open approved panel

Studio does not execute protected business operations. Submit, approve, and panel intents remain configuration metadata until an approved production runtime binds them.

## Permission-aware destinations

Navigation targets are created by intersecting:

1. a curated set of Studio-safe routes
2. `pagesForRole(previewRole)` from the canonical access-control system

The selected destination is also checked with `canAccessPageName`.

Changing the Studio preview role immediately recalculates whether the saved destination remains authorized. Unauthorized destinations remain visible as configuration findings and are marked invalid rather than silently redirected or treated as permitted.

## Icon Library

`public/assets/js/icons/icon-registry.js` provides:

- stable icon IDs
- searchable names and keywords
- safe SVG node definitions
- component-default icon mappings
- legacy symbol aliases
- ID normalization
- safe DOM SVG creation

The registry renders through `document.createElementNS` and does not use HTML-string injection.

Initial catalog coverage includes:

- AI and highlights
- cards and text
- analytics and status
- forms and uploads
- settings and preferences
- conversations and messages
- maps, locations, and routes
- jobs and services
- timelines and media
- teams, customers, and vendors
- calendar and time
- revenue
- navigation and notifications

## Legacy icon migration

Existing Studio drafts may contain symbols such as `◈`, `✦`, `⬢`, or `↗`.

The icon registry maps these values to canonical IDs at render time. When the owner selects an icon through the new picker, the canonical ID is stored through the existing Studio history path.

Phase 4K intentionally does not mass-rewrite all local drafts outside undo/redo and Draft Journal observation.

## Canonical property bridge

The existing visual builder locates editable fields immediately after a rerender. Structured inspector values therefore need compatible hidden editable fields to exist before the next animation frame.

`studio-property-bridge.js`:

- runs immediately after the visual builder
- reads the existing Studio state
- prepends canonical hidden edit bridges
- includes action intent and target for action-capable components
- reuses the builder's double-click and focus-out edit lifecycle
- does not write directly to local storage
- does not create another history stack

This also stabilizes the Phase 4J property inspector.

## Studio interface

The existing property inspector now provides:

### Action configuration

- editable visible CTA label
- semantic behavior selector
- role-filtered destination selector
- current preview-role status
- clear allowed, warning, or rejected route state
- versioned action-binding metadata

### Icon configuration

- searchable icon library
- canonical SVG previews
- accessible icon buttons
- selected-state indication
- canonical icon-ID persistence
- legacy-symbol compatibility

## Observability

Canvas nodes expose:

- `data-action-binding`
- `data-action-intent`
- `data-action-target`
- `data-action-allowed`
- `data-icon-registry`
- `data-icon-id`
- `data-property-bridge`

These attributes support visual QA, debugging, and future Blueprint serialization without becoming authorization controls themselves.

## Migration Requirements

No server migration is required.

Browser-local migration behavior:

1. Existing symbols remain readable through alias normalization.
2. Newly selected icons persist as canonical IDs.
3. Existing action labels remain unchanged.
4. New action intent defaults to `none`.
5. New action target defaults to an empty route.
6. Navigation routes must pass canonical preview-role authorization.

Future server-backed Studio documents must preserve the same semantic fields and version identifiers.

## Rollback Plan

If the action/icon enhancement causes a regression:

1. Remove `studio-action-icon-config-v2.js` and its stylesheet from the Studio entrypoint.
2. Keep `studio-property-bridge.js`, because it also stabilizes the existing property inspector.
3. Existing action labels and legacy icons continue rendering through the visual builder.
4. Canonical icon IDs remain plain strings and can still resolve through the registry.
5. Re-run the Studio catalog, action/icon, and focused authenticated tests.

The superseded first-draft action/icon module was deleted and must not be restored.

## Automated Validation

### Static audit

`node tools/studio-action-icon-audit.js` checks:

- icon registry existence and version
- required canonical icons
- safe SVG DOM construction
- canonical property bridge contracts
- absence of a second persistence writer
- absence of unsafe DOM or code-execution sinks
- access-control reuse
- action intent and target contracts
- icon picker and permission-state styling
- Studio load order
- removal of the superseded draft
- focused interaction test coverage
- CI workflow integration

The master visual-QA audit also requires both focused Studio suites.

### Authenticated tests

The focused `studio` workflow suite runs:

- `studio-interactions.spec.mjs`
- `studio-action-icon.spec.mjs`

The action/icon test verifies:

- action labels remain editable text
- semantic navigation intent persists
- authorized owner destination selection
- canonical icon search and persistence
- SVG rendering
- role change from owner to customer
- unauthorized destination invalidation
- screenshot and state artifacts
- no uncaught page errors

## Live Checklist

- [x] Existing route policy reused
- [x] Existing preview-role system reused
- [x] Existing property inspector reused
- [x] Existing visual-builder state reused
- [x] Existing history reused
- [x] Existing Draft Journal preserved
- [x] Action label separated from behavior
- [x] Semantic action intents added
- [x] Permission-filtered destinations added
- [x] Role-change validation added
- [x] Canonical icon registry added
- [x] Safe SVG renderer added
- [x] Legacy icon aliases added
- [x] Searchable icon picker added
- [x] Canonical property bridge added
- [x] Superseded draft removed
- [x] Dedicated static audit added
- [x] Master visual audit aligned
- [x] Focused authenticated test added
- [x] CI focused suite updated
- [x] QA operating guide updated
- [x] Studio progress updated
- [ ] Repository QA secrets confirmed
- [ ] Focused authenticated suite executed
- [ ] Screenshots and state artifacts reviewed
- [ ] Production action execution bindings
- [ ] Blueprint serialization implementation
- [ ] Server-backed Studio documents

## Current Risks

1. The authenticated Studio suites have not been executed from this environment because workflow dispatch and secret access are unavailable.
2. Submit, approve, and panel intents are configuration metadata only; production execution bindings are not part of this phase.
3. Existing local drafts retain legacy symbol values until owners replace those icons through Studio.
4. The safe route catalog is intentionally curated. New production routes require explicit Studio review before inclusion.
5. Frontend route validation does not replace production authorization at APIs, records, files, or backend operations.

## Impact Assessment

### Positive impact

- Owners can configure actions without page-specific code.
- Studio route choices now respect the canonical preview-role policy.
- Icons use stable searchable IDs and consistent SVG rendering.
- Existing component drafts remain compatible.
- Action and icon changes use the same undo, redo, persistence, and journal path.
- Future Blueprints receive stable semantic values instead of arbitrary JavaScript or glyphs.

### Change risk

The enhancement depends on the existing visual builder's edit lifecycle. Any replacement builder must formally migrate the canonical property-bridge contract rather than silently removing it.

## Affected Systems

- Evara Studio
- Component Engine
- Property Inspector
- Visual Builder
- Draft Journal
- Role Preview
- Access Control
- Design System icons
- Visual QA
- Studio module registry

## Dependencies

- `access-control.js`
- `component-registry.js`
- `studio-visual-builder.js`
- `studio-property-bridge.js`
- `studio-component-inspector.js`
- `icon-registry.js`
- Design System v2 icon CSS
- Draft Journal compatibility layer
- authenticated owner QA account

## Future Scalability

The versioned contracts can support:

- Blueprint action serialization
- route parameters with validated schemas
- approved modal and panel targets
- workflow-operation bindings
- feature-capability requirements
- contextual resource ownership checks
- organization-aware route filtering
- icon categories and favorites
- custom organization icon packs
- icon replacement migrations
- component action analytics
- Studio linting for unreachable destinations

No future extension should store executable JavaScript in component actions.

## Recommendation

The next phase should be **Phase 4L — Blueprint Component Instances & Serialization**.

It should define a stable, versioned document representation for:

- component contract ID
- component version
- properties
- icon reference
- action binding
- layout metadata
- role visibility
- responsive behavior
- validation state
- migration metadata

It must reuse the current component registry, property inspector, action binding, icon registry, permission model, Auto Layout, Draft Journal, and future trusted document service.

## Approval Status

**🟡 Approved with Changes**

Phase 4K implementation is approved. Authenticated execution and artifact review remain required before the focused Studio validation gate can be marked complete.
