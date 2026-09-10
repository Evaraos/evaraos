# Release status and essential work queue

Verified on 2026-09-10. This page replaces estimates with dated release evidence; historical audit documents remain historical.

## Live release

- Website: [evaraos.web.app](https://evaraos.web.app/).
- Released source: `1130979f72e8ac483bdf4b7da02dc8c8449eb50a` on the permanent `evaraos` branch.
- [Production workflow 34444113035](https://github.com/Evaraos/evaraos/actions/runs/34444113035): validation and Hosting deployment succeeded.
- [Machine-readable release proof](deployments/firebase-production-release.json): Hosting only. Functions, Firestore rules/indexes, and Storage were not deployed in this release.
- New Hosting version: `48e565b152ad4776`; previous version: `b20e2dc5e6406522`. Keep the previous release available for rollback.

Included changes: canonical access-role normalization ([PR #74](https://github.com/Evaraos/evaraos/pull/74)), project documentation ([PR #75](https://github.com/Evaraos/evaraos/pull/75)), and verified Home navigation plus stable scroll contraction/expansion ([PR #76](https://github.com/Evaraos/evaraos/pull/76)).

Seven live files, including Home, navigation entry/session/scroll/bottom modules, access control, and bottom-nav CSS, matched the released source byte-for-byte. Live guest checks at 1440px and 390px confirmed a single bottom bar, expansion when scrolling up, contraction when scrolling down, public drawer links, no private controls, and signed-out Leads/Dashboard redirects to login. The candidate also passed five PR workflows, 18 source audits, 69 Home authority assertions, and guest checks at four viewport widths.

These checks do not prove authenticated owner workflows. Current-release Home/Leads/Dashboard session continuity, notifications, and logout remain to be exercised with an approved signed-in account. A complete semantic or security review of every repository file has not been performed.

## Essential work, in order

| Priority | Work | Evidence and next action |
| --- | --- | --- |
| 1 | Verify signed-in operations | Run the current-release owner matrix on Home, Leads and Dashboard; check reload, drawer, scrolling, notifications and logout. Record failures against exact source. |
| 2 | Restore backend deployment prerequisites | A fresh Cloud Billing API read reports `billingEnabled: false` for `evaraos-web`. Enable the project's appropriate billing plan/account before a Functions release. Recheck IAM and secret metadata after billing is active; do not copy secret values into source or reports. |
| 3 | Deploy trusted Studio backend | The current 19-function inventory contains none of the eight required trusted Studio callables. The production deployment proof is absent and the old inventory proof is unverified. Use the existing trusted Studio deployment and verification workflows after prerequisites pass. Nineteen local Studio/Experience core tests passed on the released source. |
| 4 | Restore Experience backend | `/__experience/config` returned HTTP 404 before the Hosting release. The six Experience functions are missing from the live function inventory. Validate and release this group using the existing scoped workflow; verify the endpoint and owner editor afterward. |
| 5 | Reconcile preserved Studio/theme work | Review `review/preserve-local-studio-theme-20260910` and `studio/live2-real-home-20260825` in coherent feature groups against current `evaraos`. The preservation checkpoint contains unfinished work; it is not a release candidate. |
| 6 | Resolve older recovery PRs | PR #44 and PR #48 contain mixed historical changes. Review unique patches and dependencies before porting; PR #48 targets an older recovery base. Do not retarget or merge wholesale merely to reduce the branch count. |
| 7 | Consolidate file layout | Follow the [organization guide](REPOSITORY_ORGANIZATION.md). Start with exact references and hosted/source comparisons for root HTML, root `settings/`, root `sw.js`, and historical reports. Move one verified group per PR. |

## Branch disposition

- PR #68 is closed as superseded by PR #76; its branch and commit history are preserved.
- PRs #74, #75 and #76 are merged. Their source is included in the release above.
- The imported Downloads tree and original dirty canonical checkout are preserved. Their filenames and folder locations do not establish release authority.
- Historical `agent/`, `fix/`, `hotfix/`, `production/`, `recovery/`, `release/`, and `studio/` branches need content comparison against current `evaraos`. An ahead count is not evidence that all commits should be merged.

Update this page when a release or queue item changes, linking the new exact-commit evidence. Do not report all prior months of work as released while backend prerequisites, authenticated QA, and preserved branch reviews remain outstanding.
