# EvaraOS Marketplace Progress

Last updated: 2026-07-09

## Overall progress

`[█████████▉] 99%`

The Marketplace workstream owns services, quotes, ordering, scheduling, maps, tracking, payments, subscriptions, invoices, customers, vendors, order changes, refunds, fulfillment lifecycle communications, policy exceptions, and Marketplace production readiness. Evara Studio remains out of scope.

## Delivery checklist

- [x] Audit existing Marketplace production surfaces
- [x] Activate Start Location and Stop Location controls
- [x] Add throttled live workforce location updates
- [x] Scope Dispatch Map feeds by company in the client
- [x] Add role-aware tracking controls
- [x] Prevent GPS writes from generating audit-log amplification
- [x] Add approved quote to order conversion
- [x] Use deterministic order IDs to prevent duplicate jobs
- [x] Normalize quote scheduling fields into order/job records
- [x] Convert the schedule from one-time loading to realtime updates
- [x] Scope schedule feeds by company in the client
- [x] Add customer-facing service discovery and cart lifecycle
- [x] Add service search and category filtering
- [x] Add quantity and add-on controls
- [x] Add single-provider order protection
- [x] Add saved and manual property selection
- [x] Match providers by configured state and city coverage
- [x] Generate date/time choices from provider hours, lead time, duration, blackouts, and booking horizon
- [x] Add company-configured slot availability support
- [x] Add customer order-request confirmation and recent request tracking
- [x] Add customer quote review, acceptance, and rejection controls
- [x] Add one-time versus recurring billing selection
- [x] Add authoritative server-side appointment capacity reservation
- [x] Add deterministic invoice, subscription, order, and reservation activation
- [x] Connect accepted quotes and invoices to Stripe Checkout
- [x] Reconcile payment state through signed, idempotent Stripe webhooks
- [x] Add subscription activation, pause, resume, and cancellation-at-period-end
- [x] Add invoice generation, open-balance checkout, and payment reconciliation
- [x] Add vendor acceptance, rejection, and fulfillment handoff controls
- [x] Release expired appointment holds and support safe checkout renewal
- [x] Add company-configurable rescheduling and cancellation policies
- [x] Move appointment capacity transactionally during approved reschedules
- [x] Queue late reschedules and cancellations for operations review
- [x] Add full-refund, partial-refund, no-refund, and manual-review policy outcomes
- [x] Add deterministic refund request records
- [x] Add Stripe-ready, idempotent refund execution
- [x] Add customer live order tracking and ETA presentation
- [x] Restrict customer tracking to assigned active workers and active service states
- [x] Add event-driven customer, company, and assigned-staff lifecycle notifications
- [x] Add customer order, notification, and refund self-service surfaces
- [x] Add the internal policy-exception review interface to Live Operations Command
- [x] Add server-authoritative exception approval and rejection
- [x] Require review notes and retain immutable decision records
- [x] Add controlled refund-percentage overrides
- [x] Add Marketplace policy unit tests
- [x] Add Marketplace production validation CI
- [x] Add a gated manual Firebase production release workflow
- [x] Remove duplicate automatic Hosting deployment workflows
- [x] Remove the stale Functions lockfile that omitted declared Stripe and OpenAI dependencies
- [x] Verify current tenant-scoped Firestore reads and deny-by-default server collections
- [ ] Configure production/test-mode secrets, run the release workflow, and complete acceptance testing

## Current transaction lifecycle

1. Active services are loaded from the production service collections.
2. A customer builds a single-provider cart with quantities and add-ons.
3. The customer selects a saved or manual service property.
4. Eligible companies are matched using configured state and city service areas.
5. Appointment choices are generated using provider hours, duration, lead time, booking horizon, blackouts, and configured availability.
6. The customer submits a structured Marketplace order request through the secure customer-lead workflow.
7. A company prepares a customer-visible quote.
8. The customer reviews line items, chooses one-time or recurring billing when eligible, and accepts or rejects the quote.
9. A trusted Cloud Function verifies customer ownership, quote status, totals, provider capacity, and appointment availability.
10. Deterministic invoice, optional subscription, order, and reservation records are created or reconciled idempotently.
11. The appointment slot is held transactionally while Stripe Checkout is open.
12. Stripe Checkout collects payment without exposing Stripe secrets to the browser.
13. Signature-verified and idempotent webhooks reconcile all linked Marketplace records.
14. Successful payment confirms the appointment and moves the order into vendor review.
15. The vendor accepts the order or rejects it back into dispatch review.
16. The customer may request a reschedule or cancellation from the order portal.
17. Safe-window reschedules move capacity between appointment slots inside one Firestore transaction.
18. Late policy exceptions enter the Live Operations Command review queue without changing the order automatically.
19. An authorized reviewer approves or rejects the exception with mandatory notes.
20. Approved reschedules re-check capacity and move the reservation transactionally.
21. Approved cancellations release capacity and create an optional deterministic refund request.
22. Every exception decision creates one immutable review record.
23. Assigned field workers may share location during active fulfillment states.
24. The customer receives a privacy-scoped ETA and map link only for the assigned active worker.
25. Payment, schedule, vendor, service, policy-review, and refund transitions generate deterministic lifecycle notifications.

## Operational policy model

Companies may configure Marketplace policy values through `marketplacePolicies`, `orderPolicies`, or the existing cancellation-policy object.

Current defaults:

- reschedule notice window: 4 hours
- full-refund window: 24 hours
- partial-refund window: 6 hours
- partial refund: 50%
- booking horizon: 90 days
- late cancellation: operations review
- late reschedule: operations review

The policy decision and policy version are stored with every change request. Exception decisions store the reviewer, role, timestamp, notes, policy snapshot, requested change, refund override, refund amount, and linked Marketplace records.

## Self-audit gates

### Scope

- [x] No Evara Studio files changed
- [x] No visual-builder logic introduced
- [x] Existing Live Operations Command was extended instead of creating a duplicate page
- [x] Existing Executive Queue was not repurposed or duplicated
- [x] Changes remain within Marketplace operations and production readiness

### Policy exception review

- [x] Exception reads are returned by an authenticated callable
- [x] Review roles are explicitly allow-listed
- [x] Non-platform reviewers are company-scoped server-side
- [x] Pending requests are revalidated before a decision
- [x] Every decision requires a meaningful review note
- [x] Review records are deterministic and created only once
- [x] Repeated decisions return the existing result instead of applying a second mutation
- [x] Reschedule approval re-checks the booking horizon and capacity
- [x] Reschedule approval decrements the old slot and increments the new slot transactionally
- [x] Cancellation approval releases held or confirmed capacity
- [x] Refund overrides are clamped between 0% and 100%
- [x] Refund amounts cannot exceed the captured amount
- [x] Rejecting a request preserves the active order and clears pending reschedule fields
- [x] Decision notifications continue through the existing lifecycle notification trigger

### Data integrity

- [x] Quote acceptance remains idempotent
- [x] Invoice, subscription, order, appointment, slot, change-request, notification, refund, and exception-review IDs are deterministic
- [x] Money remains represented in integer cents
- [x] Existing linked order IDs are reused instead of creating parallel orders
- [x] Schedule changes preserve the previous appointment timestamp
- [x] Reschedule counts and decision records are retained
- [x] Cancellation decisions preserve the policy snapshot and reason
- [x] Refund records link the order, quote, invoice, customer, company, provider payment reference, and exception review

### Security boundaries

- [x] Financial, order-change, and exception-review mutations are server-authoritative
- [x] Callable Marketplace actions require Firebase Authentication and App Check
- [x] Customer ownership is verified before every customer order mutation
- [x] Operations refund execution uses an explicit role allow-list
- [x] Non-platform actors remain company-scoped where company ownership applies
- [x] Customer tracking reads use server-side document lookup instead of broad browser collection access
- [x] Firestore `jobs` reads are customer, assignment, platform, or company-manager scoped
- [x] Firestore `workforce_locations` reads are owner, platform, or company-operations scoped
- [x] Firestore `subscriptions` reads use tenant ownership rules
- [x] `marketplace_change_requests`, `marketplace_exception_reviews`, `refund_requests`, `appointment_slots`, and `appointment_reservations` have no direct client match and fall through to deny-by-default
- [x] Stripe and OpenAI secrets remain in Firebase Secret Manager
- [ ] Staff-side quote approval should eventually move fully behind trusted server orchestration

### Verification

- [x] Marketplace policy tests passed locally: 7 passed, 0 failed
- [x] Marketplace production validation workflow covers server syntax
- [x] Marketplace production validation workflow covers browser-module syntax
- [x] Marketplace production validation workflow runs the Marketplace policy tests
- [x] Marketplace production validation workflow validates Firebase JSON and required wiring
- [x] Gated production workflow validates dependencies before deployment
- [x] Gated production workflow checks `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `OPENAI_API_KEY` before Functions deployment
- [x] Gated production workflow requires the exact confirmation phrase `DEPLOY EVARAOS PRODUCTION`
- [x] Gated production workflow supports Hosting, Functions, Firestore, backend, or complete releases
- [x] Deploy runners install Functions dependencies before Firebase analyzes the source
- [x] Duplicate auto-deploy workflows were removed
- [ ] Observe a passing GitHub Actions validation run
- [ ] Firebase Functions emulator test pending
- [ ] Browser and mobile smoke tests pending
- [ ] Stripe test-mode Checkout and refund tests pending
- [ ] Signed Stripe webhook test pending
- [ ] Appointment collision, exception approval, cancellation, and expiration tests pending
- [ ] End-to-end request → quote → payment → vendor → tracking → completion test pending

## Production release architecture

Normal pushes to `evaraos` no longer deploy Firebase Hosting automatically.

Production releases use:

- `.github/workflows/marketplace-production-validation.yml` for automatic Marketplace validation
- `.github/workflows/firebase-production-release.yml` for an explicit manual Firebase production release

The release workflow:

1. requires an exact authorization phrase
2. validates syntax, tests, JSON, secrets, and page/function wiring
3. uses the existing `FIREBASE_SERVICE_ACCOUNT_EVARAOS_WEB` GitHub secret
4. verifies required Firebase Functions secrets before Functions deployment
5. deploys only the selected release scope
6. prevents overlapping production releases

## Remaining production activation

- [ ] Confirm `FIREBASE_SERVICE_ACCOUNT_EVARAOS_WEB` is valid
- [ ] Set or verify `OPENAI_API_KEY` in Firebase Secret Manager
- [ ] Set the Stripe test-mode `STRIPE_SECRET_KEY`
- [ ] Create the Stripe webhook endpoint and set `STRIPE_WEBHOOK_SECRET`
- [ ] Confirm `APP_BASE_URL` when using a custom production domain
- [ ] Observe a passing Marketplace Production Validation run
- [ ] Run the gated workflow with the appropriate release scope
- [ ] Register and test all required Stripe webhook events
- [ ] Complete test-mode Checkout, subscription, invoice, and refund acceptance tests
- [ ] Complete browser, mobile, and Firebase emulator quality assurance
- [ ] Enable Stripe live mode only after test-mode acceptance passes

## Remaining Marketplace phase

The Marketplace implementation is code-complete for the current scope. The final 1% is production activation, external-secret configuration, test-mode payment validation, and quality assurance.
