# EvaraOS Authenticated Visual QA

This workspace runs authenticated route, layout, accessibility-smoke, and screenshot-regression checks against a deployed EvaraOS environment.

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

### Diagnostics

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

Visual cases also compare deterministic viewport screenshots. Dynamic maps, live counters, timestamps, and realtime status values are masked so the baseline measures layout and visual treatment rather than volatile business data.

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

Automatic pushes and pull requests run only the zero-dependency design-system architecture audit.

Authenticated visual QA is manual because it requires:

- a deployed QA origin
- dedicated Firebase test users
- repository secrets
- explicit selection of critical or full coverage

Configure the environment variables above as GitHub repository secrets. The workflow uploads reports, traces, videos, failure screenshots, and optional baseline candidates. It never uploads `.auth/`.

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

### Screenshots differ only in business values

Add a narrowly targeted selector to the dynamic mask list. Do not mask complete cards or page regions unless the whole region is intentionally nondeterministic.

### Image mode is different across runs

The harness uses the committed EvaraOS app icon as a deterministic wallpaper. Confirm the asset path still exists and is served by the same origin.
