# Backend Security Phase 1

## Scope

This phase changes backend authorization and trusted server workflows only. It does not modify page markup, styles, navigation, or visual behavior.

## Security model

Authentication proves identity. Business-data access additionally requires:

- an existing user profile;
- `status` equal to `active` or `approved`;
- `approvalStatus` equal to `approved`;
- an explicitly authorized role;
- tenant ownership, customer ownership, assignment, or conversation membership.

Platform-wide access is restricted to `owner`, `super_admin`, and an `admin` whose profile explicitly contains `platformAccess: true`.

## Trusted workflows

- `reviewStaffApplication` performs application review, user activation, staff-profile creation, audit creation, and claim synchronization through a transaction-backed callable function.
- `writeSecurityAudit` creates immutable audit and history records from Firestore authentication context.
- `bootstrapMessageChannels` creates canonical company-scoped role channels.
- `migrateMessageRegistry` converts legacy random registry documents to canonical conversation IDs.
- `resolveMessageRecipient` limits recipient discovery to active accounts in the caller's tenant.
- `rebuildStats` is an App Check-protected platform-admin callable and uses paginated reads plus BulkWriter.

## Deployment gates

Do not deploy the new rules until all gates are complete:

1. Existing production user profiles are reviewed for valid `status`, `approvalStatus`, `companyId`, and `platformAccess` values.
2. The Applications client is wired to `reviewStaffApplication`; direct approval writes are intentionally denied.
3. `migrateMessageRegistry` is executed by a platform administrator and messaging clients use canonical registry document IDs.
4. Tenant collection queries include a `companyId` boundary, while assigned-worker queries include an assignment constraint.
5. Firebase App Check enforcement is enabled for callable functions and reviewed for Firestore and Storage.
6. The Backend Security Validation workflow passes.

## Expected breaking protections

- Pending, suspended, inactive, disabled, and rejected accounts cannot read business data.
- Sales representatives cannot use management-level collection access and only receive assigned leads or jobs.
- Unfiltered tenant collection queries are denied.
- Direct writes to audit logs, staff profiles, payouts, transactions, Stripe state, and payroll runs are denied.
- Legacy messaging channels without a canonical registry membership document are denied.
- Cross-company Storage reads and writes are denied.

## Rollback

Rollback consists of reverting the phase commit and redeploying Firestore rules, Storage rules, indexes, and functions from the prior known-good revision. Do not partially roll back only one authorization surface because Firestore, Storage, functions, and messaging registry rules are designed to operate together.
