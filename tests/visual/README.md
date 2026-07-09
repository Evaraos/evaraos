# EvaraOS Studio and Visual QA

This workspace validates EvaraOS architecture, authenticated routes, responsive layouts, accessibility smoke checks, Studio interactions, Blueprint serialization, semantic operations, Canvas recovery, writer leases, trusted Journal synchronization, Backend domain rules, and screenshot regressions.

It does **not** bypass Firebase Authentication, Firestore profile verification, App Check, route permissions, or role policies. Authenticated browser sessions are created through the production login form using dedicated synthetic QA users.

## QA suites

### `static`

Runs architecture audits and the trusted Studio Journal Backend unit suite. It requires no deployed QA origin or QA account secrets.

Coverage:

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
- Journal Authority v2
- graph-scoped trusted server branches
- trusted callable contracts
- Backend idempotency, conflict, checkpoint, and release rules
- workflow and route contracts

### `studio`

Runs the static gate first, then five authenticated owner tests in desktop Chromium.

Required GitHub secrets:

```text
EVARA_QA_BASE_URL
EVARA_QA_OWNER_EMAIL
EVARA_QA_OWNER_PASSWORD
```

### `all`

Runs the static gate and the complete authenticated role, appearance, route, and device matrix. Optional non-owner credentials increase coverage; `EVARA_QA_REQUIRE_ALL_ROLES=1` requires every canonical role.

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

Checks component search and creation, required-field validation, property commits, compatibility undo/redo, Layers, Auto Layout, compatibility checkpoints, panel coordination, serialized state, and screenshots.

### `studio-action-icon.spec.mjs`

Checks action label/intent/destination separation, permission-filtered routes, role-change invalidation, canonical icon selection, SVG rendering, and persisted action/icon IDs.

### `studio-blueprint-serialization.spec.mjs`

Checks Blueprint component-document schema `1.0.0`, identity, deterministic fingerprints, component references, properties, icons, actions, layout, responsive values, role visibility, round-trip projection, and Evara Graph compilation.

### `studio-blueprint-operations.spec.mjs`

Checks semantic insertion, reversible Evara operations, commit envelopes, inverse operations, per-page graph revisions, IndexedDB durability, idempotent transaction IDs, property/Auto Layout commands, and compatibility duplicate suppression.

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

## Trusted Journal Backend tests

The static gate installs `functions/` dependencies under Node 20 and runs:

```bash
npm --prefix functions run test:studio-journal
```

The suite validates:

- identical transaction replay is idempotent
- transaction-ID reuse with different content is rejected
- simultaneous writes cannot silently overwrite the same branch revision
- canonical operation sequence assignment
- checkpoint graph identity and revision
- immutable release blocking while transactions are unsynchronized

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

The static job runs eight architecture audits plus the trusted Studio Journal Backend tests. The authenticated job is skipped.

### Authenticated Studio run

After the three required secrets are configured, repeat the steps above and choose suite `studio`.

The workflow uploads Playwright reports, traces, videos, screenshots, state diagnostics, Blueprint documents, graph summaries, operation envelopes, writer-lease evidence, and recovery evidence. It never uploads `.auth/`.

## Deploy trusted Firebase Functions

The repository targets Firebase project `evaraos-web`, uses `functions/` as the Functions source, and runs the callable service on Node 20.

From the repository root:

```bash
git checkout evaraos
git pull origin evaraos
npm --prefix functions install --no-audit --no-fund
npm --prefix functions run test:studio-journal
npx firebase-tools@latest login
npx firebase-tools@latest use evaraos-web
npx firebase-tools@latest deploy --only functions --project evaraos-web
```

Confirm these callable Functions are deployed in `us-central1`:

- `openStudioBranch`
- `commitStudioTransaction`
- `getStudioOperationRange`
- `createStudioCheckpoint`
- `restoreStudioCheckpoint`
- `createStudioBranch`
- `closeStudioSession`
- `prepareStudioRelease`

## Blueprint authority boundaries

The compatibility serializer may read local Studio prototype state, produce a validated component document, create deterministic fingerprints, project a document back into a Studio page, and compile a graph fixture.

It may not publish, roll back, write canonical graph state, call trusted Blueprint APIs, bypass the Journal, or treat browser state as a release.

The Blueprint operation adapter may infer semantic edits, compile graph deltas, verify parity, append reversible local operation envelopes, and suppress duplicate compatibility snapshots.

It may not open another database, create another history store, write directly to localStorage, publish a Blueprint, bypass revision checks, or represent local durability as server confirmation.

## Canvas and Journal authority boundaries

CanvasSession must:

- use the canonical Studio Journal
- validate the transaction revision and operation-width sequence chain
- verify commit envelopes
- replay accepted operations before recovery
- compare replay state with the graph head
- fail closed on corruption or mismatch
- obtain the graph writer lease before appending
- promote candidate graph state only after local durability succeeds
- expose pending changes as unsynchronized

The trusted Journal client must:

- use Firebase callable contracts only
- update transaction durability through Journal Authority v2
- assign a deterministic server branch to every graph
- preserve one local logical branch while preventing cross-page graph collisions
- stop on conflicts and recovery-required records
- create checkpoints only after synchronization
- block releases while pending transactions remain

Canvas and the trusted client may not:

- create a second Journal database
- write trusted Firestore or Storage paths directly
- silently overwrite a stale server head
- allow a secondary browser tab to write
- claim server confirmation before the callable service accepts the transaction

## Account requirements

Every QA user must:

- exist in Firebase Authentication
- have a matching `users/{uid}` Firestore profile
- have active account status
- use the canonical role being tested
- have a valid company ID
- contain synthetic, non-sensitive data only

Do not use personal, customer, vendor, or production-sensitive accounts.

## App Check

Trusted Studio callables enforce App Check. The web client initializes App Check with ReCAPTCHA Enterprise and automatic token refresh.

The QA and production domains must be accepted by the Firebase App Check configuration. Local testing requires an approved App Check debug token; authentication must not be bypassed.

## Troubleshooting

### Static workflow does not appear

Confirm GitHub Actions is enabled under **Settings → Actions → General** and workflows from this repository are allowed.

### Static workflow fails

Open the first failed audit or Backend test. Do not bypass the gate; fix the violated architecture, version, or domain contract.

### Functions deploy fails

Confirm the Firebase CLI is authenticated with an account that can deploy to `evaraos-web`, billing supports the required Functions/Storage services, and Node 20 is available.

### Studio workflow fails before Playwright

Confirm these GitHub secrets exist and are not blank:

```text
EVARA_QA_BASE_URL
EVARA_QA_OWNER_EMAIL
EVARA_QA_OWNER_PASSWORD
```

### Login returns to login

Verify the QA owner exists in Firebase Authentication and has a matching active Firestore profile with the canonical owner role and company ID.

### Canvas reports local changes waiting for trusted sync

Confirm the trusted callable Functions are deployed, the user is authenticated, App Check accepts the origin, and the user profile is active. Local durability is not publication.

### Canvas reports conflict

Do not overwrite the branch. Use trusted recovery, reject the pending local transaction, or create a new graph-scoped branch after reviewing the branch heads.

### Canvas reports recovery required

Do not overwrite the Journal. Review whether the failure is transaction corruption, revision mismatch, sequence mismatch, replay failure, graph-head mismatch, or server rejection.

### A secondary tab is read-only

Close or release the writer tab. The remaining tab must verify its graph head before becoming writable. A stale tab must reload.

### Screenshots differ only in business values

Add a narrowly targeted selector to the dynamic mask list. Do not mask entire cards or page regions unless the whole region is intentionally nondeterministic.
