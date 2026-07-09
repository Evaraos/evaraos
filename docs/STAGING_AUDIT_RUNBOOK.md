# Staging Audit Completion Runbook

## Gate A — Isolated environment

- [ ] Dedicated Firebase staging project exists.
- [ ] Project ID is not `evaraos-web`.
- [ ] No production customer or employee data is copied.
- [ ] Authentication and Firestore use synthetic records only.

## Gate B — Least-privilege identity

- [ ] Dedicated staging auditor exists.
- [ ] Auditor has only `roles/firebaseauth.viewer` and `roles/datastore.viewer`.
- [ ] Zero user-managed service-account keys exist.
- [ ] Only the active human operator has Token Creator on the auditor.
- [ ] Static credential-file authentication is unset.

## Gate C — Technology validation

- [ ] `npm run check` passes.
- [ ] `npm run demo` shows all intended classifications.
- [ ] `npm run readiness:staging` reaches 100%.
- [ ] The hashed staging audit reports `writesPerformed: 0`.

## Gate D — Report reconciliation

- [ ] Authentication count matches the Firebase console.
- [ ] User profile count matches Firestore.
- [ ] Staff profile count matches Firestore.
- [ ] Application count matches Firestore.
- [ ] Company count matches Firestore.
- [ ] Every mismatch is explained.
- [ ] False positives are corrected in code, not in user data.

## Gate E — Closure

- [ ] Impersonated Application Default Credentials are revoked.
- [ ] Operator Token Creator binding is removed.
- [ ] Audit outputs remain local and private.
- [ ] PR stays draft until the staging report is approved.
- [ ] Production remains blocked.
