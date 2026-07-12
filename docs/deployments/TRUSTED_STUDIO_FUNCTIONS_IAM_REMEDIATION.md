# Trusted Studio Functions IAM Remediation

Date: 2026-07-12  
Project: `evaraos-web`  
Tracker: Issue #29

## Verified blocker

The GitHub Actions deployment identity authenticates successfully and resolves the correct Firebase project, but the Firebase CLI IAM preflight returned only:

```text
firebase.projects.get
```

The following required inventory permissions were absent:

```text
cloudfunctions.functions.list
run.services.list
```

The first Functions API request consequently returned HTTP 403 with:

```text
Permission 'cloudfunctions.functions.list' denied
```

Evidence:

```text
docs/deployments/trusted-studio-functions-verification.json
```

Workflow run:

```text
29183274285
```

## Security decision

Do not grant Owner, Editor, Firebase Admin, or broad project-level Service Account User solely to bypass this error.

Use the documented Cloud Run functions deployment roles and scope `roles/iam.serviceAccountUser` to the exact runtime and Cloud Build service accounts.

## Required variables

Run these commands from an administrator workstation authenticated to Google Cloud. Do not commit service-account JSON or the deployer email to the public repository.

```bash
export PROJECT_ID="evaraos-web"
export DEPLOYER_SERVICE_ACCOUNT="REPLACE_WITH_GITHUB_ACTIONS_SERVICE_ACCOUNT_EMAIL"
export DEPLOYER_MEMBER="serviceAccount:${DEPLOYER_SERVICE_ACCOUNT}"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export RUNTIME_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
export CLOUD_BUILD_SERVICE_ACCOUNT="$(gcloud builds get-default-service-account --project "$PROJECT_ID")"
```

Validate every resolved value before granting access:

```bash
printf 'Project: %s\nProject number: %s\nDeployer: %s\nRuntime: %s\nCloud Build: %s\n' \
  "$PROJECT_ID" \
  "$PROJECT_NUMBER" \
  "$DEPLOYER_SERVICE_ACCOUNT" \
  "$RUNTIME_SERVICE_ACCOUNT" \
  "$CLOUD_BUILD_SERVICE_ACCOUNT"
```

## Step 1 — Grant Cloud Functions Developer to the deployer

This role supplies function read/write permissions and the related Cloud Run function permissions required by Firebase CLI deployment.

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="$DEPLOYER_MEMBER" \
  --role="roles/cloudfunctions.developer" \
  --condition=None
```

## Step 2 — Allow the deployer to act as the runtime service account

Grant this on the runtime service account, not project-wide:

```bash
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --member="$DEPLOYER_MEMBER" \
  --role="roles/iam.serviceAccountUser"
```

## Step 3 — Allow the deployer to act as the Cloud Build service account

Grant this on the resolved Cloud Build service account:

```bash
gcloud iam service-accounts add-iam-policy-binding "$CLOUD_BUILD_SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --member="$DEPLOYER_MEMBER" \
  --role="roles/iam.serviceAccountUser"
```

## Step 4 — Confirm the Cloud Build service account can build

Google Cloud requires the Cloud Build service account used by the project to have the Cloud Build Service Account role.

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SERVICE_ACCOUNT}" \
  --role="roles/cloudbuild.builds.builder" \
  --condition=None
```

## Step 5 — Verify only the required permissions

Before rerunning deployment, confirm the deployer can list Functions and Cloud Run services:

```bash
gcloud projects test-iam-permissions "$PROJECT_ID" \
  --permissions="cloudfunctions.functions.list,run.services.list,firebase.projects.get"
```

Expected permissions:

```text
cloudfunctions.functions.list
run.services.list
firebase.projects.get
```

## Step 6 — Rerun the independent inventory verifier

Trigger:

```text
Verify Trusted Studio Functions Production
```

Required result:

```text
status: confirmed
reason: all-required-callables-present
```

If the eight callables have not yet been deployed, `firebase functions:list` should still succeed and the verifier should report `required-callables-missing` instead of an IAM failure. That result confirms the identity is ready for Gate C.

## Step 7 — Rerun the targeted deployment

Trigger:

```text
Trusted Studio Functions Production Deployment
```

Manual confirmation phrase:

```text
DEPLOY TRUSTED STUDIO FUNCTIONS
```

The workflow must produce:

```text
docs/deployments/trusted-studio-functions-production.json
```

## Step 8 — Rerun inventory verification

After deployment, rerun the inventory verifier. It must confirm all eight callables and update:

```text
docs/deployments/trusted-studio-functions-verification.json
```

## Required callables

- `openStudioBranch`
- `commitStudioTransaction`
- `getStudioOperationRange`
- `createStudioCheckpoint`
- `restoreStudioCheckpoint`
- `createStudioBranch`
- `closeStudioSession`
- `prepareStudioRelease`

## Rollback

To remove the deployer's project-level function-development access:

```bash
gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
  --member="$DEPLOYER_MEMBER" \
  --role="roles/cloudfunctions.developer" \
  --condition=None
```

Remove Service Account User bindings from the runtime and Cloud Build service accounts separately if this deployment identity is retired.

## Approval Status

🟡 Approved with Changes — the role design is approved, but IAM changes require a Google Cloud administrator and must be followed by both independent inventory verification and deployment evidence review.
