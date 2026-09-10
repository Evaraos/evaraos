# Repository organization

This guide describes the source layout inspected on 2026-09-10 at integration commit `aa2474c55d6f13cd4d2ff91935625108ec600ff0`. It is a navigation and refactoring guide, not a production-readiness claim. Older reports describe their own snapshots.

## Ownership and placement

| Change | Existing home | Check before changing paths |
| --- | --- | --- |
| Hosted page | `public/` or an existing subdirectory | Links, access-control route registry, redirects, and visual tests |
| Navigation | `public/assets/js/nav.js`, modules in `public/assets/js/nav/`, styles in `public/assets/css/nav/` | Module identity, startup imports, menu/session listeners, and scroll state |
| Authentication/access | `public/assets/js/firebase.js`, `verified-profile.js`, `account-lifecycle.js`, `access-control.js`, `route-guard.js` | Verified user profile, lifecycle, route policy, and App Check; cached UI state is not authority |
| Browser feature | Its existing directory under `public/assets/js/` and corresponding CSS | All relative imports, dynamic imports, HTML references, and cache identifiers |
| Backend | `functions/` | CommonJS imports, exports from `index-stats.js`, tests, and deployment configuration |
| Security rules | `firebase/` | Paths in `firebase.json`, emulator tests, and backend contract |
| Audit or maintenance utility | `tools/` | Workflow invocations, working directory assumptions, and whether it writes data |
| Tests | Existing package under `tests/`, or alongside the relevant backend module | Package scripts, fixtures, workflow paths, and ignored credentials/artifacts |
| Architecture decision | `docs/adr/` | Link from the relevant architecture guide |
| Reviewed audit evidence | `docs/audits/` | Date, exact revision, scope, results, and explicit limitations |
| Local screenshots or test output | An ignored output location outside tracked source, or the test package's existing ignored output directory | No account data, credentials, or generated artifacts in a normal code commit |

Prefer these established homes when adding files. Avoid introducing another parallel implementation or reorganizing active runtime files purely for appearance.

## Known migration candidates

- Root `settings/` is a source for `tools/publish-settings-pages.js`, which copies HTML into `public/settings/`. The related workflow invokes it. Relocating that directory requires updating the publisher and checking whether the hosted files have diverged before any copy.
- Root HTML pages and root `sw.js` sit outside `hosting.public = public`. Determine whether each is source, an obsolete copy, or a maintenance input by inspecting callers and comparing the hosted counterpart. Do not delete or move them based only on location.
- `tools/reports/` contains historical repo-audit outputs. Inspect the report generator and every reference before consolidating published evidence under `docs/audits/`; preserve the report's original revision and date.
- Existing versioned browser filenames need import and runtime verification before consolidation. Renaming only the file can split module instances, break routes, or leave browsers using cached old dependencies.

## Procedure for a file move

1. Start from the current `evaraos` revision in a focused branch. Record the baseline and affected paths.
2. Search for each filename, URL, module specifier, workflow path filter, package command, Firebase reference, and service-worker cache entry. Inspect dynamic path construction too.
3. Move one coherent group and update its consumers in the same commit. Preserve public URLs unless a route migration is part of the change.
4. Run the affected source audits, import/syntax checks, and browser or emulator tests. Confirm the old location has no live consumers and the new location is covered by CI.
5. Review the complete diff and merge the focused PR after its checks and required runtime evidence pass. Retain a reversible commit history.

Do not mix a broad directory migration with an unresolved UI or authentication repair; keeping each change independently reviewable makes regressions easier to isolate.

## Branch reconciliation

`evaraos` is the permanent integration branch. Compare each candidate to the current base before integrating it:

- Already contained in the base: there is no missing work to merge.
- Patch-equivalent: check content equivalence rather than introducing a duplicate patch.
- Contains unique, reviewed work: port the coherent change or merge only after conflict resolution and validation.
- Contains mixed unfinished work: preserve it on a clearly identified review branch and split it into focused candidates.

An available Firebase login confirms CLI access. It does not establish conflict-free branches, passing checks, browser authorization, or production readiness. Historic branch maps and percentages in older documents are not current inventory.
