const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HOUR_MS,
  policy,
  refundDecision
} = require('./marketplace-operations-core');

function paidOrder(hoursUntilService, paidCents = 10000) {
  return {
    scheduledAtMs: Date.now() + hoursUntilService * HOUR_MS,
    paymentStatus: 'paid',
    paidCents,
    totalCents: paidCents
  };
}

test('policy returns safe Marketplace defaults', () => {
  const rules = policy({});
  assert.equal(rules.minimumRescheduleNoticeHours, 4);
  assert.equal(rules.fullRefundNoticeHours, 24);
  assert.equal(rules.partialRefundNoticeHours, 6);
  assert.equal(rules.partialRefundPercent, 50);
  assert.equal(rules.bookingHorizonDays, 90);
  assert.equal(rules.defaultSlotCapacity, 1);
  assert.equal(rules.lateCancellationRequiresReview, true);
  assert.equal(rules.lateRescheduleRequiresReview, true);
});

test('policy honors company overrides and clamps refund percentage', () => {
  const rules = policy({
    marketplacePolicies: {
      minimumRescheduleNoticeHours: 12,
      fullRefundNoticeHours: 48,
      partialRefundNoticeHours: 10,
      partialRefundPercent: 125,
      bookingHorizonDays: 120,
      defaultSlotCapacity: 3,
      lateCancellationRequiresReview: false,
      lateRescheduleRequiresReview: false,
      policyVersion: 'company-v2'
    }
  });

  assert.equal(rules.minimumRescheduleNoticeHours, 12);
  assert.equal(rules.fullRefundNoticeHours, 48);
  assert.equal(rules.partialRefundNoticeHours, 10);
  assert.equal(rules.partialRefundPercent, 100);
  assert.equal(rules.bookingHorizonDays, 120);
  assert.equal(rules.defaultSlotCapacity, 3);
  assert.equal(rules.lateCancellationRequiresReview, false);
  assert.equal(rules.lateRescheduleRequiresReview, false);
  assert.equal(rules.policyVersion, 'company-v2');
});

test('refundDecision returns no refund when no payment was captured', () => {
  const result = refundDecision(
    { scheduledAtMs: Date.now() + 72 * HOUR_MS, paymentStatus: 'unpaid', totalCents: 10000 },
    {},
    policy({})
  );

  assert.equal(result.disposition, 'not_required');
  assert.equal(result.refundAmountCents, 0);
  assert.equal(result.refundPercent, 0);
});

test('refundDecision grants a full refund outside the full-refund window', () => {
  const order = paidOrder(48, 12500);
  const result = refundDecision(order, { paymentStatus: 'paid', paidCents: 12500 }, policy({}));

  assert.equal(result.disposition, 'eligible');
  assert.equal(result.refundPercent, 100);
  assert.equal(result.refundAmountCents, 12500);
});

test('refundDecision grants the configured partial refund tier', () => {
  const order = paidOrder(12, 10000);
  const result = refundDecision(order, { paymentStatus: 'paid', paidCents: 10000 }, policy({}));

  assert.equal(result.disposition, 'eligible');
  assert.equal(result.refundPercent, 50);
  assert.equal(result.refundAmountCents, 5000);
});

test('refundDecision routes late paid cancellations to manual review', () => {
  const order = paidOrder(2, 10000);
  const result = refundDecision(order, { paymentStatus: 'paid', paidCents: 10000 }, policy({}));

  assert.equal(result.disposition, 'manual_review');
  assert.equal(result.refundPercent, 0);
  assert.equal(result.refundAmountCents, 0);
});

test('refundDecision can enforce no automatic refund when late review is disabled', () => {
  const rules = policy({
    marketplacePolicies: {
      lateCancellationRequiresReview: false
    }
  });
  const result = refundDecision(
    paidOrder(2, 10000),
    { paymentStatus: 'paid', paidCents: 10000 },
    rules
  );

  assert.equal(result.disposition, 'not_eligible');
  assert.equal(result.refundAmountCents, 0);
});
