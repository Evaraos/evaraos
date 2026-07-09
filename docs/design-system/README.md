# EvaraOS Design System

Version: **2.0.0**  
Registry: **registry-v1**  
Status: **Stable foundation; authenticated visual QA pending**

## Progress

`[███████████████████░] 96%`

- [x] Foundation tokens
- [x] Central Liquid Glass material authority
- [x] Core structural primitives
- [x] Workflow primitives
- [x] Settings and preference primitives
- [x] Communication primitives
- [x] Marketplace and operations primitives
- [x] Canonical aggregate bundle
- [x] Machine-readable component registry
- [x] Studio component contract connection
- [x] Static ownership audit
- [ ] Authenticated cross-device and cross-appearance visual QA

## Architecture authority

EvaraOS uses one visual authority chain:

1. `public/assets/css/base/variables.css`
   - spacing
   - typography
   - radii
   - icon sizing
   - semantic colors
   - motion
   - elevation
   - responsive layout tokens
2. `public/assets/css/theme/liquid-optics.css`
   - authoritative Liquid Glass fill
   - blur
   - borders and optical edges
   - highlights
   - material elevation
   - surface material states
3. `public/assets/css/design-system/primitives.css`
   - reusable component anatomy and interaction contracts
4. Domain systems
   - `workflows.css`
   - `settings.css`
   - `communications.css`
   - `marketplace.css`
5. Page composition styles
   - layout exceptions only
   - no new material engines
   - no duplicate token systems

No page, feature team, or Studio component may create a second glass engine, spacing scale, typography scale, shadow scale, control runtime, or semantic status system.

## Canonical load order

```html
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/theme.css">
<link rel="stylesheet" href="/assets/css/design-system.css?v=2">
<link rel="stylesheet" href="/assets/css/pages/example-page.css">
```

`design-system.css` is the canonical aggregate bundle. It imports all reusable systems. `theme.css` must load before it.

## Registry

Machine-readable registry:

```text
public/assets/js/design-system/registry.js
```

Runtime compatibility and registry loader:

```text
public/assets/js/design-system.js
```

Studio component adapter:

```text
public/assets/js/studio/component-registry.js
```

The registry exposes:

- design-system version
- layer ownership
- stable component contracts
- Studio-editable properties
- compatibility selectors
- deprecated patterns
- material authority
- prerequisite stylesheets

## Stable layers

| Layer | Source | Ownership |
|---|---|---|
| Tokens | `base/variables.css` | Spacing, type, color, shape, motion, elevation |
| Material | `theme/liquid-optics.css` | Liquid Glass rendering |
| Primitives | `design-system/primitives.css` | Layout, card, text, icon, control anatomy |
| Workflows | `design-system/workflows.css` | Forms, approvals, onboarding, uploads |
| Settings | `design-system/settings.css` | Settings hubs, fields, choices, switches |
| Communications | `design-system/communications.css` | Conversations, bubbles, composer, sheets |
| Marketplace | `design-system/marketplace.css` | Services, orders, payouts, schedule, dispatch, tracking |

## Studio contract

New Studio components should use canonical metadata instead of relying only on page-specific classes.

### Foundation attributes

```html
<section data-ui="surface" data-glass="surface"></section>
<article data-ui="card" data-glass="card" data-density="comfortable"></article>
<button data-ui="control" data-glass="control" data-size="md"></button>
<span data-ui="icon" data-size="sm"></span>
<p data-ui="text" data-style="body" data-tone="muted"></p>
```

### Layout attributes

```html
<div data-layout="stack"></div>
<div data-layout="cluster"></div>
<div data-layout="grid"></div>
<div data-layout="split"></div>
```

### Allowed shared properties

- `data-size="xs|sm|md|lg|xl"`
- `data-density="compact|comfortable|spacious"`
- `data-style="display|title|heading|body|label|caption|overline"`
- `data-shape="rounded|pill|square|circle"`
- `data-tone="muted|soft|positive|critical"`
- `data-state="active|pressed|selected|loading|error|empty"`
- `data-interactive="true"`
- `data-glass="surface|card|control"`

Feature-specific data attributes may describe content or runtime state, but they may not redefine global visual architecture.

## Component categories

### Foundation

- Container
- Stack
- Cluster
- Responsive Grid
- Split Layout
- Surface
- Card
- Divider
- Typography
- Icon Frame
- Control

### Workflows

- Workflow Shell
- Workflow Hero
- Workflow Form
- Workflow Field
- File Upload
- Workflow Notice

### Settings

- Settings Shell
- Settings Panel
- Settings Hub Card
- Settings Field
- Settings Choice Grid
- Settings Switch

### Communications

- Conversation List
- Conversation Row
- Message Bubble
- Message Composer
- Communication Action Sheet
- Conversation Media Viewer

### Marketplace and Operations

- Service Card
- Marketplace Cart
- Operational Status Pill
- Live Tracking Card
- Marketplace Map
- Operations Calendar
- Dispatch Board
- Field Assignment Card
- Lifecycle Timeline

## Compatibility policy

Legacy classes remain supported where production pages already use them, but they are not the authoring standard for new Studio components.

| Compatibility selector | Canonical direction |
|---|---|
| `.glass-card` | `data-ui="surface" data-glass="surface"` |
| `.btn-theme-primary` | `eva-control` plus control/glass metadata; class remains a material variant hook |
| `.btn-theme-secondary` | `eva-control` plus control/glass metadata; class remains a material variant hook |
| `.input-shell` | `data-ui="control" data-glass="control"` |
| `.aurora-card` | Decoration hook only; not component anatomy |
| `.active-glow` | Explicit `data-state="active"` for new components |
| `.beam-target` | Pointer runtime hook only |
| `.item` | Registered domain card contract |
| `.pill` | Registered semantic status or metadata component |

## Deprecated patterns

Do not add:

- new page-level glass fills or blur engines
- new global color, spacing, radius, type, motion, or shadow scales
- unregistered generic `.item` or `.pill` systems
- inline page painters for reusable components
- hardcoded appearance-specific text colors without semantic tokens
- duplicate button, input, switch, card, modal, sheet, toast, or status systems
- selectors that depend on visual appearance instead of semantic state
- Studio components without a registry contract

Existing compatibility selectors should be migrated when their owning page is next changed. They do not require destructive mass replacement.

## Accessibility requirements

Every reusable component must support, where applicable:

- visible keyboard focus
- minimum touch target sizing
- disabled and busy states
- reduced motion
- forced colors
- text scaling and long-content wrapping
- semantic labels and live regions
- safe-area and mobile viewport behavior
- sufficient light, dark, system, and image-mode contrast

## Validation

Run:

```bash
node tools/design-system-audit.js
```

The audit checks:

- required files
- aggregate bundle imports
- single material authority
- registry layers and component contracts
- Studio registry connection
- Studio bundle version
- stale v1 bundle links
- missing import targets
- page styles attempting to own global material authority

## Change policy

A new reusable component must:

1. Use existing foundation tokens.
2. Delegate glass rendering to `liquid-optics.css`.
3. Reuse an existing domain system when possible.
4. Receive a registry entry before Studio publication.
5. Define accessibility and responsive states.
6. Avoid business logic and backend ownership.
7. Include a migration path for any legacy selector it replaces.

A new design-system layer requires Chief Architect approval because it expands the global architecture surface.
