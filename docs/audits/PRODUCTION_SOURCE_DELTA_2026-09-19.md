# EvaraOS production/source delta and recent-work audit — 2026-09-19

## Scope and evidence limits

Read-only inspection of GitHub repository source, PR metadata and diffs, commit comparisons, recorded release proof, and available CI metadata. This documentation-only checkpoint is on `review/production-source-audit-20260919` based on integration commit `11e9e25bdc03aea63e1881fdaa48d2f066b72c1a`. No Firebase production resources, rules, billing, IAM or App Check settings were accessed or changed; direct live Hosting HTTP inspection was unavailable. This is NOT a full file-by-file security audit or live Firebase-console inventory.

## Source versus production

- Integration branch: `evaraos`, baseline `11e9e25bdc03aea63e1881fdaa48d2f066b72c1a` (merged PR #91).
- Latest repository-recorded confirmed Hosting release: `73cfc3cce1d43450e1da89fb9d330ca06597e018`, workflow run `34580232792`, recorded deployment `2026-09-11T08:40:11.023Z`, project `evaraos-web`.
- Machine-readable proof reports: Hosting **true**; Functions **false**; Firestore **false**; Storage **false** for that release. These flags describe this release's component changes, not a claim that no Functions, database, or rules exist in production.
- GitHub compare shows canonical source **20 commits ahead** of the recorded Hosting release, across 40 changed paths. This is a SOURCE delta, not a measured live HTTP deployment delta. The source could have been deployed through a separate/unrecorded channel; no evidence here establishes that.
- Existing `docs/RELEASE_STATUS.md` is dated September 13 and still identifies `bb188600...` as current canonical source; it is stale as of this audit. Its approved-owner Home/Leads/Dashboard production QA is reported as passed for the recorded deployed Hosting release, with notification interactions and business mutations deliberately not tested.

| Component | Canonical source / evidence | Production conclusion | Required proof before action |
| --- | --- | --- | --- |
| Hosting | 20 commits ahead of recorded release; Home CTA and new workflow changes in source | Last **documented** release is `73cfc3...`; current live revision not independently confirmed | Firebase Hosting release inventory plus exact asset/hash verification |
| Functions | Trusted staff callables in source; Node 22 and scoped `staff-functions` release workflow prepared in PR #83 | No staff deployment established; latest recorded Hosting release did not deploy Functions | Production callable inventory, billing/IAM, real App Check HTTP tests |
| Firestore rules | `firebase/firestore.rules` changed after recorded release; source hardening in PR #81 | Current deployed rules UNKNOWN; recorded Hosting release did not publish rules | Export/compare deployed rules to exact source hash; emulator + controlled release |
| Firestore indexes | Three missing messages composite indexes noted in staff release runbook | READY state UNKNOWN | Firebase index inventory and READY proof |
| Storage rules / uploads | Source changed; initial staff intake intentionally document-free | Current deployed rules UNKNOWN; uploads remain deferred under documented Spark plan | Rules inventory and separately approved capability design; not part of staff rollout |
| App Check | Callable source contracts and prior approved-owner browser token checks reported | Live staff callable token delivery UNKNOWN | Actual production callable/token checks |
| Billing/IAM | September 13 docs report billing disabled and backend readiness gates incomplete | Present state UNKNOWN, no authoritative console read | Owner-approved current billing, cost controls and effective deploy identity verification |
| Authenticated Home/Leads/Dashboard | September 13 release notes record owner QA success on documented deployed release | Verified only within recorded owner QA scope, not all roles/features or latest source | Recheck latest deployed SHA and affected flows after any Hosting release |
| Studio/Experience | Hosting static Experience config documented; trusted features have source implementations | Online editor/paid backend deferred in recorded plan | Separate trusted backend inventory, authorizations and approved rollout |

## Recent-work review

- **PR #81** (merged Sep 12): Spark-safe document-free intake; trusted onboarding checklist callable; restricted applicant metadata and profile writes; final source-recorded validation 54 Functions tests, 22 emulator tests and six source audits. Source merge did NOT deploy backend.
- **PR #82** (merged Sep 13): corrected `RELEASE_STATUS.md` to recorded Hosting SHA, documented successful approved-owner Home/Leads/Dashboard/logout QA and explicit limitations. Previous chat's assertion that authenticated QA was still wholly outstanding is now superseded for that specific deployment and owner cohort.
- **PR #83** (merged Sep 15): scoped `staff-functions`, `firestore-indexes`, `firestore-rules` release options; Node 22 backend runtime. PR description records successful Node 22 CI (54 Functions, 10 contract regression tests, 44 contract assertions, six audits, 22 emulator tests). This prepares a release; does NOT execute it. Runbook `docs/deployments/staff-production-readiness.md` requires index READY → staff Functions → real App Check → Hosting → Firestore rules → controlled E2E and excludes Storage.
- **PR #84** (merged Sep 15): read-only canonical PR gate for all PRs targeting `evaraos`. Verify actual branch protection/required-check configuration separately; source workflow alone does not establish enforcement.
- **PR #85** (merged Sep 15): authenticated Home CTA cleanup; guest CTAs hidden after verified active session and Enter Platform retargeted. PR says Node-based audit/syntax could not run in its local environment. Re-run appropriate CI/runtime QA before claiming deployed behavior.
- **PR #91** (merged Sep 19): froze the legacy automatic Settings publisher by replacing its workflow with excluded push triggers and an always-skipped no-op job. Only workflow was changed. This is containment; root `settings/` versus `public/settings/` ownership, content drift and old branches remain unresolved. PR reports 13 structural checks; actionlint not run locally, and no publisher execution/deployment test ran.
- **PR #92** (OPEN DRAFT at inspection): proposes preventing staff approval from marking deferred documents `verified`. Its patch changes `functions/staff-approval.js` and tests, without implementing document verification. IMPORTANT: approval still activates the staff account/syncs claims; access-versus-document-check policy remains unresolved. Do not conflate draft CI success with approval or merge authorization.
- **PRs #86–#90** (OPEN): separate Dashboard wording, operations listener lifecycle, obsolete customer runtimes, obsolete navigation runtimes and customer notification center; their PR bodies identify missing local Node/runtime tests for several. They are not integrated or deployed based on open PR status.
- Historical PRs #44 and #48 remain open drafts and are not merge-ready wholesale.
- Earlier roadmap `docs/PROJECT_ROADMAP_2026-09-13.md` exists on `review/project-roadmap-20260913`, not canonical `evaraos`; its baseline `bb188600...` and all confidence percentages are now stale. GitHub comparison shows that roadmap branch one commit ahead, 15 behind current canonical at this audit. Do not present it as the current integrated plan.

## High-priority findings

**P0: Staff approval/document verification status conflation.** Current canonical code approved applications with `verificationStatus=verified` irrespective of deferred documents, as shown by PR #92 diff. PR #92 addresses the metadata wording but still leaves activation/claims on approval; owner/compliance must define access gates before merging and any backend release. Previously approved production records would need a separately authorized audit/remediation, not silent bulk repair.

**P0: Deployed-versus-source uncertainty.** The recorded Hosting proof is stale relative to canonical by 20 commits; the live Firebase inventory cannot be asserted from GitHub alone. No Functions, rules, index, IAM, billing or App Check production mutation is authorized by this audit.

**P1: Documentation drift.** `docs/RELEASE_STATUS.md` uses an old canonical SHA; the September 13 roadmap is unmerged and contains stale confidence metrics. Refresh only after current production inventory is verified; preserve release proof provenance and do not replace observed facts with inference.

**P1: Settings publisher containment versus migration.** PR #91 prevents automatic wildcard publishing through that workflow, but does not reconcile source/output drift or prove all alternate publication paths absent. Audit other workflow/script entrypoints before settings migration.

**P1: Unmerged work.** PRs #86–#90 and #92 require independent diff/CI reviews. Avoid overlapping fixes and wholesale legacy merges.

## Ordered next gates

1. Obtain read-only authoritative Firebase project inspection (Hosting releases, Functions inventory, rules and indexes, billing/IAM, App Check settings). Save dated evidence without secrets.
2. Resolve the staff approval/access/document-verification policy; review PR #92 exact head, CI and emulator evidence. No merge/deploy without explicit approval.
3. Build exact source-versus-live hash/diff table per component; check the staffed release sequence only if billing/IAM/App Check prerequisites become available and user separately authorizes production actions.
4. Refresh canonical `docs/RELEASE_STATUS.md` with verified values; reconcile this review document and the old unmerged roadmap in a focused docs PR.
5. Review parked PRs #86–#90 by overlap, latest base and runtime tests; preserve Studio/theme branches for surgical reconciliation.

## References

- [Release proof](../deployments/firebase-production-release.json)
- [Release status](../RELEASE_STATUS.md)
- [Staff release runbook](../deployments/staff-production-readiness.md)
- [PR #81](https://github.com/Evaraos/evaraos/pull/81), [#82](https://github.com/Evaraos/evaraos/pull/82), [#83](https://github.com/Evaraos/evaraos/pull/83), [#84](https://github.com/Evaraos/evaraos/pull/84), [#85](https://github.com/Evaraos/evaraos/pull/85), [#91](https://github.com/Evaraos/evaraos/pull/91), [#92](https://github.com/Evaraos/evaraos/pull/92)

No product code, production resources or canonical integration branch changed by this documentation checkpoint.
