# Evaraos Surgical Fix Audit — 2026-07-26

Branch: `audit/surgical-fixes-2026-07-26`

## Scope

This audit focuses on the three reported regressions:

1. Brand logo and app icon rendering.
2. Evara Studio website builder startup.
3. Blank or empty customer portal after the Firestore update.

The patch is intentionally narrow. It does not broadly loosen Firestore security rules and does not replace unrelated application architecture.

---

## Task 1 — Customer portal blank/empty state

### Root cause

The customer portal downloaded entire collections (`jobs`, `customer_services`, `services`, `subscriptions`, and `users`) and filtered the results in the browser. Firestore evaluates whether a query can return only authorized documents before running it. A whole-collection query cannot prove that every result belongs to the signed-in customer, so customer reads can be denied even when individual documents are customer-owned.

The existing code swallowed those permission errors and returned an empty array. This made a permission failure look like the customer had no history. The page also remained visually locked when authentication/profile hydration did not call its completion callback.

### Surgical patch

- Added `public/assets/js/customer-portal-v3.js`.
- Replaced whole-collection downloads with customer-scoped equality queries across the supported legacy identity fields.
- Removed the customer-side attempt to download the entire `users` collection.
- Added explicit permission-blocked messaging instead of reporting false empty history.
- Added a seven-second blank-screen guard that reveals the portal with a diagnostic state.
- Wrapped portal initialization in `try/finally` so the visual shell is always released.
- Updated `public/customer_dashboard.html` to load v3.

### Verification

- Customer portal references `customer-portal-v3.js` only.
- v3 queries include a customer identity equality constraint.
- v3 always calls the visual unlock in `finally`.
- v3 does not call the generic whole-collection helper.

### Next task

Run Firestore Emulator tests for approved and pending customer profiles. Then patch the rules only if the emulator confirms that pending customers still cannot read documents that explicitly belong to their UID/email.

---

## Task 2 — Evara Studio authorization race

### Root cause

The visual builder had its own 450 ms fallback boot. It marked itself as booted before checking the hydrated Firestore role. On slower profile hydration, the cached role defaulted to `customer`, the builder rendered an access restriction, and the later verified-session event could not retry because the internal `booted` flag was already set.

### Surgical patch

- Added `public/assets/js/studio/studio-visual-builder-loader.js`.
- The loader hydrates the verified profile before importing the visual builder.
- Only owner/admin roles can load the builder module.
- Cached owner/admin sessions still load quickly.
- Updated `public/website-builder.html` to load the authorization gate instead of loading the builder directly.

### Verification

- The page no longer directly executes the visual builder before the authorization gate.
- The gate imports the builder only after a verified owner/admin role or a valid cached owner/admin session.
- The builder module remains unchanged outside the startup gate.

### Next task

Run an authenticated browser test under throttled network conditions and verify owner, admin, customer, and signed-out behavior.

---

## Task 3 — OG PNG logo and E PNG icon contract

### Confirmed asset roles

- **Visible brand logo:** `public/assets/img/evaraos_logo.png` — the OG PNG logo.
- **App/brand icon:** `public/assets/brand/evaraos-app-icon.png` — the E-shaped PNG used for favicons, installed-app metadata, notification icons, and icon surfaces.

These files are separate assets and must never be aliases for one another.

### Deep root cause

The problem was not one cache or one incorrect `<img>` tag. Multiple authorities were competing:

1. The production/default branch still contains the icon-consolidation commit; the corrective pull requests remain unmerged drafts, so production has not received the fixes.
2. The consolidation commit removed the separate logo/mark files and rewired many logo preloads and visible surfaces to `icon-512.png`.
3. App Icon Studio embedded an older PNG directly inside JavaScript instead of loading the repository PNG.
4. A second “final guard” script detected that embedded data URL, saved it under `evaraos-official-app-icon-v4`, and repeatedly forced it back into the page through startup repairs, timers, page lifecycle handlers, and a mutation observer.
5. The legacy icon-preference runtime could replace favicon and manifest links with a stored snapshot/data URL.
6. The manifest and push notification service worker still pointed to the consolidated legacy icon files.
7. Navigation can render after the loader applies branding, so the brand contract must be reapplied on `evara:nav-ready`.
8. Firebase Hosting already sends `no-cache, no-store`; the push service worker does not precache the application shell. HTTP cache and service-worker app-shell caching were therefore not the primary root causes.

### Surgical patch

- Added a versioned `brand-contract-2` runtime contract.
- `loader.js` now declares separate `BRAND_LOGO_SRC` and `BRAND_ICON_SRC` constants.
- Loader, sidebar, and `[data-evaraos-brand-logo]` surfaces use the OG PNG logo.
- `[data-evaraos-brand-icon]`, favicon, Apple touch icon, manifest, and notification surfaces use the E PNG icon.
- Added a one-time migration that removes obsolete icon snapshots, official-icon keys, user-icon keys, and stale `evaraos-app-builder-v1:*` cache records.
- Removed the embedded base64 icon authority from `app-icon-studio-single-source.js`.
- Replaced the final guard overwrite loop with a compatibility shim that delegates to the canonical icon runtime.
- Retired the legacy manifest-blob behavior in `app-icon-preferences.js`.
- Updated `public/settings/icons.html`, `public/index.html`, `public/manifest.json`, and `public/firebase-messaging-sw.js` to use the correct assets.
- Updated `nav.js` to reapply the brand contract immediately after navigation renders.

### Verification

- Both canonical files are checked as real PNG payloads by CI, including PNG signatures and nontrivial byte length.
- Homepage first paint uses the OG PNG logo.
- App Icon Studio and manifest use the E PNG icon.
- The icon runtime no longer contains an embedded `const ICON = data:image/...` authority.
- The final guard no longer discovers embedded images, starts timed repair loops, or creates a mutation observer.
- The legacy preferences runtime no longer creates a blob manifest.
- Manifest icons and shortcut icons must all resolve to the canonical E PNG path.
- The strengthened `tools/audit-icon-system.js` now fails CI if these contracts regress.

### Deployment state

These fixes are on draft PR #45. They are not live in production until the PR is reviewed, merged, and deployed through the protected Firebase release workflow. An already installed iOS PWA may still require removal and reinstallation after deployment because iOS snapshots installed-app icons independently from normal web cache behavior.

### Next task

Run browser visual QA for homepage first paint, login, dashboard navigation, App Icon Studio, favicon, notification icon, and a fresh PWA install. Then merge/deploy the exact validated commit.

---

## Firestore rule follow-up — intentionally not loosened in this patch

The rules currently combine the customer role with an approved/active account test. Registration creates pending customer profiles. Before changing production rules, add emulator coverage for:

- Customer reads own `users/{uid}` profile while pending.
- Customer reads own service/job records while pending and approved.
- Customer cannot read another customer's records.
- Customer cannot query an unrestricted collection.
- Operations/admin access remains unchanged.

The safe rule design should separate **identity ownership** from **account approval**. Own-profile access and explicitly customer-owned record reads can be evaluated by UID/email; privileged marketplace actions can continue to require approval.

---

## Remaining repository audit queue

1. Complete CI on the strengthened brand-contract audit.
2. Run visual browser/PWA verification against the PR head.
3. Run Firestore Emulator tests and apply only the smallest verified rules patch.
4. Run authenticated Studio role and slow-network smoke tests.
5. Add browser regression coverage for blank-screen locks and installed-icon update guidance.
