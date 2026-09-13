# Release status and essential work queue

Verified on 2026-09-13. This page replaces estimates with dated release evidence; historical audit documents remain historical.

## Live release

- Website: [evaraos.web.app](https://evaraos.web.app/).
- **LIVE PRODUCTION HOSTING:** `73cfc3cce1d43450e1da89fb9d330ca06597e018`
- **Current canonical source:** `bb188600b8673f859f1b6db61cb48208e48f6aa5`
- [Production workflow 34580232792](https://github.com/Evaraos/evaraos/actions/runs/34580232792): validation and Hosting deployment succeeded for the live Hosting release.
- [Machine-readable release proof](deployments/firebase-production-release.json) is the authority for the exact deployed revision and components. It records Hosting `true`, Functions `false`, Firestore `false`, and Storage `false`; billing, Functions, Firestore rules/indexes, and Storage were unchanged.
- The live Hosting release includes [PR #80](https://github.com/Evaraos/evaraos/pull/80), “Stop Leads drawer flicker during navigation refreshes.” Canonical source contains subsequent work, including [PR #81](https://github.com/Evaraos/evaraos/pull/81), but that work is not established as part of the current Hosting deployment. Do not imply that all canonical source is deployed.

Preserve the previous Hosting release for rollback; use the exact retained version shown in Firebase Hosting release history.

## Authenticated production QA

Approved-owner production QA on the deployed Hosting release completed successfully.

### Authority

- Firebase Auth: PASS
- App Check: PASS
- lifecycle active + approved: PASS
- canonical owner role: PASS
- EvaraRouteSession: PASS

### Home

- authenticated load: PASS
- hard reload/session persistence: PASS
- owner drawer: PASS
- drawer close/backdrop: PASS
- bottom navigation: PASS
- scroll contract/expand behavior: PASS
- repeated drawer/scroll stability: PASS
- duplicate nav not observed
- authority/session errors not observed

### Leads

- owner access: PASS
- authenticated continuity: PASS
- drawer stability: PASS
- no close/reopen flicker observed
- reload: PASS
- scroll behavior: PASS
- no route-guard loop observed
- no normal-load Firestore permission error observed

### Dashboard

- private route guard: PASS
- owner/active/approved authority: PASS
- EvaraRouteSession: PASS
- reload: PASS
- drawer/navigation/scroll behavior: PASS
- no Auth/App Check/lifecycle/route errors observed

### Cross-route

- Home → Leads → Dashboard → Home: PASS
- Home → Dashboard → Leads → Home: PASS
- no session loss
- no guest-shell replacement
- no duplicate navigation symptoms
- no redirect loop

### Logout / signed-out authority

- normal logout: PASS
- Firebase Auth termination: PASS
- private controls removed: PASS
- redirect to signed-out/login state: PASS
- signed-out Dashboard denied/redirected: PASS
- signed-out Leads denied/redirected: PASS
- no private content flash observed
- public Home recovery: PASS

### QA limitations

- Notification control presence was verified, but notification interaction was not invoked because it could mutate read state.
- Destructive/business-mutating Leads/Dashboard actions were not exercised.
- Payments, outbound messaging, staff approval, publishing, uploads, automation, and AI server actions were not exercised.
- Complete semantic/security review of every repository file is still not established.
- Functions/Storage-dependent capabilities remain deferred on Spark.

### Non-blocking UX observations

- Authenticated Home still exposes some guest-oriented marketing/account CTAs such as Login/Sign Up/Create Account/Enter Platform.
- Some Dashboard capability cards use READY/live-oriented language while waiting for unavailable/deferred backend data.

These are non-blocking cleanup candidates, not security failures.

## Spark operating plan

The user chose to remain on Spark until an upgrade is affordable. Billing activation and paid backend deployment are deferred, not prerequisites for the next UI iteration.

| Available path | Current approach |
| --- | --- |
| Website and branding | Publish static HTML, CSS, JavaScript, images, and approved configuration through GitHub and Firebase Hosting. |
| Account access | Prioritize existing email/password Authentication and verified profile/lifecycle checks. Do not depend on phone sign-in or an undeployed username resolver. |
| Leads and other records | Use existing authorized Firestore operations within Spark quotas. Verify each route and keep queries bounded; a page can still depend on unavailable Functions even when Firestore itself is available. |
| Public Experience configuration | Serve `/__experience/config` from `public/assets/config/experience.json`. Version zero plus an empty config uses the canonical runtime defaults. Changes go through reviewed releases. |
| Online Experience editing | Explicitly unavailable in Hosting mode, with no calls to absent publishing/upload services. The backend and its authorization checks remain intact for later use. |
| Studio synchronization, automation, payments, AI server actions | Deferred wherever they require Cloud Functions or other paid backend services. Local drafts must never be reported as synchronized or published. |
| Uploaded photos and attachments | Cloud Storage is unavailable on Spark under current Firebase requirements. Bundled public artwork remains in Hosting. Do not weaken Storage rules or store private uploads as public repository assets. |

Official references: [Firebase plan comparison](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing), and [Cloud Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## Essential work, in order

1. Improve the verified Spark-compatible workflows and reduce unnecessary Firestore reads/listeners while preserving account, tenant, and lifecycle authority.
2. Reconcile the preserved Studio/theme work and historical PRs #44/#48 in coherent, reviewed feature groups against current `evaraos`; never merge them wholesale.
3. Consolidate repository organization using [reference-checked, independently reviewable moves](REPOSITORY_ORGANIZATION.md).
4. Preserve the authenticated-Home CTA and Dashboard capability-state UX findings as non-blocking cleanup candidates.
5. Keep Blaze-only backend deployment, Storage-dependent uploads, trusted Studio/Experience Functions, automation, payments, and AI server actions explicitly deferred until Blaze is intentionally resumed.

The last metadata check found billing disabled and none of the required trusted Studio/Experience functions in the 19-function production inventory. This explains the deferred backend work; it is not a reason to stop improving the website.

## Branch disposition

- PR #68 is closed as superseded by PR #76; its branch and commit history are preserved.
- PRs #74, #75 and #76 are merged. Their source is included in the release above.
- The imported Downloads tree and original dirty canonical checkout are preserved. Their filenames and folder locations do not establish release authority.
- Historical `agent/`, `fix/`, `hotfix/`, `production/`, `recovery/`, `release/`, and `studio/` branches need content comparison against current `evaraos`. An ahead count is not evidence that all commits should be merged.

Update this page when a release or queue item changes, linking the new exact-commit evidence. Do not report all prior months of work as released while backend prerequisites, authenticated QA, and preserved branch reviews remain outstanding.
