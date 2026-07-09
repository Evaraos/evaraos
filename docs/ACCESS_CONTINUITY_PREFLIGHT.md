# Access Continuity Preflight

## Purpose

Prevent legitimate EvaraOS users from losing access when zero-trust authorization becomes stricter, while also preventing legacy broad permissions from being carried forward.

## Non-negotiable safety rules

1. Every run is read-only.
2. The runner uses only Firebase Authentication Viewer and Cloud Datastore Viewer.
3. Service-account JSON keys are prohibited.
4. Short-lived service-account impersonation is required.
5. Production reports always hash identifiers.
6. Production requires a second explicit acknowledgement.
7. No migration is generated until the report is reviewed.
8. Unknown roles, ambiguous owners, missing companies, disabled users, and claim mismatches are never auto-corrected.
9. Detailed job roles are preserved; canonical roles are compatibility mappings, not destructive renames.
10. No secure-rule deployment occurs until every active account is classified.

## Comparison sources

- Firebase Authentication users and disabled state
- Authentication custom claims
- `users`
- `staff_profiles`
- `staff_applications`
- `companies`

## Decision model

The report shows both current browser access and strict backend access. Any difference is classified as a security risk because it can create a partial login where the app shell loads but backend data is denied.

## Credential model

Create dedicated audit service accounts for staging and production. Grant only:

- `roles/firebaseauth.viewer`
- `roles/datastore.viewer`

Grant the human operator `roles/iam.serviceAccountTokenCreator` on the audit service account itself, not broad project-level impersonation authority.

Use `gcloud auth application-default login --impersonate-service-account ...` to create short-lived local Application Default Credentials. Do not set `GOOGLE_APPLICATION_CREDENTIALS` and do not create downloadable service-account keys.

## Review sequence

1. Create and independently review the staging viewer-only identity.
2. Run staging with hashed identifiers.
3. Validate source counts against Firebase console totals.
4. Review false positives and correct the auditor—not user data.
5. Create and independently review the production viewer-only identity.
6. Run production with the production acknowledgement and hashed identifiers.
7. Review `security_risk` and `manual_review` accounts individually.
8. Approve a canonical role and tenant mapping matrix.
9. Build a separate dry-run migration from the approved report.
10. Re-run the audit and require zero unexplained access mismatches.
11. Only then consider merging and deploying stricter authorization.

## Prohibited actions in this phase

- Updating Firestore documents
- Updating Firebase Authentication users
- Setting custom claims
- Disabling or enabling users
- Renaming roles
- Assigning companies
- Creating or downloading service-account keys
- Running with Owner, Editor, Firebase Admin, or Datastore User
- Including raw identifiers in production reports
- Deploying rules or functions
- Merging a migration
