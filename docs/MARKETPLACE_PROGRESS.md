# EvaraOS Marketplace Progress

Last updated: 2026-07-08

## Overall progress

`[█████░░░░░] 50%`

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
- [ ] Add customer-facing service discovery and cart lifecycle
- [ ] Add customer quote acceptance and scheduling controls
- [ ] Add availability and time-slot capacity validation
- [ ] Add rescheduling, cancellation, and refund policy states
- [ ] Connect order payment state to Stripe checkout state
- [ ] Add subscription activation, pause, resume, and cancellation
- [ ] Add invoice generation and payment reconciliation
- [ ] Add vendor acceptance, rejection, and fulfillment workflow
- [ ] Add customer live order tracking and ETA presentation
- [ ] Add marketplace notifications across lifecycle transitions
- [ ] Complete end-to-end production acceptance testing

## Current transaction lifecycle

1. A service is configured in the service catalog.
2. A quote is created with one or more service line items.
3. An approved quote is converted into a deterministic Marketplace order stored as a job.
4. Scheduled orders appear automatically in the realtime schedule.
5. Jobs with coordinates appear in Dispatch Map and proximity dispatch.
6. Assigned field workers may share live location while the Dispatch Map is open.

## Self-audit gates

Every Marketplace change must pass these checks before being marked complete.

### Scope

- [x] No Evara Studio files changed
- [x] No visual-builder logic introduced
- [x] Changes remain within Marketplace production behavior

### Data integrity

- [x] Order conversion is idempotent
- [x] Quote ID remains attached to the resulting order
- [x] Customer and company ownership fields are preserved
- [x] Money remains represented in integer cents
- [x] Existing active order status is not reset during reconciliation
- [x] Schedule fields support milliseconds, ISO strings, Dates, and Firestore timestamps

### Realtime lifecycle

- [x] Firestore listeners are unsubscribed during page lifecycle cleanup
- [x] GPS watches are stopped during page lifecycle cleanup
- [x] Location writes are throttled
- [x] Stopped tracking is represented as offline
- [x] Realtime schedule changes render without a page reload

### Security boundaries

- [x] Client queries are company-scoped where a company ID exists
- [x] Platform-wide client access is limited to platform roles
- [x] Location writes use the authenticated user's document ID
- [ ] Firestore `jobs` reads must be company-scoped by server rules
- [ ] Firestore `workforce_locations` reads must be company-scoped by server rules
- [ ] Firestore rules must explicitly support the `quotes` collection
- [ ] Backend must validate quote-to-order conversion authoritatively

### Verification

- [x] Imports and referenced functions were manually reviewed
- [x] Existing job, schedule, dispatch, and proximity-dispatch field compatibility reviewed
- [ ] Automated JavaScript syntax check unavailable in the connector environment
- [ ] Browser smoke test pending
- [ ] Firestore emulator/rules test pending
- [ ] End-to-end quote approval test pending

## Current known dependencies

The app-side Marketplace flow is now connected, but production security and authoritative transaction integrity require Backend and Security ownership for:

- company-scoped Firestore rules for `jobs` and `workforce_locations`
- explicit Firestore rules for `quotes`
- server-side validation or Cloud Function orchestration for quote approval and order creation
- Stripe payment and webhook reconciliation

## Next Marketplace phase

Build customer-facing order creation and scheduling:

- service selection
- quantity and add-ons
- address and property selection
- quote acceptance
- date/time selection
- order confirmation
- live lifecycle status
