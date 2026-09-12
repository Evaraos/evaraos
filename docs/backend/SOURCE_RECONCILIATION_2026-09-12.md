# Staff backend source reconciliation — 2026-09-12

Base: Evaraos/evaraos branch evaraos, a188ec9e17669dba9c3ef4182b3a42131b35cc5f.
Isolated branch: backend-reconciliation. No production resources changed. Branch prepared for review-only push; no merge.

## Contracts

- updateStaffOnboardingTask accepts exactly {taskKey, completed}. UID comes only from request.auth. No management override. App Check is required at the callable, following approval conventions; project enforcement settings are unchanged.
- The transaction reads the canonical user and own staff profile. Both must be active/approved, with matching company, role and identity. Missing or inconsistent profiles fail closed.
- Allowed keys: reviewPolicies, completeTaxDocs, completeTraining, receiveAssignment, activatePayouts. Values are booleans. Writes contain only onboardingTasks, onboardingStage and server updatedAt; the transaction also writes an audit event.
- Tasks are self-reported checklist acknowledgements. fully_active is the existing checklist stage, NOT authority to work, proof of document verification, an employment assignment or payment activation. No permission, claims or account status is changed. UI explains this distinction.
- Approval still creates the profile and initial five false tasks. Reviewer authorization is now read within the transaction to detect concurrent privilege changes.
- Canonical global administrator: platform_admin, with super_admin retained as its established legacy alias. Owner retains existing authority. No mapping of admin, manager, unknown or vendor roles to platform authority. Stored roles are not migrated by this patch. Firestore platform() now recognizes canonical platform_admin; staff_profiles deny-write rule is unchanged. Storage retains existing authority policy while recognizing that canonical role.
- Initial intake never invokes Storage. It writes attachments=[], verificationStatus=pending_review and documentVerificationStatus=deferred with an explicit reason. File inputs are disabled. Future document collection should be a separate capability-checked flow, not restored as a prerequisite to initial account creation.

## Validation

- 53 Functions unit tests passed via npm run test:all (8 reconciliation tests plus existing intelligence, marketplace, messaging, Studio journal and Experience tests); zero failures or skips.
- 18 Firestore/Storage emulator tests passed using demo-evaraos-reconciliation. Includes own/other/platform direct profile write denials, canonical/legacy platform parity, tenant admin isolation, pending document-free applications and forbidden privileged role requests.
- Six source audits passed: staff approval, staff applicant lifecycle, access authority, account lifecycle, messaging registry and Experience backend.
- Changed JavaScript syntax and git diff whitespace checks passed.
- Callable tests execute the real handlers with mocked Admin SDK transactions; callable HTTP/App Check and actual Admin SDK end-to-end behavior remain release checks.
- Resume validation: dependency installation was permitted and completed using npm install, with lifecycle scripts disabled and no lockfile changes. The previously blocked marketplace tests now pass. No selected suites remain blocked. Tests ran on local Node 24.19; the repository declares Node 20 and CI remains configured for Node 20.
- Full diff reviewed for privileged field writes, cross-user access, tenant boundaries, role escalation, deployment changes and future attachment schema compatibility. The only Firestore rules edit recognizes canonical platform_admin; staff_profiles rules are byte-for-byte unchanged.
- Resume review corrected stale mandatory-upload copy, removed the unused file reader and removed an unnecessary pending-update guard from task rendering.
- Final validation: 53/53 Functions tests, 18/18 emulator tests, 6/6 audits, 12/12 JavaScript syntax checks; whitespace check passed.

## Remaining risks and rollout gate

Source is ready for review, not an unconditional production release. Deployment prerequisites: billing/IAM, callable integration checks, App Check token readiness and confirmation of existing staff profile identity/company data. Legacy inconsistent profiles fail closed rather than being automatically repaired.

No Storage operation can strand initial intake now. Auth creation and Firestore writes still are not a distributed transaction; non-Storage network/Firestore failures can leave partial registration and need a separate authenticated resume/recovery design. Existing application verificationStatus update validation remains a separate hardening item from the audit; this patch does not claim to resolve every rules finding.

Keep frontend deployment behind availability of updateStaffOnboardingTask; otherwise updates fail and do not persist. Spark prevents the intended Functions deployment and document-upload capability. Do not present a successful checklist as completed compliance verification.

Eventual separately approved resources:
1. Functions us-central1/reviewStaffApplication and us-central1/updateStaffOnboardingTask.
2. Cloud Firestore (default) rules from firebase/firestore.rules (review the entire pre-existing production diff).
3. Storage bucket evaraos-web.firebasestorage.app rules from firebase/storage.rules, once usable and reviewed.
4. Three pre-existing missing messages composite indexes (kind/companyId plus array membership in memberUids, adminUids or allowedRoles); this patch does not modify indexes.
5. Hosting site evaraos client assets, after backend readiness.

No provider changes, App Check enforcement changes or billing changes are included.

## Files changed

- `.github/workflows/backend-security.yml`
- `firebase/firestore.rules`
- `firebase/storage.rules`
- `functions/index-stats.js`
- `functions/package.json`
- `functions/staff-approval.js`
- `public/assets/js/applications.js`
- `public/assets/js/onboarding.js`
- `public/assets/js/roles.js`
- `public/assets/js/staff-application.js`
- `public/staff_application.html`
- `tests/backend-security/security-rules.test.cjs`
- `tests/backend-security/staff-applicant-lifecycle.test.cjs`
- `tools/staff-approval-contract-audit.js`
- `functions/staff-authority.js`
- `functions/staff-onboarding.js`
- `functions/staff-reconciliation.test.js`
- `docs/backend/SOURCE_RECONCILIATION_2026-09-12.md`
