# Staging Audit Technology

## Layer 1: Synthetic demonstration

`npm run demo` exercises the classification engine with in-memory accounts only. It proves the decision logic without connecting to Google Cloud or Firebase.

## Layer 2: Cloud readiness verification

`npm run readiness:staging -- --project <project-id> --ack-read-only I_UNDERSTAND_THIS_IS_READ_ONLY` reads project metadata, IAM policies, service-account metadata, service-account keys, enabled APIs, and the active gcloud operator.

It blocks readiness unless all ten controls pass:

1. staging project ID present;
2. production project rejected;
3. project active;
4. auditor service account exists;
5. both viewer roles present;
6. no extra project roles;
7. no user-managed keys;
8. active operator identified;
9. Token Creator scoped only to that operator;
10. required APIs enabled.

## Layer 3: Hashed staging audit

The auditor lists Authentication users and reads the required Firestore collections. It hashes user identifiers by default, compares browser and backend access decisions, and produces classifications without changing data.

## Layer 4: Human approval

`security_risk`, `manual_review`, `claims_mismatch`, and `missing_metadata` records remain blocked. No migration is generated automatically.

## Layer 5: Production gate

Production remains inaccessible until staging reaches 100%, report counts are reconciled, false positives are corrected in the auditor, and a separate production-specific approval is provided.
