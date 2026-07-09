# EvaraOS Marketplace Production Deployment Runbook

Last updated: 2026-07-09

## Purpose

This runbook activates the current Marketplace implementation safely in Firebase and Stripe. It covers validation, secrets, deployment, Stripe test mode, webhook registration, acceptance testing, live-mode cutover, and rollback.

Do not paste production secrets into GitHub source, issues, pull requests, documents, screenshots, logs, or chat. Enter secret values only through Firebase Secret Manager or another approved secret-management interface.

## Release architecture

Production releases are intentionally manual.

- Automatic Marketplace validation: `.github/workflows/marketplace-production-validation.yml`
- Manual production release: `.github/workflows/firebase-production-release.yml`
- Firebase project: `evaraos-web`
- Hosting target: `production`
- Functions region: `us-central1`
- Functions source: `functions`
- Functions entry point: `functions/index-stats.js`

The release workflow validates one exact branch, tag, or commit SHA and deploys that same resolved SHA. This prevents the deploy job from silently using a newer branch head and allows rollback by supplying a previous known-good commit SHA.

## Required access

The operator needs:

- GitHub Actions access for `Evaraos/evaraos`
- permission to run the `Evaraos Firebase Production Release` workflow
- access to the GitHub `production` environment when environment approval is enabled
- Firebase project access for `evaraos-web`
- Stripe account access for test-mode keys and Workbench webhook configuration

## Required GitHub secret

Confirm this Actions secret exists and contains a valid Firebase service-account JSON document:

- `FIREBASE_SERVICE_ACCOUNT_EVARAOS_WEB`

The release workflow validates that the value exists and parses as JSON before any deployment command runs.

## Required Firebase Functions secrets

Functions deployment is blocked until all three secrets exist:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

### Set the Stripe test-mode key

From a trusted terminal authenticated to Firebase:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY --project evaraos-web
```

Enter the Stripe **test-mode secret key** when prompted.

### Set the OpenAI key

```bash
firebase functions:secrets:set OPENAI_API_KEY --project evaraos-web
```

Enter the active project API key when prompted.

### Set the Stripe webhook secret

This value is available after the Stripe webhook endpoint is created. Set it with:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project evaraos-web
```

### Verify secret availability without exposing values

```bash
firebase functions:secrets:get STRIPE_SECRET_KEY --project evaraos-web
firebase functions:secrets:get STRIPE_WEBHOOK_SECRET --project evaraos-web
firebase functions:secrets:get OPENAI_API_KEY --project evaraos-web
```

Never copy the output of `functions:secrets:access` into a ticket, document, or chat.

## APP_BASE_URL

`APP_BASE_URL` is a Firebase string parameter, not a secret. The current default is:

```text
https://evaraos-web.web.app
```

No change is needed while that is the production application origin. When a custom production domain becomes authoritative, update the parameter during Functions deployment so Stripe success and cancellation redirects return to the correct origin.

## Phase 1 — Validate the release candidate

1. Open GitHub Actions.
2. Select **Marketplace Production Validation**.
3. Run the workflow against the intended release branch or commit.
4. Confirm all validation steps pass:
   - Functions dependency installation
   - Marketplace server syntax
   - Marketplace browser-module syntax
   - Marketplace policy tests
   - Firebase JSON parsing
   - required function and page wiring
5. Record the exact commit SHA that passed.

Do not proceed when validation is absent, cancelled, or failing.

## Phase 2 — Deploy a backend bootstrap when the webhook URL is not available

A new Stripe webhook needs a publicly accessible Functions URL. When `stripeMarketplaceWebhook` has never been deployed, use this bootstrap sequence:

1. Create a temporary random value for `STRIPE_WEBHOOK_SECRET` in Firebase Secret Manager.
2. Run **Evaraos Firebase Production Release** with:
   - `release_scope`: `backend`
   - `release_ref`: the validated commit SHA
   - `confirmation`: `DEPLOY EVARAOS PRODUCTION`
3. Wait for Functions, Firestore rules, and indexes to deploy successfully.
4. Copy the deployed HTTPS URL shown for `stripeMarketplaceWebhook` from the deployment output or Firebase console.
5. Create the Stripe test-mode webhook endpoint using that exact URL.
6. Reveal the endpoint signing secret in Stripe.
7. Replace the temporary Firebase secret:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project evaraos-web
```

8. Run the production workflow again with `release_scope: functions` so the webhook function picks up the real endpoint secret.

The temporary secret must never be used to accept real webhook traffic. Webhook tests begin only after the real endpoint secret is deployed.

## Phase 3 — Register the Stripe test-mode webhook

In Stripe Workbench:

1. Ensure the account is in test mode or the selected sandbox.
2. Open **Webhooks**.
3. Create an event destination.
4. Choose **Your account** unless a later Stripe Connect architecture requires connected-account events.
5. Choose **Webhook endpoint**.
6. Enter the exact deployed `stripeMarketplaceWebhook` HTTPS URL.
7. Subscribe only to the events used by the integration:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
8. Save the endpoint.
9. Reveal and store the endpoint signing secret in Firebase Secret Manager as `STRIPE_WEBHOOK_SECRET`.
10. Redeploy Functions.

The test-mode endpoint secret and live-mode endpoint secret are different. Do not reuse one mode's signing secret in the other mode.

## Phase 4 — Complete the coordinated release

After the real test-mode webhook secret is deployed, run **Evaraos Firebase Production Release** with:

- `release_scope`: `all`
- `release_ref`: the exact validated commit SHA
- `confirmation`: `DEPLOY EVARAOS PRODUCTION`

The workflow validates and deploys:

- Cloud Functions
- Firestore rules
- Firestore indexes
- Firebase Hosting target `production`

## Acceptance test accounts

Prepare isolated test accounts before testing:

- platform owner or super admin
- company operations manager
- dispatcher or field manager
- vendor staff member
- assigned technician or cleaner
- customer

Use a test company, test services, test properties, and test payment records. Do not use real customers or real production payment methods during test-mode acceptance.

## Acceptance test matrix

### A. Customer ordering

- Search and filter services.
- Add quantities and add-ons.
- Confirm services from different providers cannot be mixed.
- Select a saved property.
- Enter a new property.
- Confirm an out-of-area provider cannot receive the order.
- Choose a date and provider time slot.
- Submit the order request.
- Confirm the customer sees the new request.

### B. Quote and Checkout

- Create a customer-visible quote with line items in integer cents.
- Confirm only the owning customer can retrieve it.
- Accept it as a one-time service.
- Confirm a Stripe Checkout session opens.
- Cancel Checkout and restart it.
- Complete Checkout with a Stripe test payment method.
- Confirm the webhook marks the quote and invoice paid.
- Confirm the appointment reservation becomes confirmed.
- Confirm the order enters vendor review.

### C. Subscription

- Accept a recurring-eligible quote as a subscription.
- Complete test-mode Checkout.
- Confirm the local subscription stores the Stripe subscription reference.
- Pause the subscription.
- Resume the subscription.
- Schedule cancellation at period end.
- Send or simulate subscription update and deletion events.
- Confirm local status reconciliation.

### D. Vendor handoff

- Sign in as company operations or authorized vendor staff.
- Confirm only same-company Marketplace orders are visible.
- Accept an order.
- Confirm the order enters fulfillment.
- Reject another order with a reason.
- Confirm it returns to dispatch review with reassignment required.

### E. Rescheduling and capacity

- Submit a reschedule outside the notice window.
- Confirm the old slot decrements and the new slot increments.
- Confirm same-slot requests do not increase capacity twice.
- Attempt to use a full slot and confirm rejection.
- Submit a late reschedule.
- Approve it in Live Operations Command with review notes.
- Confirm the immutable review record exists.
- Reject another late request and confirm the active schedule remains unchanged.

### F. Cancellation and refund

- Cancel before the full-refund cutoff.
- Confirm a 100% refund request is created.
- Cancel inside the partial-refund window.
- Confirm the configured partial percentage.
- Submit a late cancellation.
- Approve it with a controlled refund override.
- Confirm the refund cannot exceed the captured payment.
- Process the refund as an authorized operations user.
- Confirm the refund request, order, invoice, and customer notification reconcile.
- Confirm unauthorized and cross-company users cannot process refunds.

### G. Tracking and privacy

- Assign a staff member to an active order.
- Start live location sharing.
- Set the order to an active tracking state.
- Confirm the owning customer sees rounded coordinates, distance, and ETA.
- Confirm another customer cannot access the order or worker location.
- Stop tracking and confirm the customer sees an offline state.
- Confirm stale location data is excluded.

### H. Notifications

Confirm deterministic notifications for:

- order created
- payment succeeded
- payment failed
- schedule changed
- vendor accepted
- vendor rejected
- service started
- service completed
- cancellation review
- reschedule review
- refund pending
- refund succeeded
- refund failed

Repeat selected writes and verify duplicate notifications are not created.

### I. App Check and authorization

- Call each Marketplace callable while signed out and confirm denial.
- Call with an invalid or missing App Check token and confirm denial when enforcement is active.
- Confirm customer A cannot read or mutate customer B's records.
- Confirm company A cannot review company B's exceptions.
- Confirm staff roles cannot perform owner-only/platform actions.

### J. Browser and mobile quality

Test current Chrome, Safari, and a mobile viewport:

- customer dashboard
- customer commerce
- Live Operations Command
- Jobs vendor handoff
- Dispatch Map
- Schedule

Confirm loading, empty, error, busy, success, and denied-access states.

## Go/no-go gate

Production live-mode payment activation is a **go** only when all are true:

- Marketplace Production Validation passes.
- The exact deployed SHA is recorded.
- Firebase Functions, rules, indexes, and Hosting deploy successfully.
- Stripe test Checkout succeeds.
- Stripe webhook deliveries show successful HTTP responses.
- Invoice, subscription, appointment, order, refund, and notification records reconcile.
- Cross-customer and cross-company authorization tests fail closed.
- Browser and mobile smoke tests pass.
- Operations confirms the policy defaults and company overrides.
- A rollback SHA is recorded before enabling live mode.

Any failed financial, security, capacity, webhook, or ownership test is a **no-go**.

## Live-mode cutover

After test-mode acceptance:

1. Create the live-mode Stripe webhook endpoint using the same deployed HTTPS function URL.
2. Select the same required event types.
3. Replace `STRIPE_SECRET_KEY` with the live secret key.
4. Replace `STRIPE_WEBHOOK_SECRET` with the live endpoint signing secret.
5. Redeploy Functions using the gated workflow and the accepted commit SHA.
6. Perform one controlled low-value live transaction.
7. Confirm Checkout, webhook, invoice, order, and notification reconciliation.
8. Confirm the charge appears correctly in Stripe before opening the Marketplace broadly.

## Rollback

### Application and Functions rollback

1. Identify the previous known-good commit SHA.
2. Run **Evaraos Firebase Production Release**.
3. Set `release_ref` to that exact SHA.
4. Select the smallest necessary release scope.
5. Enter `DEPLOY EVARAOS PRODUCTION`.
6. Confirm the workflow validates and deploys that exact SHA.

### Stripe containment

When payment behavior is unsafe:

- disable or deactivate the affected Stripe webhook endpoint
- stop new Checkout entry points through the application release rollback
- do not delete Firebase secrets while deployed functions still reference them
- retain webhook event and refund records for investigation

### Firestore rules rollback

Deploy the previous known-good commit with `release_scope: firestore`. Remember that CLI-deployed rules replace the current deployed rules, so rollback must use a reviewed repository version.

## Post-release monitoring

For the first release window, monitor:

- Firebase Functions errors and latency
- Stripe webhook delivery failures and retries
- Checkout session creation failures
- duplicate or missing invoices
- appointment-slot capacity drift
- refund requests in failed or pending-payment-reference states
- Marketplace exceptions remaining pending unusually long
- customer authorization errors
- vendor reassignment volume

## Release record

Record for every production release:

- release date and time
- operator
- exact commit SHA
- release scope
- Firebase workflow run
- Stripe mode
- webhook endpoint identifier
- validation result
- acceptance-test result
- rollback SHA
- known limitations
- final go/no-go decision
