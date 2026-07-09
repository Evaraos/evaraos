# EvaraOS Marketplace Progress

Last updated: 2026-07-08

## Overall progress

`[█████████▌] 96%`

The Marketplace workstream owns services, quotes, ordering, scheduling, maps, tracking, payments, subscriptions, invoices, customers, vendors, order changes, refunds, and fulfillment lifecycle communications. Evara Studio is out of scope.

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
- [ ] Add the internal policy-exception review interface
- [ ] Tighten remaining broad Firestore read rules for jobs, workforce locations, and subscriptions
- [ ] Configure Stripe, deploy, and complete production acceptance testing

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
18. Late policy exceptions are preserved as review requests instead of mutating the order automatically.
19. Approved cancellations release appointment capacity and calculate refund eligibility from the company policy.
20. Eligible refunds become deterministic refund requests ready for Stripe execution.
21. Assigned field workers may share location during active fulfillment states.
22. The customer receives a privacy-scoped ETA and map link only for the assigned active worker.
23. Payment, schedule, vendor, service, policy-review, and refund transitions generate deterministic lifecycle notifications.

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

The policy decision and policy version are stored with each change request so later configuration changes do not silently rewrite the original decision history.

## Self-audit gates

### Scope

- [x] No Evara Studio files changed
- [x] No visual-builder logic introduced
- [x] Changes remain within Marketplace production behavior

### Customer ordering and self-service

- [x] Marketplace ordering is mounted inside the existing customer portal
- [x] Customers can review and act only on their own quotes, invoices, subscriptions, and orders
- [x] Customers can view active orders, schedules, payment state, provider state, refunds, and lifecycle updates
- [x] Customers can request a future appointment change
- [x] Customers receive a refund estimate before confirming cancellation
- [x] Customers can see when a request requires policy review
- [x] Customer operational reads are sanitized and server-scoped

### Data integrity

- [x] Quote acceptance remains idempotent
- [x] Invoice, subscription, order, appointment, slot, change-request, notification, and refund IDs are deterministic
- [x] Money remains represented in integer cents
- [x] Existing linked order IDs are reused instead of creating parallel orders
- [x] Schedule changes preserve the previous appointment timestamp
- [x] Reschedule counts and decision records are retained
- [x] Cancellation decisions preserve the policy snapshot and reason
- [x] Refund records link the order, quote, invoice, customer, company, and provider payment reference

### Scheduling and capacity

- [x] Provider hours, lead time, booking horizon, duration, and blackout dates remain supported
- [x] Final capacity is validated inside Firestore transactions
- [x] Safe rescheduling decrements the old slot and increments the new slot transactionally
- [x] Same-slot reschedule requests do not double-count capacity
- [x] Cancellation releases held or confirmed capacity only after policy approval
- [x] Late requests do not release capacity until reviewed
- [x] Checkout expiration and payment failure release capacity

### Cancellations and refunds

- [x] Cancellation eligibility is calculated server-side
- [x] Full and partial refund tiers are supported
- [x] No-payment cancellations do not create unnecessary refund records
- [x] Late cancellations may be routed to manual review
- [x] Refund requests are deterministic and idempotent
- [x] Refund execution is restricted to approved operations roles
- [x] Refund execution uses Stripe idempotency keys
- [x] Refund success updates the refund request, order, invoice, and customer notification
- [ ] Stripe-backed refund execution requires the production Stripe secret and deployment

### Tracking and privacy

- [x] Customer tracking data is returned by an authenticated server callable
- [x] Only the authenticated customer's orders are evaluated
- [x] Only workers assigned to the customer's order are considered
- [x] Tracking appears only during active fulfillment states
- [x] Offline or stale workforce locations are excluded
- [x] Location coordinates are rounded before returning to the customer
- [x] Distance uses the order destination and assigned-worker location
- [x] ETA uses reported movement speed when available and a conservative fallback otherwise
- [x] Customer access does not expose the company-wide workforce-location collection

### Lifecycle notifications

- [x] Notification IDs are deterministic to prevent duplicate alerts
- [x] Customers receive payment confirmation and payment-failure updates
- [x] Customers receive schedule and vendor-assignment updates
- [x] Customers receive service-started, completed, cancelled, and refunded updates
- [x] Company operations receive new-order, payment, reassignment, exception-review, and refund alerts
- [x] Assigned staff receive appointment and execution-state updates
- [x] Change-request decisions generate customer notifications
- [x] Refund-request transitions generate customer and operations notifications

### Security boundaries

- [x] Financial and order-change mutations are server-authoritative
- [x] Callable Marketplace actions require Firebase Authentication and App Check
- [x] Customer ownership is verified before every customer order mutation
- [x] Operations refund execution uses an explicit role allow-list
- [x] Non-platform actors remain company-scoped where company ownership applies
- [x] Customer tracking reads use server-side document lookup instead of broad browser collection access
- [x] Stripe secrets remain in Firebase Secret Manager
- [ ] Firestore `jobs` reads must be company-scoped by server rules
- [ ] Firestore `workforce_locations` reads must be company-scoped by server rules
- [ ] Firestore `subscriptions` reads must be restricted to the customer or company
- [ ] Server-only change-request and refund collections should be explicitly documented in Firestore rules
- [ ] Staff-side quote approval should move fully behind trusted server orchestration

### Verification

- [x] Marketplace operations core passed `node --check`
- [x] Reschedule and cancellation functions passed `node --check`
- [x] Refund executor passed `node --check`
- [x] Customer operations snapshot passed `node --check`
- [x] Lifecycle notification triggers passed `node --check`
- [x] Customer operations browser module passed `node --check`
- [x] New functions are exported by the active Functions entry point
- [x] Customer portal contains all required order, notification, refund, and status roots
- [x] Transaction reads were reviewed to occur before transaction writes
- [x] No Studio file was changed
- [ ] Firebase Functions emulator test pending
- [ ] Browser smoke test pending
- [ ] Stripe test-mode Checkout and refund tests pending
- [ ] Signed Stripe webhook test pending
- [ ] Appointment collision, reschedule, cancellation, and expiration tests pending
- [ ] End-to-end request → quote → payment → vendor → tracking → completion test pending
- [ ] No CI checks are currently attached to these commits

## Deployment checklist

The implementation is committed but is not production-active until deployment is completed.

Stripe requirements may remain pending until the Stripe account is available:

- [ ] Set `STRIPE_SECRET_KEY`
- [ ] Set `STRIPE_WEBHOOK_SECRET`
- [ ] Set `APP_BASE_URL` when production uses a different hostname
- [ ] Deploy the updated Firebase Functions entry point
- [ ] Register `stripeMarketplaceWebhook` in Stripe
- [ ] Subscribe the Stripe endpoint to Checkout, PaymentIntent, Invoice, and Subscription events
- [ ] Deploy Firebase Hosting
- [ ] Run Checkout, refund, webhook, and subscription tests in Stripe test mode
- [ ] Enable live-mode payments only after acceptance testing passes

The operational policy, cancellation, tracking, notification, and refund-queue layers do not require Stripe credentials to remain committed and ready. Actual payment capture and refund execution do require the Stripe configuration.

## Remaining Marketplace phase

- internal operations interface for approving or rejecting late reschedule and cancellation requests
- production Firebase deployment and Stripe connection
- test-mode acceptance suite
- Firestore security-rule hardening handoff
- final browser and mobile quality assurance
