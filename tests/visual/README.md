# EvaraOS Studio and Visual QA

This workspace validates EvaraOS architecture, authenticated routes, responsive layouts, accessibility smoke checks, Studio interactions, Blueprint serialization, semantic operations, Canvas recovery, writer leases, and screenshot regressions.

It does **not** bypass Firebase Authentication, Firestore profile verification, route permissions, or role policies. Authenticated browser sessions are created through the production login form using dedicated synthetic QA users.

## QA suites

### `static`

Runs the zero-dependency architecture audits only. It requires no deployed environment, Firebase account, or repository secrets.

Use it to verify:

- Design System ownership
- Studio component and inspector boundaries
- Action and icon contracts
- Blueprint serialization
- Blueprint operation envelopes
- CanvasSession architecture
- writer lease enforcement
- transaction-chain integrity
- recovery codes
- unsynchronized-change diagnostics
- workflow and route contracts

### `studio`

Runs the static audits first, then five authenticated owner tests in desktop Chromium.

Required secrets:

```text
EVARA_QA_BASE_URL
EVARA_QA_OWNER_EMAIL
EVARA_QA_OWNER_PASSWORD
```

### `all`

Runs the static audits and the complete authenticated role, appearance, route, and device matrix. Optional non-owner credentials increase coverage; `EVARA_QA_REQUIRE_ALL_ROLES=1` requires every canonical role.

## Canonical roles

- platform administrator
- owner
- administrator
- manager
- sales
- technician
- cleaner
- customer
- vendor

Owner credentials are required for authenticated Studio runs. Other role credentials are optional for critical runs and required for a full role matrix.

## Appearance coverage

- light
- dark
- system
- image

## Device projects

- desktop Chromium — 1440 × 1100
- tablet Chromium — 1024 × 1366
- iPhone WebKit
- Android Chromium

## Route diagnostics

Each covered route checks:

- successful HTTP response
- authorization without an unexpected login redirect
- completed application-ready state
- expected appearance mode
- horizontal overflow
- keyboard focus reachability
- uncaught page errors
- console errors
- duplicate element IDs
- visible controls without accessible names

Dynamic maps, live counters, timestamps, and realtime values are narrowly masked so screenshots measure layout and visual treatment rather than volatile business data.

## Focused Studio tests

### `studio-interactions.spec.mjs`

Checks:

- categorized component search
- component creation
- required-field validation
- property commits
- compatibility undo and redo
- Layers coordination
- Auto Layout stack creation
- compatibility checkpoint creation
- panel exclusivity
- serialized local Studio state and screenshots

### `studio-action-icon.spec.mjs`

Checks:

- action label, intent, and destination separation
- permission-filtered route destinations
- role-change authorization invalidation
- canonical icon search and selection
- SVG icon rendering
- persisted action and icon IDs

### `studio-blueprint-serialization.spec.mjs`

Checks:

- Blueprint component-document schema `1.0.0`
- page-scoped identity
- deterministic fingerprints
- component definition references
- properties, icons, actions, layout, responsive values, and role visibility
- round-trip Studio projection
- Evara Graph compilation
- component-instance and relationship contracts

### `studio-blueprint-operations.spec.mjs`

Checks:

- semantic component insertion
- reversible low-level Evara operations
- `transaction.commit` envelopes
- inverse operations
- per-page graph revisions
- IndexedDB durability
- idempotent transaction IDs
- property and Auto Layout commands
- compatibility-projection duplicate suppression

### `studio-canvas-session.spec.mjs`

Checks:

- journaled component insertion
- compensating undo and redo
- reload recovery through operation replay
- graph-scoped writer leases
- read-only secondary tabs
- deterministic writer takeover
- pending local transaction indicators
- unsynchronized-change state
- transaction-chain integrity
- corrupted transaction failure
- graph-head mismatch failure
- fail-closed recovery-required behavior

All focused tests clear only the two browser-local Studio compatibility draft keys. They do not clear authentication, appearance, or unrelated browser data, and they do not write production business records.

## Local authenticated setup

```bash
export EVARA_QA_BASE_URL="https://your-deployed-evaraos-origin.example"
export EVARA_QA_OWNER_EMAIL="qa-owner@example.com"
export EVARA_QA_OWNER_PASSWORD="use-a-secret-manager"

cd tests/visual
npm install --no-audit --no-fund
npx playwright install chromium webkit
```

Never commit credentials or browser storage-state files.

## Focused Studio command

```bash
npx playwright test \
  specs/studio-interactions.spec.mjs \
  specs/studio-action-icon.spec.mjs \
  specs/studio-blueprint-serialization.spec.mjs \
  specs/studio-blueprint-operations.spec.mjs \
  specs/studio-canvas-session.spec.mjs \
  --project=desktop-chromium
```

## Critical matrix

```bash
EVARA_QA_MATRIX=critical npx playwright test
```

The critical matrix runs route diagnostics in desktop Chromium and visual baselines in desktop Chromium plus iPhone WebKit.

## Full matrix

```bash
EVARA_QA_MATRIX=full EVARA_QA_REQUIRE_ALL_ROLES=1 npx playwright test
```

## Candidate baselines

```bash
EVARA_QA_MATRIX=critical npx playwright test --update-snapshots
```

Review every generated image before committing it. A changed baseline is not proof that the change is correct.

## Generated files

```text
playwright-report/
test-results/
.auth/
specs/__screenshots__/
```

Only reviewed screenshot baselines under `specs/__screenshots__/` may be committed. Authentication state, traces, videos, reports, and local results remain ignored.

## GitHub Actions

Workflow:

```text
.github/workflows/design-system-visual-qa.yml
```

### Credential-free static run

1. Open the repository **Actions** tab.
2. Select **Design System Visual QA**.
3. Choose **Run workflow**.
4. Select branch `evaraos`.
5. Keep suite set to `static`.
6. Run the workflow.

The static job executes seven architecture checks and skips the authenticated job.

### Authenticated Studio run

After the three required secrets are configured, repeat the steps above and choose suite `studio`.

The workflow uploads Playwright reports, traces, videos, screenshots, state diagnostics, Blueprint documents, graph summaries, operation envelopes, writer-lease evidence, and recovery evidence. It never uploads `.auth/`.

## Blueprint authority boundaries

The compatibility serializer may read local Studio prototype state, produce a validated component document, create deterministic fingerprints, project a document back into a Studio page, and compile a graph fixture.

It may not publish, roll back, write canonical graph state, call trusted Blueprint APIs, bypass the Journal, or treat browser state as a release.

The Blueprint operation adapter may infer semantic edits, compile graph deltas, verify parity, append reversible local operation envelopes, and suppress duplicate compatibility snapshots.

It may not open another database, create another history store, write directly to localStorage, call Firebase, publish a Blueprint, bypass revision checks, or represent local durability as server confirmation.

## Canvas authority boundaries

CanvasSession must:

- use the canonical Studio Journal
- validate the full transaction revision and sequence chain
- verify commit envelopes
- replay operations before accepting recovery
- compare replay state with the graph head
- fail closed on corruption or mismatch
- obtain the graph writer lease before appending
- promote candidate graph state only after durability succeeds
- expose pending local changes as unsynchronized

CanvasSession may not:

- open another IndexedDB database
- write localStorage
- own network transport
- silently overwrite a stale graph head
- allow a secondary tab to write
- claim server confirmation without the trusted Backend adapter

## Account requirements

Every QA user must:

- exist in Firebase Authentication
- have a matching `users/{uid}` Firestore profile
- have active account status
- use the canonical role being tested
- have access appropriate for that role
- contain synthetic, non-sensitive data only

Do not use personal, customer, vendor, or production-sensitive accounts.

## Troubleshooting

### Static workflow does not appear

Confirm GitHub Actions is enabled under repository **Settings → Actions → General** and that workflows from this repository are allowed.

### Static workflow fails

Open the failed job and review the first failed architecture audit. Do not bypass an audit to make the workflow green; fix the violated ownership or version contract.

### Studio workflow fails before Playwright

Confirm these repository secrets exist and are not blank:

```text
EVARA_QA_BASE_URL
EVARA_QA_OWNER_EMAIL
EVARA_QA_OWNER_PASSWORD
```

### Login returns to the login page

Verify the QA owner exists in Firebase Authentication and has a matching active Firestore profile with the canonical owner role.

### Canvas reports local changes waiting for trusted sync

This is expected until the trusted Backend Journal adapter confirms the transactions. Local durability is not publication.

### Canvas reports recovery required

Do not overwrite the Journal. Review the attached recovery event and determine whether the failure is a corrupted transaction, revision-chain mismatch, sequence mismatch, replay failure, or graph-head mismatch.

### A secondary tab is read-only

Close or release the writer tab. The remaining tab must verify its graph head before becoming writable. A stale tab must reload.

### Screenshots differ only in business values

Add a narrowly targeted selector to the dynamic mask list. Do not mask entire cards or page regions unless the whole region is intentionally nondeterministic.
