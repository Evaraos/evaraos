# EvaraOS Access Continuity Preflight

This package provides three separate safety technologies:

1. A synthetic classification demo with no Firebase connection.
2. A read-only Google Cloud staging-readiness verifier.
3. A hashed Firebase Authentication and Firestore access-continuity auditor.

None of these tools update users, custom claims, roles, companies, applications, permissions, rules, or deployed Functions.

## Technology demonstration

Run the in-memory demonstration first:

```bash
npm install
npm run demo
```

It creates synthetic scenarios for ready users, legacy role aliases, missing status fields, claims mismatches, missing tenant assignments, ambiguous owners, platform-admin drift, and disabled accounts. It reads no Firebase data and performs no writes.

## Required safety boundary

Run cloud tools with a dedicated Google service account that has only:

- Firebase Authentication Viewer (`roles/firebaseauth.viewer`)
- Cloud Datastore Viewer (`roles/datastore.viewer`)

Do not grant Owner, Editor, Firebase Admin, Datastore User, or any other write-capable role.

Do not create or download a service-account JSON key. The runtime blocks `GOOGLE_APPLICATION_CREDENTIALS` and requires short-lived Application Default Credentials created through service-account impersonation.

## Staging readiness verification

Before reading staging Authentication or Firestore, verify the project and identity:

```bash
node staging-readiness.js \
  --project STAGING_PROJECT_ID \
  --ack-read-only I_UNDERSTAND_THIS_IS_READ_ONLY
```

The verifier refuses `evaraos-web` and checks:

- the staging project exists and is active;
- the dedicated auditor service account exists;
- exactly the two required project roles are assigned;
- no extra project role is assigned to the auditor;
- no user-managed service-account key exists;
- only the active operator can impersonate the auditor;
- IAM Credentials, Firestore, and Identity Toolkit APIs are enabled.

It executes only project describe, IAM policy reads, service-account describe, key list, service list, and active-account list commands.

## Staging audit execution

After the readiness result reaches 100%:

```bash
gcloud auth application-default login \
  --impersonate-service-account evaraos-access-auditor@STAGING_PROJECT_ID.iam.gserviceaccount.com

node index.js \
  --project STAGING_PROJECT_ID \
  --environment staging \
  --ack-read-only I_UNDERSTAND_THIS_IS_READ_ONLY
```

## Production execution

Production runs always hash UID and email values. `--include-identifiers` is rejected.

```bash
gcloud auth application-default login \
  --impersonate-service-account evaraos-access-auditor@evaraos-web.iam.gserviceaccount.com

node index.js \
  --project evaraos-web \
  --environment production \
  --ack-read-only I_UNDERSTAND_THIS_IS_READ_ONLY \
  --ack-production-read-only I_APPROVE_HASHED_PRODUCTION_READ_ONLY_AUDIT
```

Reports are written locally to `audit-output/` with restrictive permissions and must never be committed or uploaded publicly.

## Output classifications

- `ready`
- `compatibility_mapping`
- `missing_metadata`
- `claims_mismatch`
- `manual_review`
- `security_risk`

Only `ready` and reviewed `compatibility_mapping` accounts can ever become automatic migration candidates. This tool itself never performs migration.

## Validation

```bash
npm run check
```

The check validates syntax, runs classification, runtime-safety, and staging-readiness tests, scans the cloud tools for prohibited mutation APIs and gcloud commands, verifies static-key blocking, executes the synthetic demonstration, and verifies the production acknowledgement gate.
