# Release status and essential work queue

Verified on 2026-09-10. This page replaces estimates with dated release evidence; historical audit documents remain historical.

## Live release

- Website: [evaraos.web.app](https://evaraos.web.app/).
- Spark-compatible released source: `7c7c0c1579d78d3c03d5817e6a61ad706322a64e`.
- [Production workflow 34550277628](https://github.com/Evaraos/evaraos/actions/runs/34550277628): validation and Hosting deployment succeeded at 2026-09-11 01:21 UTC (September 10 in New York).
- [Machine-readable release proof](deployments/firebase-production-release.json) is the authority for the latest exact revision and deployed components. This release changed Hosting only; billing, Functions, Firestore rules/indexes, and Storage were unchanged.
- [PR #78](https://github.com/Evaraos/evaraos/pull/78) replaced the absent Experience function dependency with static Hosting configuration and an unavailable online-editor state. The live configuration URL returns HTTP 200 JSON. The response, deployment-mode module, and editor module match the released source byte-for-byte.

Validation: six PR workflows, 13 focused audits and seven source-verification gates passed. The Hosting emulator verified the real rewrite and guest navigation. Component checks proved zero Experience callable requests in static mode, one availability notice, no editor controls, and denied authority when the online service fails. The prior navigation release ([PR #76](https://github.com/Evaraos/evaraos/pull/76)) remains included, together with the role fix ([PR #74](https://github.com/Evaraos/evaraos/pull/74)) and repository documentation.

These checks do not prove authenticated owner workflows. Current-release Home/Leads/Dashboard session continuity, notifications and logout remain to be exercised with an approved signed-in account. A complete semantic or security review of every repository file has not been performed. Preserve the previous Hosting release for rollback; use the exact retained version shown in Firebase Hosting release history.

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

1. Complete the signed-in Home/Leads/Dashboard matrix, including reload, drawer, scrolling, notifications and logout. Flag Functions-dependent actions individually instead of treating the whole app as ready.
2. Improve the verified Spark-compatible workflows and reduce unnecessary database reads/listeners. Preserve all account, tenant and lifecycle rules.
3. Reconcile the preserved Studio/theme checkpoint and older PRs #44/#48 in coherent feature groups against current `evaraos`. They contain mixed unfinished work and are not release candidates.
4. Consolidate file layout following the [organization guide](REPOSITORY_ORGANIZATION.md), checking references before each group of moves.
5. When Blaze is explicitly resumed, recheck billing/IAM/secrets metadata; deploy and verify trusted Studio and Experience functions. Only then switch `EXPERIENCE_DELIVERY` to `functions` and restore the function rewrite in the same reviewed release. Remove the static payload when it is superseded. No upgrade or backend deployment is part of the Spark change.

The last metadata check found billing disabled and none of the required trusted Studio/Experience functions in the 19-function production inventory. This explains the deferred backend work; it is not a reason to stop improving the website.

## Branch disposition

- PR #68 is closed as superseded by PR #76; its branch and commit history are preserved.
- PRs #74, #75 and #76 are merged. Their source is included in the release above.
- The imported Downloads tree and original dirty canonical checkout are preserved. Their filenames and folder locations do not establish release authority.
- Historical `agent/`, `fix/`, `hotfix/`, `production/`, `recovery/`, `release/`, and `studio/` branches need content comparison against current `evaraos`. An ahead count is not evidence that all commits should be merged.

Update this page when a release or queue item changes, linking the new exact-commit evidence. Do not report all prior months of work as released while backend prerequisites, authenticated QA, and preserved branch reviews remain outstanding.
