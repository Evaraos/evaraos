# EvaraOS Security Branch and Release Model

## Permanent branch policy

`evaraos` is the only permanent branch.

Every security branch is temporary, narrowly scoped, pull-request reviewed, and deleted after merge. Future branches are not created early because empty or overlapping branches create drift and increase merge risk.

## Current branch map

```text
evaraos  (only permanent branch)
├── security/access-continuity-preflight  PR #18  ACTIVE / DRAFT
│   ├── read-only account auditor
│   ├── zero-key production gates
│   ├── staging IAM readiness verifier
│   └── synthetic classification demo
└── security/backend-zero-trust-phase-1   PR #15  HELD / DRAFT
    ├── Firestore and Storage validation
    └── blocked from deployment until access continuity is proven
```

## Ordered temporary branch sequence

Only the current branch exists now. Each later branch is created after the previous phase is approved and merged.

```text
1. security/access-continuity-preflight
   Purpose: prove the audit technology and staging identity are safe.
   Exit gate: staging readiness 100%, staging audit reviewed.
   Then: merge into evaraos and delete branch.

2. security/staging-access-validation
   Purpose: correct audit false positives and validate canonical role mappings.
   Exit gate: zero unexplained staging access mismatches.
   Then: merge into evaraos and delete branch.

3. security/production-access-report
   Purpose: run and review the hashed production read-only report.
   Exit gate: every production account classified; no writes.
   Then: merge documentation only and delete branch.

4. security/access-migration-dry-run
   Purpose: generate proposed changes without applying them.
   Exit gate: owner-approved before/after manifest and rollback manifest.
   Then: merge tooling and delete branch.

5. security/zero-trust-release
   Purpose: coordinated Functions, Firestore, Storage, index, and client integration release.
   Exit gate: staged rehearsal, rollback rehearsal, final approval.
   Then: merge into evaraos, deploy deliberately, delete branch.
```

## Technology flow

```text
Synthetic scenarios
        │
        ▼
Classification engine
        │
        ▼
Staging cloud readiness verifier
(project separation, IAM, APIs, keys, impersonation)
        │
        ▼
Hashed staging read-only audit
        │
        ▼
Human review of risks and mappings
        │
        ▼
Hashed production read-only audit
        │
        ▼
Dry-run migration manifest
        │
        ▼
Coordinated zero-trust release
```

## Runtime safety boundaries

The cloud readiness verifier executes only these command families:

- project describe
- IAM policy read
- service-account describe
- service-account policy read
- service-account key list
- enabled-service list
- active-operator list

It contains no create, update, delete, enable, disable, deploy, role-binding mutation, Firestore write, Authentication write, or custom-claim write command.

The synthetic demo contains no Firebase connection and uses only `.invalid` email addresses and in-memory company records.

## Progress model

```text
Audit engine                    ██████████ 100%
Production runtime gates        ██████████ 100%
Synthetic demonstration         ██████████ 100%
Staging readiness verifier      ██████████ 100%
Staging project provisioning    ░░░░░░░░░░   0%
Staging IAM validation          ░░░░░░░░░░   0%
Staging live read-only audit     ░░░░░░░░░░   0%
Production read-only audit      ░░░░░░░░░░   0%
Migration dry run               ░░░░░░░░░░   0%
Coordinated release             ░░░░░░░░░░   0%
```
