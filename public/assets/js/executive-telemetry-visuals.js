const visualListeners = new Map();
let listenerCounter = 0;
let latestVisualModel = null;

function nextListenerId() {
  listenerCounter += 1;
  return `executive_visual_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function percent(value = 0) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function money(centsValue = 0) {
  return '$' + (Number(centsValue || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function publish(model = latestVisualModel) {
  visualListeners.forEach((listener) => {
    try {
      listener(model);
    } catch (error) {
      console.error('Executive telemetry visual listener failure:', error);
    }
  });
}

function ratio(numerator = 0, denominator = 0) {
  const bottom = Number(denominator || 0);
  if (!bottom) return 0;
  return percent((Number(numerator || 0) / bottom) * 100);
}

function buildMetricCard(title, value, detail, options = {}) {
  return {
    id: options.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    title,
    value,
    detail,
    status: options.status || 'stable',
    progress: percent(options.progress || 0),
    tone: options.tone || 'neutral',
    metadata: options.metadata || {}
  };
}

export function buildExecutiveTelemetryVisualModel(input = {}) {
  const snapshot = input.revenueSnapshot || input.snapshot || {};
  const kpis = snapshot.kpis || {};
  const risk = snapshot.risk || {};
  const syncHealth = input.syncHealth || {};
  const validation = input.validation || {};
  const stripeEvents = input.stripeEvents || [];

  const billed = cents(kpis.billedRevenueCents);
  const collected = cents(kpis.collectedRevenueCents);
  const outstanding = cents(kpis.outstandingRevenueCents);
  const platform = cents(kpis.platformRevenueCents);
  const vendor = cents(kpis.vendorPayoutCents);
  const mrr = cents(kpis.monthlyRecurringCents);
  const arr = mrr * 12;
  const grossMarketplace = cents(kpis.grossMarketplaceCents);

  const failedStripeEvents = stripeEvents.filter((event) => String(event.type || '').includes('failed')).length;
  const processedStripeEvents = stripeEvents.filter((event) => event.processed).length;

  latestVisualModel = {
    id: `executive_visual_${Date.now()}`,
    generatedAtMs: Date.now(),
    health: {
      syncStatus: syncHealth.status || 'healthy',
      validationStatus: validation.status || 'pending',
      riskLevel: risk.level || 'stable',
      riskScore: Number(risk.score || 0),
      failingAdapters: Number(syncHealth.failingAdapterCount || 0),
      invalidRecords: Number(validation.invalidCount || 0),
      failedStripeEvents
    },
    cards: [
      buildMetricCard('MRR', money(mrr), 'Monthly recurring revenue', {
        id: 'mrr',
        progress: ratio(mrr, Math.max(mrr, outstanding, 1)),
        tone: 'growth'
      }),
      buildMetricCard('ARR', money(arr), 'Annualized recurring revenue', {
        id: 'arr',
        progress: ratio(arr, Math.max(arr, billed * 12, 1)),
        tone: 'growth'
      }),
      buildMetricCard('Collected', money(collected), `${ratio(collected, billed)}% of billed revenue collected`, {
        id: 'collected',
        progress: ratio(collected, billed),
        tone: 'success'
      }),
      buildMetricCard('Outstanding', money(outstanding), `${ratio(outstanding, billed)}% of billed revenue still open`, {
        id: 'outstanding',
        progress: ratio(outstanding, billed),
        tone: outstanding ? 'warning' : 'success'
      }),
      buildMetricCard('Platform Revenue', money(platform), `${ratio(platform, grossMarketplace)}% platform share`, {
        id: 'platform_revenue',
        progress: ratio(platform, grossMarketplace),
        tone: 'growth'
      }),
      buildMetricCard('Vendor Payouts', money(vendor), `${ratio(vendor, grossMarketplace)}% vendor payout allocation`, {
        id: 'vendor_payouts',
        progress: ratio(vendor, grossMarketplace),
        tone: 'neutral'
      }),
      buildMetricCard('Risk', label(risk.level || 'stable'), `Risk score ${Number(risk.score || 0)}`, {
        id: 'risk',
        progress: Number(risk.score || 0),
        tone: Number(risk.score || 0) > 70 ? 'danger' : Number(risk.score || 0) > 40 ? 'warning' : 'success'
      }),
      buildMetricCard('Sync Health', label(syncHealth.status || 'healthy'), `${Number(syncHealth.failingAdapterCount || 0)} failing adapters`, {
        id: 'sync_health',
        progress: syncHealth.status === 'healthy' ? 100 : syncHealth.status === 'degraded' ? 55 : 20,
        tone: syncHealth.status === 'healthy' ? 'success' : 'warning'
      }),
      buildMetricCard('Validation', label(validation.status || 'pending'), `${Number(validation.invalidCount || 0)} invalid records`, {
        id: 'validation',
        progress: validation.status === 'passed' ? 100 : validation.status === 'warning' ? 70 : validation.status === 'failed' ? 20 : 50,
        tone: validation.status === 'failed' ? 'danger' : validation.status === 'warning' ? 'warning' : 'success'
      }),
      buildMetricCard('Stripe Events', String(stripeEvents.length), `${processedStripeEvents} processed • ${failedStripeEvents} failed`, {
        id: 'stripe_events',
        progress: ratio(processedStripeEvents, stripeEvents.length),
        tone: failedStripeEvents ? 'warning' : 'success'
      })
    ],
    bars: [
      { id: 'collection_rate', label: 'Collection Rate', value: ratio(collected, billed), detail: `${money(collected)} / ${money(billed)}` },
      { id: 'outstanding_rate', label: 'Outstanding Exposure', value: ratio(outstanding, billed), detail: `${money(outstanding)} outstanding` },
      { id: 'platform_share', label: 'Platform Share', value: ratio(platform, grossMarketplace), detail: `${money(platform)} platform revenue` },
      { id: 'vendor_share', label: 'Vendor Share', value: ratio(vendor, grossMarketplace), detail: `${money(vendor)} vendor payouts` },
      { id: 'sync_integrity', label: 'Sync Integrity', value: syncHealth.status === 'healthy' ? 100 : syncHealth.status === 'degraded' ? 55 : 20, detail: label(syncHealth.status || 'healthy') },
      { id: 'validation_integrity', label: 'Validation Integrity', value: validation.status === 'passed' ? 100 : validation.status === 'warning' ? 70 : validation.status === 'failed' ? 20 : 50, detail: label(validation.status || 'pending') }
    ],
    recommendations: [
      ...(Number(validation.invalidCount || 0) ? ['Resolve validation failures before production release.'] : []),
      ...(Number(syncHealth.failingAdapterCount || 0) ? ['Review failing Firestore adapters before release.'] : []),
      ...(failedStripeEvents ? ['Reconcile failed Stripe webhook events.'] : []),
      ...(outstanding > collected ? ['Review outstanding invoice exposure and collection workflows.'] : [])
    ]
  };

  publish(latestVisualModel);
  return latestVisualModel;
}

export function renderExecutiveTelemetryCards(root, model = latestVisualModel) {
  if (!root) return;
  const cards = model?.cards || [];

  root.innerHTML = cards.map((card) => {
    return '<article class="item executive-telemetry-card"><h3>' + card.title + '</h3><p class="muted">' + card.detail + '</p><strong>' + card.value + '</strong><div class="progress-rail"><span style="width:' + card.progress + '%"></span></div><div class="row"><span class="pill">' + label(card.tone) + '</span><span class="pill">' + card.progress + '%</span></div></article>';
  }).join('') || '<div class="item muted">No telemetry cards available yet.</div>';
}

export function renderExecutiveTelemetryBars(root, model = latestVisualModel) {
  if (!root) return;
  const bars = model?.bars || [];

  root.innerHTML = bars.map((bar) => {
    return '<article class="item"><h3>' + bar.label + '</h3><p class="muted">' + bar.detail + '</p><div class="progress-rail"><span style="width:' + bar.value + '%"></span></div><div class="row"><span class="pill">' + bar.value + '%</span></div></article>';
  }).join('') || '<div class="item muted">No telemetry bars available yet.</div>';
}

export function getLatestExecutiveTelemetryVisualModel() {
  return latestVisualModel;
}

export function subscribeExecutiveTelemetryVisuals(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeExecutiveTelemetryVisuals requires a callback.');
  const id = nextListenerId();
  visualListeners.set(id, callback);
  callback(latestVisualModel);
  return id;
}

export function unsubscribeExecutiveTelemetryVisuals(listenerId) {
  return visualListeners.delete(listenerId);
}

window.EvaraExecutiveTelemetryVisuals = {
  buildExecutiveTelemetryVisualModel,
  renderExecutiveTelemetryCards,
  renderExecutiveTelemetryBars,
  getLatestExecutiveTelemetryVisualModel,
  subscribeExecutiveTelemetryVisuals,
  unsubscribeExecutiveTelemetryVisuals
};
