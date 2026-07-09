# EvaraOS Marketplace Progress

Last updated: 2026-07-08

## Overall progress

`[█████████░] 90%`

The Marketplace workstream owns services, quotes, ordering, scheduling, maps, tracking, payments, subscriptions, invoices, customers, and vendors. Evara Studio is out of scope.

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
- [ ] Add rescheduling, customer cancellation, and refund policy workflows
- [ ] Add customer live order tracking and ETA presentation
- [ ] Add marketplace notifications across every lifecycle transition
- [ ] Tighten remaining broad Firestore read rules for jobs, workforce locations, and subscriptions
- [ ] Complete production deployment and end-to-end acceptance testing

## Current transaction lifecycle

1. Active services are loaded from the production service collections.
2. A customer builds a single-provider cart with quantities and add-ons.
3. The customer selects a saved or manual service property.
4. Eligible companies are matched using configured state and city service areas.
5. Appointment choices are generated using provider hours, service duration, lead time, booking horizon, blackout dates, and configured slot availability.
6. The customer submits a structured Marketplace order request into the existing secure customer-lead workflow.
7. The request records line items, estimated cents, property, provider, requested schedule, recurring-service interest, and capacity-validation status.
8. A company prepares a customer-visible quote.
9. The customer reviews every line item, chooses one-time or recurring billing when eligible, and accepts or rejects the quote.
10. The trusted Cloud Function transaction verifies customer ownership, quote status, expiration, totals, provider capacity, and appointment availability.
11. Deterministic invoice, optional subscription, order, and reservation records are created or reconciled idempotently.
12. The appointment slot is held transactionally while Stripe Checkout is open.
13. Stripe Checkout collects payment without exposing Stripe secrets to the browser.
14. Signature-verified, idempotent webhooks reconcile the quote, invoice, subscription, appointment reservation, Stripe session, and order.
15. Successful payment confirms the appointment and moves the order into vendor review.
16. The assigned vendor accepts the order or rejects it back into dispatch review.
17. Scheduled orders appear automatically in the realtime schedule and dispatch surfaces.
18. Assigned field workers may share live location while the Dispatch Map is open.

## Self-audit gates

Every Marketplace change must pass these checks before being marked complete.

### Scope

- [x] No Evara Studio files changed
- [x] No visual-builder logic introduced
- [x] Changes remain within Marketplace production behavior

### Customer ordering and commerce

- [x] Marketplace ordering is mounted inside the existing customer portal
- [x] Existing service and company records are normalized without requiring one rigid schema
- [x] Inactive, paused, archived, and deleted services are excluded
- [x] Cart items from different assigned providers cannot be mixed
- [x] A provider outside its configured service area cannot receive the order
- [x] Customer requests preserve the existing secure customer-lead create contract
- [x] Recent customer Marketplace requests use a customer-scoped realtime query
- [x] Customer commerce data is returned by a customer-scoped callable instead of trusting browser filters
- [x] Contact phone is sourced from the authenticated customer profile
- [x] Quotes display line items, provider, appointment, expiration, totals, and payment state
- [x] Customers can accept or reject only their own quotes
- [x] Customers can restart invoice checkout when a valid checkout link is unavailable

### Data integrity

- [x] Customer quote acceptance is idempotent
- [x] Invoice, subscription, order, appointment reservation, and slot IDs are deterministic
- [x] Quote ID remains attached throughout the financial and fulfillment lifecycle
- [x] Customer and company ownership fields are preserved
- [x] Money remains represented in integer cents
- [x] Existing paid order and invoice records are not reset by reconciliation
- [x] Schedule fields support milliseconds, ISO strings, Dates, and Firestore timestamps
- [x] Customer request line items preserve service IDs, quantities, add-ons, fees, duration, and estimate totals
- [x] Customer order requests include explicit quote, order, scheduling, payment, and capacity states
- [x] Stripe session metadata links quote, invoice, subscription, reservation, order, customer, and company IDs

### Scheduling and capacity

- [x] Provider business hours are supported
- [x] Booking lead time is enforced in generated choices
- [x] Booking horizon is enforced in generated choices
- [x] Service duration prevents choices that extend beyond closing time
- [x] Provider blackout dates are supported
- [x] Configured per-slot availability can hide full slots
- [x] Final slot capacity is validated inside a Firestore transaction
- [x] Appointment holds are released after checkout expiration
- [x] Reserved slot counts are decremented when payment fails or the hold expires
- [x] Expired deterministic reservations can be safely reserved again
- [x] Stale checkout URLs are cleared instead of being reused

### Payments, invoices, and subscriptions

- [x] Stripe secret keys are read only from Cloud Functions secrets
- [x] Checkout sessions are created only by authenticated callable functions
- [x] Customer ownership is verified before quote acceptance, invoice checkout, or subscription management
- [x] Stripe webhook signatures are verified before any state mutation
- [x] Stripe webhook event IDs prevent duplicate reconciliation
- [x] Successful checkout updates all linked Marketplace records
- [x] Payment failure releases appointment capacity and marks financial records past due or failed
- [x] Subscription status follows Stripe creation, update, deletion, invoice-paid, and invoice-failed events
- [x] Customers can pause, resume, or schedule cancellation of active Stripe subscriptions
- [x] Checkout expiration is stored and validated before reusing a payment link

### Vendor fulfillment

- [x] Vendor responses are processed through an authenticated callable function
- [x] Vendor roles are explicitly allow-listed
- [x] Non-platform vendor users can respond only to orders belonging to their company
- [x] Accepted orders enter the vendor fulfillment workflow
- [x] Rejected orders return to dispatch review with a rejection reason and reassignment flag
- [x] Vendor controls are added without replacing the existing company and staff claim workflow

### Realtime lifecycle

- [x] Firestore listeners are unsubscribed during page lifecycle cleanup
- [x] GPS watches are stopped during page lifecycle cleanup
- [x] Location writes are throttled
- [x] Stopped tracking is represented as offline
- [x] Realtime schedule changes render without a page reload
- [x] Recent Marketplace requests update without a page reload
- [x] Vendor handoff controls follow company-scoped order updates
- [x] Customer financial status refreshes periodically and when the page regains focus

### Security boundaries

- [x] Customer Marketplace submission uses the existing customer-safe `leads` contract
- [x] Financial mutations are server-authoritative and not performed by direct browser writes
- [x] Customer financial reads are sanitized and customer-scoped server-side
- [x] Callable commerce actions require Firebase Authentication and App Check
- [x] Client queries are company-scoped where a company ID exists
- [x] Platform-wide client access is limited to platform roles
- [x] Location writes use the authenticated user's document ID
- [x] Unsafe provider routing is blocked when no eligible provider serves the address
- [ ] Firestore `jobs` reads must be company-scoped by server rules
- [ ] Firestore `workforce_locations` reads must be company-scoped by server rules
- [ ] Firestore `subscriptions` reads must be restricted to the customer or company
- [ ] Firestore rules should explicitly document the server-only `quotes`, appointment, and Stripe collections
- [ ] Staff-side quote creation and approval should move fully behind an authoritative callable workflow

### Verification

- [x] Customer commerce dashboard JavaScript passed `node --check`
- [x] Marketplace commerce Cloud Function runtime passed `node --check`
- [x] Imports and referenced functions were manually reviewed
- [x] Existing job, schedule, dispatch, proximity-dispatch, company, service, customer-lead, invoice, subscription, and Stripe field compatibility reviewed
- [x] Route guard session-ready behavior was verified for Marketplace initialization
- [x] Firestore transaction reads occur before transaction writes in the active commerce runtime
- [x] The superseded commerce implementation was removed from the repository
- [ ] Firebase Functions emulator test pending
- [ ] Browser smoke test pending
- [ ] Stripe test-mode Checkout test pending
- [ ] Signed Stripe webhook test pending
- [ ] Appointment collision and expiration test pending
- [ ] End-to-end customer order → quote → payment → vendor acceptance test pending
- [ ] No CI checks are currently attached to these commits

## Deployment checklist

The implementation is committed but is not production-active until the following deployment steps are completed:

- [ ] Set the Firebase Functions secret `STRIPE_SECRET_KEY`
- [ ] Set the Firebase Functions secret `STRIPE_WEBHOOK_SECRET`
- [ ] Set `APP_BASE_URL` when production uses a hostname other than `https://evaraos-web.web.app`
- [ ] Deploy the updated Firebase Functions entry point
- [ ] Register the deployed `stripeMarketplaceWebhook` HTTPS endpoint in Stripe
- [ ] Subscribe the Stripe endpoint to Checkout, PaymentIntent, Invoice, and Subscription lifecycle events
- [ ] Deploy Firebase Hosting so the actionable customer commerce and vendor handoff scripts are live
- [ ] Run the test-mode end-to-end checklist before enabling live-mode payments

Recommended Stripe webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Current known dependencies

Production completion requires coordinated Backend and Security ownership for:

- deploying and configuring the new Cloud Functions
- storing Stripe secrets in Firebase Secret Manager
- configuring and testing the Stripe webhook endpoint
- tightening broad Firestore reads for jobs, workforce locations, and subscriptions
- moving staff-side quote approval fully behind trusted server orchestration
- validating App Check behavior in production and emulator environments

## Next Marketplace phase

Complete operational hardening and the final customer experience:

- rescheduling and cancellation policy engine
- refund and partial-refund orchestration
- customer live ETA and map tracking
- lifecycle notifications for customer, vendor, dispatch, and staff
- production test-mode acceptance suite
- security-rule hardening handoff
