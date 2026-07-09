# EvaraOS Authenticated Visual QA

This workspace runs authenticated route, layout, accessibility-smoke, Studio interaction, Blueprint serialization, and screenshot-regression checks against a deployed EvaraOS environment.

It does **not** bypass Firebase Authentication, Firestore profile verification, route permissions, or role policies. Every saved browser session is created through the production login form using dedicated QA accounts.

## Coverage

### Roles

- platform administrator
- owner
- administrator
- manager
- sales
- technician
- cleaner
- customer
- vendor

Owner credentials are required. Other role credentials are optional for critical runs and required when `EVARA_QA_REQUIRE_ALL_ROLES=1`.

### Appearances

- light
- dark
- system
- image

### Device projects

- desktop Chromium — 1440 × 1100
- tablet Chromium — 1024 × 1366
- iPhone WebKit
- Android Chromium

### Route diagnostics

Each covered route checks:

- successful HTTP response
- no redirect to login for an authorized role
- completed application-ready state
- expected appearance mode
- root horizontal overflow
- keyboard focus reachability
- uncaught page errors
- console errors
- duplicate element IDs
- visible controls without accessible names

Visual cases compare deterministic viewport screenshots. Dynamic maps, live counters, timestamps, and realtime status values are masked so the baseline measures layout and visual treatment rather than volatile business data.

## Focused Studio diagnostics

The `studio` suite runs three authenticated owner tests in desktop Chromium.

### `studio-interactions.spec.mjs`

Checks:

- categorized catalog search
- component creation
- required-field validation
- property commits
- undo and redo
- Layers coordination
- Auto Layout stack creation
- Draft Journal checkpoint creation
- panel exclusivity
- screenshots and serialized local Studio state

### `studio-action-icon.spec.mjs`

Checks:

- separation of action label, intent, and destination
- permission-filtered route destinations
- role-change authorization invalidation
- canonical icon search and selection
- SVG icon rendering
- persisted `actionIntent`, `actionTarget`, and icon IDs
- screenshots and serialized property state

### `studio-blueprint-serialization.spec.mjs`

Checks:

- `evara.blueprint.component-document` schema version `1.0.0`
- page-scoped document identity
- deterministic fingerprints independent of generation time
- component definition references
- properties, icons, and action bindings
- grid span and Auto Layout metadata
- responsive values
- role visibility
- round-trip Studio projection
- compilation into Evara Graph
- `component-instance`, `instantiates`, `visibleTo`, and `navigatesTo` graph contracts
- Blueprint document, projection, graph summary, and screenshot artifacts

All three tests reset only Studio's browser-local draft keys. They do not clear authentication, appearance, or unrelated browser state, and they do not write production business records.

## Required environment

```bash
export EVARA_QA_BASE_URL="https://your-deployed-evaraos-origin.example"
export EVARA_QA_OWNER_EMAIL="qa-owner@example.com"
export EVARA_QA_OWNER_PASSWORD="use-a-secret-manager"
```

Optional role credentials follow the same format:

```text
EVARA_QA_PLATFORM_ADMIN_EMAIL
EVARA_QA_PLATFORM_ADMIN_PASSWORD
EVARA_QA_ADMIN_EMAIL
EVARA_QA_ADMIN_PASSWORD
EVARA_QA_MANAGER_EMAIL
EVARA_QA_MANAGER_PASSWORD
EVARA_QA_SALES_EMAIL
EVARA_QA_SALES_PASSWORD
EVARA_QA_TECHNICIAN_EMAIL
EVARA_QA_TECHNICIAN_PASSWORD
EVARA_QA_CLEANER_EMAIL
EVARA_QA_CLEANER_PASSWORD
EVARA_QA_CUSTOMER_EMAIL
EVARA_QA_CUSTOMER_PASSWORD
EVARA_QA_VENDOR_EMAIL
EVARA_QA_VENDOR_PASSWORD
```

Never commit credentials or browser storage-state files.

## Local installation

```bash
cd tests/visual
npm install --no-audit --no-fund
npx playwright install chromium webkit
```

## Focused Studio suite

```bash
npx playwright test \
  specs/studio-interactions.spec.mjs \
  specs/studio-action-icon.spec.mjs \
  specs/studio-blueprint-serialization.spec.mjs \
  --project=desktop-chromium
```

This is the smallest authenticated gate for Studio component authoring and Blueprint serialization.

## Critical matrix

The critical matrix runs route diagnostics in desktop Chromium and visual baselines in desktop Chromium plus iPhone WebKit.

```bash
EVARA_QA_MATRIX=critical npx playwright test
```

## Full matrix

The full matrix runs all configured role routes and visual cases across every device project.

```bash
EVARA_QA_MATRIX=full EVARA_QA_REQUIRE_ALL_ROLES=1 npx playwright test
```

## Create baseline candidates

```bash
EVARA_QA_MATRIX=critical npx playwright test --update-snapshots
```

Review every generated image before committing it. A changed baseline is not proof that a change is correct.

## Reports

Generated files:

```text
playwright-report/
test-results/
.auth/
specs/__screenshots__/
```

Only reviewed screenshot baselines under `specs/__screenshots__/` should be committed. Authentication state, traces, videos, reports, and local results remain ignored.

## GitHub Actions

Workflow:

```text
.github/workflows/design-system-visual-qa.yml
```

Automatic pushes and pull requests run five zero-dependency architecture checks:

1. Design System ownership audit
2. Studio component catalog and inspector audit
3. Studio action and icon audit
4. Studio Blueprint serialization audit
5. Visual-QA architecture audit

Authenticated QA is manual because it requires:

- a deployed QA origin
- dedicated Firebase test users
- repository secrets
- explicit selection of the `studio` or `all` suite
- critical or full coverage selection for the `all` suite

The `studio` suite runs all three focused Studio specs. The `all` suite runs the full authenticated visual matrix and can optionally generate candidate baselines.

Configure the environment variables above as GitHub repository secrets. The workflow uploads reports, traces, videos, failure screenshots, state diagnostics, Blueprint documents, graph summaries, and optional baseline candidates. It never uploads `.auth/`.

## Blueprint authority boundary

The current Blueprint serializer is a read-only compatibility projection.

It may:

- read the current browser-local Studio prototype state
- produce a versioned Blueprint component document
- validate the document
- create a deterministic fingerprint
- project the document back into a Studio page shape
- compile the document into an Evara Graph fixture

It may not:

- call `saveBlueprintDraft`
- call `publishBlueprint`
- call `rollbackBlueprint`
- write canonical graph state
- bypass the Draft Journal
- treat browser state as a published release

The existing trusted Blueprint service currently accepts only the legacy navigation, sections, and component-ID projection. It must not receive the richer component-instance document until a reviewed server schema and migration are deployed.

## Account requirements

Every QA user must:

- exist in Firebase Authentication
- have a matching `users/{uid}` Firestore profile
- have an active account status
- use the canonical role being tested
- have data access appropriate for that role
- contain non-sensitive synthetic QA data only

Do not use personal accounts, customer credentials, or production-sensitive records for automated QA.

## Baseline policy

A baseline update requires review for:

- correct appearance mode
- consistent Liquid Glass hierarchy
- expected navigation for the role
- no clipped content
- no accidental horizontal scrolling
- readable text over image mode
- correct safe-area spacing
- visible focus states
- intentional responsive reflow
- absence of leaked data or unauthorized controls

## Troubleshooting

### Login succeeds but the route returns to login

Verify the Firestore profile exists and contains an active canonical role. The route guard does not trust local role storage alone.

### A role test is skipped

The corresponding email or password environment variable is missing.

### The focused Studio suite is skipped

The owner QA credentials are missing or the saved authenticated owner state could not be created by global setup.

### An action destination is unavailable

The route is not authorized for the current Studio preview role by `access-control.js`. Change the preview role or select an approved route; do not bypass the route policy.

### Blueprint validation reports a warning

Review route authorization, icon normalization, unreferenced instances, repeated instance references, and migration metadata. A warning is not a publishing approval.

### Blueprint compilation fails

Confirm the document uses schema `1.0.0`, every section reference resolves to an instance, every component definition exists in the Studio registry, and all generated graph edges reference existing nodes.

### Screenshots differ only in business values

Add a narrowly targeted selector to the dynamic mask list. Do not mask complete cards or page regions unless the whole region is intentionally nondeterministic.

### Image mode is different across runs

The harness uses the committed EvaraOS app icon as a deterministic wallpaper. Confirm the asset path still exists and is served by the same origin.
