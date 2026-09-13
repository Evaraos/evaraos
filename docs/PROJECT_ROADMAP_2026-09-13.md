# EvaraOS project roadmap and status — 2026-09-13

This document converts project history that had been spread across chat prompts, historical audits, pull requests, branches, and release notes into one reviewable GitHub checkpoint. It is evidence-backed but not a claim that every repository file has received a complete semantic/security review.

## Executive snapshot

Canonical repository: `Evaraos/evaraos`
Permanent integration branch: `evaraos`
Current audited integration head: `bb188600b8673f859f1b6db61cb48208e48f6aa5`
Latest verified Hosting release source documented in the repository: `7c7c0c1579d78d3c03d5817e6a61ad706322a64e`
Current integration branch is 10 commits ahead of that documented Hosting release.

Overall project confidence (evidence-weighted, not feature-completion percentage):

- Repository/source organization: 85%
- Shared navigation / shell foundation: 85%
- Access/lifecycle authority: 80%
- Staff application source hardening: 85%
- Staff onboarding production availability: 45%
- Firebase Hosting/Spark operation: 85%
- Trusted Functions-backed features on current Spark plan: 25%
- Studio/theme preserved work reconciliation: 35%
- Production authenticated end-to-end QA: 45%
- Historical branch reconciliation: 40%
- Project documentation / durable roadmap: 70% after this checkpoint

## What is verified as completed

### Repository and release discipline

- `evaraos` is the canonical integration branch.
- The repository has documented homes for hosted pages, navigation, auth/access modules, backend Functions, security rules, tests, tools and architecture evidence.
- GitHub pull requests and exact-commit release evidence are used to separate source integration from Firebase deployment.
- Repository organization and branch-reconciliation procedures are documented.

### Navigation, shell and access foundation

Merged work includes:

- shared navigation contracts and Notification Center secondary controls;
- Dashboard secondary navigation migration;
- bottom-navigation drawer motion;
- shell-motion opt-in across standard dashboards and Marketplace dashboards;
- Customer Messaging shell motion;
- canonical access-role normalization including `platform_admin`;
- Home public/authenticated shell reconciliation;
- Leads drawer refresh/flicker stabilization.

The repository states that cached UI state is not authority; verified Firebase user/profile/lifecycle/route policy remains the authority boundary.

### Spark-compatible Hosting

The project intentionally remains on Firebase Spark for now. The verified release path supports static Hosting and approved Firestore/Auth behavior while deferring paid Functions/Storage-dependent capabilities.

The Experience runtime was adapted so `/__experience/config` can be delivered from Hosting without the absent Cloud Function. Online Experience editing is intentionally unavailable in Hosting mode rather than pretending backend publishing exists.

### Staff application and onboarding source reconciliation

Merged PR #81 hardened the staff flow substantially:

- initial public intake no longer depends on Storage uploads;
- attachments begin empty and document verification is explicitly deferred;
- privileged/reviewer/assignment fields cannot be forged during applicant creation;
- applicant self-updates are restricted;
- `platform_admin` is recognized as the canonical platform administrator while `super_admin` remains a legacy alias;
- `reviewStaffApplication` retains trusted backend approval/profile creation;
- `updateStaffOnboardingTask` moves checklist changes to a trusted callable rather than direct browser profile writes;
- onboarding task mutation is limited to the signed-in user's own approved staff profile and fixed task keys;
- checklist completion is explicitly not employment/compliance/payment authority;
- attachment rendering is limited to absolute HTTPS URLs.

Validation recorded for the final reconciliation: 54 Functions tests, 22 Firestore/Storage emulator tests, six source audits, syntax checks and whitespace checks. PR-head GitHub Actions also completed successfully across Runtime Shell Validation, Experience Production Preflight, Trusted Studio Journal Backend, Icon System, Design System Visual QA, Marketplace Production Validation, Trusted Studio Release Runtime and Backend Security Validation.

## Important history correction

An older theme/application audit described direct browser creation/update of `staff_profiles/{uid}` and proposed manually loosening Firestore rules. That is no longer the desired architecture. PR #81 replaced that direction with trusted backend onboarding mutations and preserved direct `staff_profiles` write denial. Do not reapply the older manual `safeStaffProfileWrite` patch without a fresh design/security review.

## Current production/release gap

The canonical integration branch is ahead of the last documented Hosting release by 10 commits. Those commits include the staff onboarding/backend reconciliation and related security/test changes. Therefore:

- source merged to `evaraos` is not automatically proof of production deployment;
- PR #81 explicitly states no production Firebase resources were changed by that source reconciliation;
- the intended onboarding callable remains unavailable in production until Functions deployment prerequisites are met;
- production Firestore/Storage rules may not yet match the current source rules;
- Hosting frontend changes that depend on the callable should remain behind backend readiness.

This is the most important distinction to preserve: **merged source != deployed production capability**.

## Remaining high-priority risks

### P0 — release truth and environment reconciliation

1. Refresh `docs/RELEASE_STATUS.md` to the current integration head and explicitly record PR #81 as merged-but-not-necessarily-deployed.
2. Verify the actual Firebase production inventory before any new deployment: Hosting revision, Functions list, Firestore rules, Storage rules, indexes, billing state, IAM and App Check readiness.
3. Keep the production rollout separated by component; do not deploy paid/backend resources implicitly.

### P0 — authenticated production QA

The repository itself still calls out missing approved signed-in end-to-end verification for Home/Leads/Dashboard continuity and related workflows. Required matrix:

- login/session bootstrap;
- reload/session continuity;
- drawer open/close and navigation refresh;
- scroll direction behavior;
- notifications;
- logout;
- account lifecycle denial states;
- tenant isolation and role-specific route visibility.

### P0/P1 — staff production readiness

Before enabling the reconciled onboarding UI as a real production capability:

- confirm billing/Functions deployment availability or intentionally keep the callable unavailable;
- verify callable HTTP/App Check integration in the real Firebase environment;
- verify existing staff profile identity/company consistency;
- decide how legacy inconsistent profiles will be handled (the current source fails closed rather than auto-repairing);
- design authenticated registration resume/recovery for partial Auth/Firestore failures;
- separately design future private document collection rather than restoring uploads as an initial-registration prerequisite;
- review and deploy source Firestore/Storage rules only through a controlled release;
- address the three pre-existing messages composite indexes when appropriate.

### P1 — Studio/theme preserved branch

`review/preserve-local-studio-theme-20260910` is preserved and diverged from current `evaraos`: 7 commits ahead and 22 commits behind at the 2026-09-13 audit. It contains broad changes across navigation, theme, Studio live preview/draft tooling, Appearance settings and many page cache/version references.

Do not merge the branch wholesale. Reconcile it as coherent slices against current `evaraos`, because current navigation/access/staff work landed after its merge base.

Suggested slices:

1. Appearance/theme primitives only.
2. Studio draft contract/store only.
3. Studio live-preview bridge/host only.
4. Navigation changes only after comparison with merged Home/Leads fixes.
5. Page-wide cache/reference bumps only after source equivalence is established.

### P1 — historical PRs / branches

Two large old draft PRs remain open:

- PR #44 — historical shared-shell/customer/Studio-media repair branch;
- PR #48 — historical production-recovery/customer/navigation/owner-publishing/brand branch.

These contain useful history but are not current release candidates. Later merged PRs already reconciled portions of this work. Treat them as source-mining/reference branches, not merge targets.

Other preserved review branches include `review/home2-public-bottom-nav-20260823` and `review/nav1-authenticated-home-20260821`; compare content to current `evaraos` before taking anything from them.

## Roadmap

### Phase A — establish one source of project truth (NOW)

- [x] Confirm canonical repository and integration branch.
- [x] Audit recent commit/PR history.
- [x] Separate source state from deployed state.
- [x] Identify preserved theme/Studio branch divergence.
- [x] Identify open historical PRs.
- [x] Create this durable roadmap checkpoint in GitHub review space.
- [ ] Refresh `docs/RELEASE_STATUS.md` after review.
- [ ] Add a short `docs/PROJECT_HISTORY.md` timeline if a permanent history log is desired.

### Phase B — verify production against source

- [ ] Audit current Firebase Hosting deployment against exact Git SHA.
- [ ] Audit current Functions inventory.
- [ ] Audit current Firestore rules against `firebase/firestore.rules`.
- [ ] Audit current Storage rules against `firebase/storage.rules`.
- [ ] Audit index status, especially known messages indexes.
- [ ] Audit billing/IAM/App Check constraints.
- [ ] Produce a deployment delta report before changing production.

### Phase C — authenticated application QA

- [ ] Home matrix.
- [ ] Leads matrix.
- [ ] Dashboard matrix.
- [ ] Notifications/logout/session continuity.
- [ ] Lifecycle and role-denial scenarios.
- [ ] Record evidence under `docs/audits/` with exact revision/date.

### Phase D — staff onboarding rollout decision

Path 1: stay Spark-only
- keep trusted callable-dependent onboarding non-operational;
- preserve safe application intake without uploads;
- continue UI/source work that does not falsely claim backend completion.

Path 2: resume Blaze/backend deployment later
- deploy only reviewed trusted callables/rules/indexes;
- verify App Check and IAM;
- run real callable integration tests;
- then release dependent Hosting UI.

### Phase E — Studio/theme reconciliation

- [ ] Inventory unique commits/files in preserved Studio/theme branch.
- [ ] Split by architectural concern.
- [ ] Port only content that still fits current authority and navigation contracts.
- [ ] Run Runtime Shell, Design System, Icon, access/lifecycle and Studio-specific CI.
- [ ] Avoid wholesale old-branch merge.

### Phase F — repository cleanup

- [ ] Classify root HTML and root `sw.js` as source, maintenance input or obsolete copy.
- [ ] Reconcile root `settings/` publisher relationship to `public/settings/`.
- [ ] Classify historical audit outputs.
- [ ] Consolidate only after reference searches and focused PRs.

## Evidence timeline

### July 2026

Historical PRs #44/#48 capture customer portal, navigation, owner publishing, brand and Studio recovery work. They remain preserved drafts and are not current release candidates.

### August 2026

The codebase gained trusted Experience/Studio backend/runtime architecture, brand/navigation consolidation, shared secondary navigation, drawer motion and broad shell-motion coverage. Later reconciliations selectively superseded some older navigation branches.

### September 10–11, 2026

- canonical role normalization merged;
- repository organization/documentation merged;
- Home/navigation reconciliation merged;
- Spark-compatible Experience Hosting mode merged;
- verified Hosting-only production release recorded;
- Leads drawer refresh stabilization merged.

### September 12, 2026

PR #81 merged trusted staff onboarding and secure Spark-safe application intake. All eight PR-head workflow families observed in the audit completed successfully. No production Firebase backend deployment was part of that source merge.

### September 13, 2026

This roadmap audit established the current split between:

1. current canonical source;
2. last documented deployed Hosting source;
3. preserved Studio/theme work;
4. historical branches/PRs;
5. backend capabilities blocked or deferred by the current Spark plan.

## Operating rules going forward

1. GitHub is the durable project source of truth; important conclusions should be written into repository docs or PRs, not left only in chat history.
2. `evaraos` remains the integration branch; implementation work should happen on focused `review/...` branches.
3. No broad old-branch merge based on commit counts alone.
4. No Firebase deployment based only on source merge status.
5. Record exact commit, date, scope, validations and limitations for each release/audit.
6. Never weaken authentication, role, tenant, Firestore or Storage authority to make a UI flow pass.
7. Keep Spark constraints explicit; unavailable backend features should fail clearly rather than pretend success.
8. Treat historical audits as snapshot evidence, not current truth.

## Next recommended action

Review this roadmap, then perform a **production/source delta audit** before any functional changes. The first deliverable should be a table showing, component by component, what exists in `evaraos`, what is currently deployed, and what is intentionally deferred. Only after that should the next implementation/release slice be selected.
