# EvaraOS Marketplace Progress

Last updated: 2026-07-08

## Overall progress

`[███████░░░] 75%`

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
- [ ] Add customer quote acceptance controls
- [ ] Add authoritative server-side time-slot capacity validation
- [ ] Add rescheduling, cancellation, and refund policy states
- [ ] Connect order payment state to Stripe checkout state
- [ ] Add subscription activation, pause, resume, and cancellation
- [ ] Add invoice generation and payment reconciliation
- [ ] Add vendor acceptance, rejection, and fulfillment workflow
- [ ] Add customer live order tracking and ETA presentation
- [ ] Add marketplace notifications across lifecycle transitions
- [ ] Complete end-to-end production acceptance testing

## Current transaction lifecycle

1. Active services are loaded from the production service collections.
2. A customer builds a single-provider cart with quantities and add-ons.
3. The customer selects a saved or manual service property.
4. Eligible companies are matched using configured state and city service areas.
5. Appointment choices are generated using provider hours, service duration, lead time, booking horizon, blackout dates, and configured slot availability.
6. The customer submits a structured Marketplace order request into the existing secure customer-lead workflow.
7. The request records line items, estimated cents, property, provider, requested schedule, recurring-service interest, and capacity-validation status.
8. A company creates or approves the quote.
9. An approved quote is converted into a deterministic Marketplace order stored as a job.
10. Scheduled orders appear automatically in the realtime schedule.
11. Jobs with coordinates appear in Dispatch Map and proximity dispatch.
12. Assigned field workers may share live location while the Dispatch Map is open.

## Self-audit gates

Every Marketplace change must pass these checks before being marked complete.

### Scope

- [x] No Evara Studio files changed
- [x] No visual-builder logic introduced
- [x] Changes remain within Marketplace production behavior

### Customer ordering

- [x] Marketplace ordering is mounted inside the existing customer portal
- [x] Existing service and company records are normalized without requiring one rigid schema
- [x] Inactive, paused, archived, and deleted services are excluded
- [x] Cart items from different assigned providers cannot be mixed
- [x] A provider outside its configured service area cannot receive the order
- [x] Customer requests preserve the existing secure customer-lead create contract
- [x] Recent customer Marketplace requests use a customer-scoped realtime query
- [x] Contact phone is sourced from the authenticated customer profile

### Data integrity

- [x] Order conversion is idempotent
- [x] Quote ID remains attached to the resulting order
- [x] Customer and company ownership fields are preserved
- [x] Money remains represented in integer cents
- [x] Existing active order status is not reset during reconciliation
- [x] Schedule fields support milliseconds, ISO strings, Dates, and Firestore timestamps
- [x] Customer request line items preserve service IDs, quantities, add-ons, fees, duration, and estimate totals
- [x] Customer order requests include explicit quote, order, scheduling, payment, and capacity states

### Scheduling

- [x] Provider business hours are supported
- [x] Booking lead time is enforced in generated choices
- [x] Booking horizon is enforced in generated choices
- [x] Service duration prevents choices that extend beyond closing time
- [x] Provider blackout dates are supported
- [x] Configured per-slot availability can hide full slots
- [x] Unverified capacity is labeled `pending_backend_validation`
- [ ] Authoritative capacity reservation must be completed server-side

### Realtime lifecycle

- [x] Firestore listeners are unsubscribed during page lifecycle cleanup
- [x] GPS watches are stopped during page lifecycle cleanup
- [x] Location writes are throttled
- [x] Stopped tracking is represented as offline
- [x] Realtime schedule changes render without a page reload
- [x] Recent Marketplace requests update without a page reload

### Security boundaries

- [x] Customer Marketplace submission uses the existing customer-safe `leads` contract
- [x] Client queries are company-scoped where a company ID exists
- [x] Platform-wide client access is limited to platform roles
- [x] Location writes use the authenticated user's document ID
- [x] Unsafe provider routing is blocked when no eligible provider serves the address
- [ ] Firestore `jobs` reads must be company-scoped by server rules
- [ ] Firestore `workforce_locations` reads must be company-scoped by server rules
- [ ] Firestore rules must explicitly support the `quotes` collection
- [ ] Backend must validate quote-to-order conversion authoritatively
- [ ] Backend must reserve and release appointment capacity transactionally

### Verification

- [x] Imports and referenced functions were manually reviewed
- [x] Existing job, schedule, dispatch, proximity-dispatch, company, service, and customer-lead field compatibility reviewed
- [x] Route guard session-ready behavior was verified for Marketplace initialization
- [ ] Automated JavaScript syntax check unavailable because the execution container cannot resolve GitHub hosts
- [ ] Browser smoke test pending
- [ ] Firestore emulator/rules test pending
- [ ] End-to-end customer order-request test pending
- [ ] End-to-end quote approval test pending

## Current known dependencies

The customer-facing Marketplace flow is now active, but production security and authoritative transaction integrity require Backend and Security ownership for:

- company-scoped Firestore rules for `jobs` and `workforce_locations`
- explicit Firestore rules for `quotes`
- customer-safe quote acceptance rules or a callable backend action
- server-side validation or Cloud Function orchestration for quote approval and order creation
- transactional appointment-capacity reservation
- Stripe payment and webhook reconciliation

## Next Marketplace phase

Build quote acceptance and financial activation:

- customer quote review and acceptance
- confirmed appointment reservation
- Stripe checkout/session creation
- payment-state reconciliation
- subscription choice and activation
- invoice creation
- vendor acceptance and fulfillment handoff
