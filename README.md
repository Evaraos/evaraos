# EvaraOS

EvaraOS is a Firebase-backed web application for company operations, teams, customer portals, leads, jobs, and administration. The permanent integration branch is `evaraos`.

## Repository map

| Location | Purpose |
| --- | --- |
| `public/` | Firebase Hosting web root: pages, browser assets, and service workers |
| `public/assets/js/` | Browser modules; navigation lives in `nav/`, Studio in `studio/`, and Experience in `experience/` |
| `public/assets/css/` | Shared styles and feature styles |
| `functions/` | Cloud Functions backend; entrypoint is `index-stats.js` |
| `firebase/` | Firestore and Storage rules |
| `firebase.json`, `.firebaserc`, `firestore.indexes.json` | Firebase targets, service configuration, and indexes |
| `tests/` | Automated backend/security and browser QA suites |
| `tools/` | Audits, maintenance scripts, and migration utilities |
| `docs/` | Architecture, decisions, audit evidence, and release runbooks |
| `.github/workflows/` | Validation and deliberately triggered release workflows |

Root-level HTML files, `settings/`, and `sw.js` are outside the configured Hosting web root. Their presence does not prove that they are unused; see the [organization guide](docs/REPOSITORY_ORGANIZATION.md) before moving or deleting them.

## Local work

The web client uses static HTML and native JavaScript modules. There is no root npm package or root build command. Backend dependencies and scripts are in `functions/package.json`; browser QA dependencies are in `tests/visual/package.json`. Match Node versions to the relevant package or workflow (the backend currently declares Node 20).

For a static UI preview, run from the repository root:

```sh
python3 -m http.server 4175 --bind 127.0.0.1 --directory public
```

Open the printed localhost URL. This server does not emulate Firebase Hosting rewrites, Functions, authentication, or App Check. In particular, `/__experience/config` requires the configured Hosting rewrite. A successful static preview is not proof of authenticated or production behavior. Use the approved Firebase/QA environment for that validation; keep credentials and debug tokens outside the repository.

Useful read-only source checks:

```sh
node tools/access-authority-audit.mjs
node tools/account-lifecycle-audit.mjs
node tools/experience-runtime-audit.js
node tools/design-system-audit.js
```

Other checks and their runtime requirements are defined by the relevant workflow and package. Maintenance and migration scripts under `tools/` are not interchangeable with audits: read a script before running it.

## Contributing and release

Use a focused temporary branch and a pull request targeting `evaraos`. Preserve unrelated local changes, review the actual diff, and run checks appropriate to the affected code. Git cannot create branches named `evaraos/...` while the `evaraos` branch exists, so use the repository's existing `review/...` convention for review work.

Merging into GitHub and deploying Firebase are separate actions. Follow the configured release workflow and its environment requirements for a deployment. Do not use historical audit documents as current release proof.

Start with the [organization guide](docs/REPOSITORY_ORGANIZATION.md), [architecture guidance](docs/SINGLE_SOURCE_ARCHITECTURE.md), [security policy](SECURITY.md), and [staging audit runbook](docs/STAGING_AUDIT_RUNBOOK.md).
