# Evaraos Production Regression Audit — July 26, 2026

## Executive finding

The customer and branding regressions came from a split release line, not one isolated typo.

- Firebase Hosting was deployed from `fadec0085c0ab5a2186635edc882344849e18079` at 2026-07-26T06:59:02Z.
- That production commit is on a line 59 commits ahead of the shared merge base and outside the current default-branch history.
- The default branch later received a destructive icon-consolidation change, while customer and brand repairs remained in separate draft branches.
- Firestore was not deployed with the hosting release, so the live browser bundle and live rules were not released as one tested contract.

## Customer login and portal

### Root cause

Authentication itself can succeed. The failure occurs after sign-in:

1. Login redirects a customer to `customer_dashboard.html`.
2. The private route guard immediately requires a fresh Firestore profile.
3. The production portal then performs unrestricted reads of jobs, services, subscriptions, and users.
4. Firestore rules require customer-owned scoped queries and treated customers like approval-gated staff.
5. The portal swallows denied queries as empty arrays, and one profile-hydration failure path never releases the loading shell.

This presents as a login loop, blank page, or false empty service history.

### Recovery patch

- Publish a verified route-session object from the route guard.
- Start the customer portal only from that verified session.
- Query `jobs`, `customer_services`, and `subscriptions` with equality constraints on `customerUid`, `customerId`, and `userId`.
- Remove the whole-users-collection download.
- Add a visible 12-second timeout/failure state and retry control.
- Permit pending/non-rejected customer profiles to read only records carrying their own UID and public service-catalog entries.
- Keep unrestricted collection reads, cross-customer records, private catalog records, and suspended/rejected accounts denied.

## Canonical role engine

### Root cause

Three independent browser policies existed:

- `public/assets/js/access-control.js`
- `public/assets/js/roles.js`
- a third handwritten `ROLE_PERMISSIONS` map inside `public/assets/js/app.js`

They disagreed about aliases, nested Settings paths, legacy pages, vendors, and unknown roles. Most critically, an unknown role was normalized to `customer`, which is not fail-closed.

### Recovery patch

- Make `access-control.js` the canonical browser policy.
- Normalize known legacy aliases into nine canonical roles.
- Return no role for unknown values and send unsupported stored roles back to login.
- Preserve path-specific Settings policies so `/settings/notifications.html` does not collide with the operations-only `/notifications.html`.
- Route `roles.js` and `app.js` through the canonical policy instead of maintaining competing matrices.
- Recognize the stored `platform_admin` role in Firestore authority.
- Add an executable role matrix and focused Firestore customer-ownership emulator tests.

### Current role readiness

- Customer: recovery implementation complete; awaiting exact-head CI, emulator, merge, and coordinated Hosting + Firestore deployment.
- Platform owner/admin: browser normalization repaired; authenticated runtime verification still required.
- Manager and field roles: existing tenant boundaries retained; full page/data matrix remains a follow-up audit.
- Vendor: present in browser policy, but backend authority is not yet fully aligned. Treat vendor workflows as incomplete until scoped emulator coverage is added.
- Staff application approval: app-side onboarding writes exist, but current rules still deny `staff_profiles` writes and reviewer profile promotion outside platform authority.

## Logo and icon

### Canonical two-asset contract

- Visible OG PNG logo: `public/assets/img/evaraos_logo.png`
- E PNG app icon: `public/assets/brand/evaraos-app-icon.png`

`public/assets/brand/evaraos-mark.png` is retained only as a compatibility alias to the OG PNG logo. It is not a third design.

### Root cause

- The app icon and visible logo were routed through competing paths.
- App Icon Studio embedded an old official image directly in JavaScript.
- A guard promoted that embedded image to localStorage and repeatedly restored it.
- The browser manifest could be replaced by a blob URL.
- Several legacy-sized favicon files still carried earlier artwork.

### Recovery patch

- Restore validated OG-logo and E-icon payloads.
- Restore correct E-icon variants for favicon, 192px, Apple touch, 512px, and ICO compatibility paths.
- Version all canonical URLs with `brand-contract-2`.
- Make loader, first paint, login badges, sidebar, and topbar use the OG PNG.
- Make favicon, manifest, Apple touch, notifications, and App Icon Studio use the E PNG.
- Remove embedded official-image authority and mutation/timer overwrite loops.
- Clear only obsolete icon keys; do not delete unrelated App Builder state.

## Additional 24-hour risk discovered

The staff application work added app-side approval/onboarding behavior that updates `users/{uid}` and writes `staff_profiles/{uid}`, but the current Firestore rules do not authorize that complete reviewer transaction. Expanded role support and onboarding rules were not released as a verified pair. This is intentionally not bundled into the customer-access emergency patch; it is the next backend recovery task after customer access is stable.

## Release discipline going forward

1. Production hotfixes must start from the exact deployed commit.
2. Hosting and Firestore contracts must be tested together before either is released.
3. No source-verification commit may be deployed if its application source is outside the reviewed release branch.
4. Every release must record the exact deployed SHA and verify deployed asset hashes.
5. The divergent production line must be reconciled into the default branch after the emergency hotfix, not replaced by the default branch.
