# Staged staff production release

Source preparation only. No billing, IAM, App Check, Authentication, Stripe or
Firebase production changes are authorized by this document.

Use the production release workflow with an exact reviewed commit SHA and its
existing `DEPLOY EVARAOS PRODUCTION` confirmation. Obtain separate deployment
authorization. Do not select `functions`, `backend`, `storage` or `all` for this
staff rollout. The existing combined `firestore` option remains available but
is intentionally not used here.

1. `firestore-indexes`: deploy indexes only. Reconcile the inventory first.
2. Wait for all three additive messaging indexes (kind/companyId plus memberUids,
   adminUids or allowedRoles) to be READY.
3. `staff-functions`: deploy only reviewStaffApplication and
   updateStaffOnboardingTask in us-central1.
4. Verify both callable inventories and real production App Check token delivery.
   Source audits do not prove token acquisition or effective deployment IAM.
5. `hosting`: publish the reviewed merged client.
6. Immediately run `firestore-rules`: publish the complete reviewed ruleset.
7. Run a separately authorized controlled end-to-end staff workflow and verify
   forbidden applicant/profile writes are rejected.

Storage remains excluded. Initial intake needs no document upload and records
verification as deferred. Previous local emulator compatibility assertions proved:
new client/current rules accepted; old client/hardened rules rejected; new
client/hardened rules accepted. Hosting before rules minimizes interruption;
cached old clients may require refresh. Keep the interval short because the old
rules retain the applicant metadata-integrity gap. Do not roll Hosting back to
an incompatible old client after publishing hardened rules.

## Runtime and gates

Functions and relevant backend CI use Node 22. This shared package runtime applies
to any future Functions deployment, but a staff-only deployment must not redeploy
other exports. The complete Functions suite, rules emulators and source audits
must pass on Node 22 before approval. Unrelated frontend tooling retains its runtime.

Changing functions/package.json invalidates the protected source proof. After
review/merge, refresh the proof through the existing canonical source-verification
workflow against the exact authoritative commit; do not bypass ancestry gates or
hand-edit a confirmed proof. This PR does not dispatch deployment workflows.

Remaining production prerequisites: effective IAM for the actual GitHub service
account, approved billing/cost controls, live App Check token proof, and index
readiness. Connecting Stripe does not satisfy any of those prerequisites.
