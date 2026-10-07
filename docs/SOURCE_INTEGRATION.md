# Source and integration

`Evaraos/evaraos`, branch `evaraos`, is the shared source authority. A clean
connected checkout starts at that branch's current GitHub revision. The
October 7 reconciliation baseline is `11e9e25bdc03aea63e1881fdaa48d2f066b72c1a`.

## Working baseline and recovery

The designated clean local checkout is in the organized EvaraOS development
folder, `01 - Active Development/evaraos-connected`. It tracks `origin/evaraos`.
The older `evaraos-canonical` copy contains unfinished work and remains preserved
separately. Do not reset that copy or merge its mixed work into the baseline.

The October 7 reconciliation inventoried 39 checkouts, 93 local/remote
references, and 467 dirty status entries. Every reference and dirty path has a
disposition in [the reconciliation ledger](audits/source-integration-2026-10-07.json).
Original staged and working bytes were archived separately for the four dirty
copies; three complete referenced-history bundles were verified. These local
recovery archives stay outside the repository. Thirty-five relocated worktree
links were repaired without changing their source, index, branch, or HEAD.
Three genuinely missing temporary registrations remain preserved in the
inventory; they were not pruned.

Disposition does not mean product acceptance. Already integrated or patch
equivalent work needs no duplicate merge. Active PRs remain isolated until their
reviews and current checks pass. Historical drafts and mixed, unique source are
quarantined for selective recovery through focused PRs. No historical candidate
or existing product PR was merged, closed, rebased, or deleted by this work.

## Required integration policy

The canonical GitHub ruleset must require all of the following, with no bypass
actors:

- PR-based changes and one approving review, with stale approvals dismissed.
- Approval of the latest reviewable push by someone other than its pusher.
- Resolution of review conversations.
- `Canonical PR Gate` from GitHub Actions and `CodeQL` from the CodeQL app.
- Current-base checks, plus existing deletion and force-push protection.

GitHub's effective branch rules are the enforcement authority. Workflow source
or a green historic run alone cannot establish that enforcement is active.
Do not add an administrator or automation bypass to complete an integration.
An account cannot approve its own PR. At reconciliation time `Evaraos` was the
only collaborator, so PRs authored by that account need an additional eligible
reviewer before they can merge under this policy.

The canonical gate runs on every PR targeting `evaraos`, uses Node.js 22, and
tests the proposed integration commit. It validates governance, regression
tests, seventeen existing source contracts, whitespace, authority files, JSON,
and the release-proof structure. Existing backend/emulator and feature workflows
continue to provide their scoped checks. Their runtime evidence remains a
separate acceptance requirement for the affected feature.

## Release evidence enters through review

The Settings copier remains frozen. Four historical source migration workflows
are retired with no dispatch or executable push path. Proof workflows use
read-only source permissions, retain their validation/confirmation gates, and
publish JSON evidence as artifacts. They do not commit or push into `evaraos`.

| Workflow | Proof artifact | Canonical destination after review |
| --- | --- | --- |
| Studio source verification | `studio-source-verification-RUN_ID` | `docs/deployments/studio-release-candidate-source-verification.json` |
| Firebase release | `firebase-production-release-proof-RUN_ID` | `docs/deployments/firebase-production-release.json` |
| Trusted Studio deployment | `trusted-studio-functions-production-proof-RUN_ID` | `docs/deployments/trusted-studio-functions-production.json` |
| Trusted Studio inventory | `trusted-studio-functions-inventory-RUN_ID` | `docs/deployments/trusted-studio-functions-verification.json` |
| Authenticated visual QA | `evaraos-visual-qa-report-RUN_ID` | `docs/deployments/studio-authenticated-runtime-verification.json` |

To integrate evidence, obtain the artifact from its actual completed run,
inspect its recorded status, exact source/deployment commit and scope, then
copy only the approved JSON into the listed destination on a focused branch
based on current `evaraos`. Verify existing proof ancestry/protected-path gates,
open a PR, and merge only after independent review and required checks. Keep the
original proof fields: a proof-only PR must not rewrite the validated source
commit to its own commit. Failed or partial evidence never becomes a confirmed
release by being copied or merged. Do not use `[skip ci]` on proof commits.

Until this workflow migration is merged, canonical's older proof writers are
blocked by required PR rules. Complete the reviewed migration before using those
release workflows. No deployment, live QA, production data change, or source-proof
refresh was performed as part of the October 7 integration work.
