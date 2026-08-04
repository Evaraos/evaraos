# Canonical Messaging Registry Migration

## Purpose

Move legacy message-registry records from random Firestore document IDs to the canonical conversation ID required by the hardened client and Firestore rules.

The registry invariant is:

```text
channels/_group_registry/messages/{groupId}
document ID == document.groupId
```

The migration callable is App Check protected and restricted to an active platform administrator. It defaults to read-only dry-run behavior.

## Safety sequence

1. Merge and validate the canonical-client and migration-planner source.
2. Complete the hashed production access-continuity report and review every non-ready account.
3. Deploy Functions, rules, indexes, Storage, and the client only through the separately authorized coordinated release.
4. From an approved HTTPS origin, authenticate a dedicated platform-administrator QA account with App Check active.
5. Call `migrateMessageRegistry` without setting `dryRun: false`.
6. Require zero malformed records and zero security-metadata conflicts. Review the returned counts and retain the plan hash in restricted release evidence.
7. Call again with:

   ```json
   {
     "dryRun": false,
     "deleteLegacy": false,
     "expectedPlanHash": "the-reviewed-dry-run-plan-hash",
     "confirmation": "MIGRATE CANONICAL MESSAGE REGISTRY"
   }
   ```

   This creates missing canonical targets and retains every legacy record.
8. Re-run the dry run. The plan hash must be reviewed again because canonical targets now exist.
9. Run authenticated messaging QA for direct, group, role, cross-tenant denial, notifications, and group images.
10. Only after that review, repeat the confirmed apply with `deleteLegacy: true` and the newest reviewed plan hash.
11. Run a final dry run and require `legacy: 0`, `malformed: 0`, and `conflicts: 0`.

## Fail-closed behavior

- Unsupported or incomplete registry records block apply.
- Conflicting membership, role, company, or creator metadata blocks apply.
- Apply is rejected when the registry changed after the reviewed dry run.
- Missing canonical targets use create-only writes, so a concurrent target cannot be overwritten.
- Legacy deletion begins only after canonical target creation succeeds.
- The client ignores non-canonical legacy records and never fabricates a registry record.

## Evidence handling

Do not commit account identifiers, registry document IDs, user emails, access tokens, App Check tokens, or raw production reports. Store production audit and migration evidence in the restricted release system and commit only a redacted status record if the release process requires it.

This runbook does not authorize a deployment or production migration by itself.
