# Evaraos Surgical Fix Audit — 2026-07-26

Branch: `audit/surgical-fixes-2026-07-26`

## Scope

This audit focuses on the three reported regressions:

1. Brand/app icon rendering.
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

Static verification required before merge:

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

Static verification required before merge:

- The page no longer directly imports `studio-visual-builder.js`.
- The gate imports the builder only after a verified owner/admin role or a valid cached owner/admin session.
- The builder module remains unchanged outside the startup gate.

### Next task

Run an authenticated browser test under throttled network conditions and verify owner, admin, customer, and signed-out behavior.

---

## Task 3 — Brand mark and install icon separation

### Root cause

The icon consolidation commit pointed both `BRAND_MARK_SRC` and `APP_ICON_SRC` to the same square 512 px installation icon and removed the transparent mark/logo assets. That made a launcher icon appear in loader, navigation, and brand-logo surfaces where a transparent mark is expected.

### Surgical patch

- Restore `public/assets/brand/evaraos-mark.png` as the transparent in-app mark.
- Restore `public/assets/brand/evaraos-app-icon.png` as the install/PWA icon alias.
- Restore `public/assets/img/evaraos_logo.png` for legacy sidebar/topbar consumers.
- Restore the immediately preceding `loader.js` and `app.js` versions, whose only changes in the consolidation commit were the two asset references.
- Keep the current `icon-512.png`, favicons, and manifest-facing installation icon intact.

### Verification

Static verification required before merge:

- Loader brand mark and app icon paths are different.
- Sidebar/topbar uses the restored transparent logo asset.
- Manifest/install icon remains the current square icon.

### Next task

Run visual QA on loader, login, dashboard, navigation drawer, Studio, and installed-PWA surfaces at 1x/2x scale.

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

1. Firestore Emulator rule tests and the smallest verified rules patch.
2. Browser smoke tests for customer and Studio flows.
3. Search for remaining square install-icon references used as in-app logos.
4. Validate App Check behavior and profile hydration failure states.
5. Add automated regression tests for blank-screen locks and Studio role hydration.
