# Evaraos Production Regression Audit — July 26, 2026

## Executive finding

The customer, navigation, editor-publishing, and branding regressions came from a split release line plus competing client authorities, not one isolated typo.

- Firebase Hosting was deployed from `fadec0085c0ab5a2186635edc882344849e18079` at 2026-07-26T06:59:02Z.
- That production commit is on a line 59 commits ahead of the shared merge base and outside the current default-branch history.
- The default branch later received a destructive icon-consolidation change, while customer and brand repairs remained in separate draft branches.
- Hosting and Firestore were not released as one tested application contract.
- This recovery work is intentionally based on the exact deployed production commit to avoid rolling back the live Studio line.

## Customer login and portal

### Root cause

Authentication itself can succeed. The failure occurs after sign-in:

1. The private route guard requires a fresh Firestore profile after Firebase Authentication.
2. A transient profile-read failure cleared the saved session and redirected the customer to login.
3. The production portal performed unrestricted collection reads and converted denied queries to empty arrays.
4. Firestore requires customer-owned query constraints.
5. The UI could therefore loop, stay blank, or falsely report no service history.

### Surgical recovery

- Publish a sanitized verified route-session profile from the route guard.
- Permit an exact-UID cached profile only as a routing fallback when Firebase Authentication is still valid; Firestore remains the data authority.
- Query `jobs`, `customer_services`, `subscriptions`, and `customer_service_history` by `customerUid`, `customerId`, and `userId` equality constraints.
- Remove unrestricted collection and whole-users reads.
- Track successful and failed queries separately.
- Never render “No service history” when every secure query failed.
- Always unlock the visual shell and render a retryable diagnostic state.
- Allow pending/non-rejected customer sessions to read only their own UID-owned records while preserving cross-customer denial.

## Universal navigation

### Root cause

The global drawer was intended to be role-based, but page boot order changed which client state won:

- `nav-utils.js` prioritized the globally stored Studio preview role.
- `nav-role-lockdown.js` removed real menu links using that preview role.
- Some pages loaded the route guard before navigation, so navigation missed the verified-session event and rendered from stale cache.
- Authentication was also inferred from page loading state on some paths.
- Nineteen legacy pages loaded `nav.js` twice under two different query-string URLs, causing duplicate entrypoint side effects and page-specific timing.

This made the menu appear page-dependent even though the app registry itself is role-based.

### Surgical recovery

- Add one navigation authority module that accepts the verified route session first and never reads Studio preview role.
- Build menu sections only from the verified actual role and the central app registry.
- Make page location affect only the active-link highlight.
- Reconcile navigation immediately at boot in case the verified session event already fired.
- Keep role preview presentation-only; it cannot add or remove real drawer links.
- Lock navigation clicks, drawer links, and bottom-navigation items to the actual signed-in role.
- Route legacy navigation utilities through the same verified authority.
- Add loader and earliest-appearance-boot recovery so every page mounting `#universalNavRoot` receives the canonical entrypoint.
- Normalize all 19 duplicate pages to one `/assets/js/nav.js?v=nav-v61-role-authority` script.
- Add separate runtime-contract and page-boot-inventory CI gates.

## Owner and administrator publishing

### Root cause

The editor treated the owner like a tenant administrator:

- Publishing required `profile.companyId` for every editor user.
- The runtime only loaded and saved `companies/{companyId}.appBuilder`.
- Therefore an owner without a company workspace received the incorrect message that publishing was blocked.

### Correct authority contract

- `platform_admin` and `owner` are platform owners with ultimate access to every registered page and feature.
- Platform owners publish global settings to `public_app_config/global`; no company workspace is required.
- `admin` remains tenant-scoped and must have a company workspace.
- An admin may update only `appBuilder` and `appBuilderUpdatedAt` on their own company document.
- An admin cannot publish globally, change company identity fields, or update another company.
- The app runtime loads owner global settings as the baseline and layers a company override on top when present.

## Canonical role engine

- `access-control.js` remains the single browser policy entrypoint.
- Unknown roles fail closed instead of becoming customers.
- Legacy `roles.js` and `app.js` delegate to the canonical policy.
- Owner/platform owner bypasses restrictions only for registered application pages and features; unknown routes still fail closed.
- Nested personal Settings paths remain distinct from operations pages with similar filenames.

## Logo and icon

### Canonical two-asset contract

- Visible OG PNG logo: `public/assets/img/evaraos_logo.png`
- E PNG app icon: `public/assets/brand/evaraos-app-icon.png`

`public/assets/brand/evaraos-mark.png` is retained only as a compatibility alias to the OG PNG logo. It is not a third design.

### Recovery

- Restore validated OG-logo and E-icon payloads.
- Restore correct E-icon variants for favicon, 192px, Apple touch, 512px, and ICO compatibility paths.
- Version canonical URLs with `brand-contract-2`.
- Use the OG PNG for loaders, login badges, sidebar, topbar, and visible branding.
- Use the E PNG for favicon, manifest, Apple touch, notifications, settings icon surfaces, and App Icon Studio.
- Remove embedded official-image authority, blob-manifest replacement, and mutation/timer overwrite loops.
- Clear only obsolete icon keys; do not delete unrelated App Builder or Studio state.

## Automated gates added

- JavaScript syntax checks for activated role, route, navigation, customer, builder, and publishing runtimes.
- A canonical role matrix including owner ultimate access and unknown-role fail-closed behavior.
- A deep navigation/customer/owner source audit.
- A universal page inventory that rejects duplicate or missing canonical navigation boot paths.
- Firestore Emulator tests proving:
  - owner without a company can publish globally;
  - admin cannot publish globally;
  - admin can update only app-builder fields on the assigned company;
  - admin cannot cross company boundaries;
  - pending customers can query their own portal records but cannot enumerate or cross accounts.

## Remaining release work

- PR #48 remains draft and is not merged or deployed.
- Authenticated browser smoke tests are still required for an approved customer, a pending customer, owner global publishing, admin company publishing, and cross-page navigation stability.
- Staff application approval still needs a separate verified transaction/rules patch for `staff_profiles/{uid}` writes.
- Vendor backend authority remains a separate role-alignment task.
- The divergent production line must be reconciled into the default branch after the emergency recovery, not replaced by the default branch.

## Release discipline going forward

1. Production hotfixes must start from the exact deployed commit.
2. Hosting and Firestore contracts must be tested together before either is released.
3. No source-verification commit may be deployed if its application source is outside the reviewed release branch.
4. Every release must record the exact deployed SHA and verify deployed asset hashes.
5. Navigation, role policy, and publishing scope must each have one source of truth.
