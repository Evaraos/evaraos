import {
  auth,
  functions,
  httpsCallable,
  onAuthStateChanged
} from './firebase.js';

const statusNode = document.getElementById('customerCommerceStatus');
const paidNode = document.getElementById('customerPaid');
const subscriptionsNode = document.getElementById('customerActiveSubscriptions');
const quotesNode = document.getElementById('customerQuoteCount');
const actionsRoot = document.getElementById('customerActionRoot');
const invoicesRoot = document.getElementById('customerInvoiceRoot');
const subscriptionsRoot = document.getElementById('customerSubscriptionRoot');
const quotesRoot = document.getElementById('customerQuoteRoot');

const getSnapshotCall = httpsCallable(functions, 'getMarketplaceCommerceSnapshot');
const acceptQuoteCall = httpsCallable(functions, 'acceptMarketplaceQuote');
const rejectQuoteCall = httpsCallable(functions, 'rejectMarketplaceQuote');
const createInvoiceCheckoutCall = httpsCallable(functions, 'createMarketplaceInvoiceCheckout');
const manageSubscriptionCall = httpsCallable(functions, 'manageMarketplaceSubscription');

const state = {
  snapshot: null,
  busyKey: '',
  refreshTimer: null,
  started: false
};

function clean(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(cents = 0) {
  return '$' + (Number(cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function dateTime(value) {
  const number = Number(value || 0);
  if (!number) return 'Not scheduled';
  const date = new Date(number);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function errorMessage(error, fallback = 'The Marketplace action could not be completed.') {
  return String(error?.message || error?.details || fallback)
    .replace(/^Firebase:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '');
}

function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

function setOutstanding(value) {
  document.querySelectorAll('[id="customerOutstanding"]').forEach((node) => {
    node.textContent = money(value);
  });
}

function setBusy(key = '') {
  state.busyKey = key;
  document.querySelectorAll('[data-commerce-action]').forEach((button) => {
    const active = key && button.dataset.busyKey === key;
    button.disabled = Boolean(key);
    if (active) {
      button.dataset.originalText ||= button.textContent;
      button.textContent = 'Working…';
    } else if (!key && button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  });
}

function quoteCanAct(quote = {}) {
  const status = String(quote.status || '').toLowerCase();
  if (quote.customerAcceptanceStatus === 'accepted' || quote.customerAcceptanceStatus === 'rejected') return false;
  return ['pending', 'sent', 'viewed'].includes(status) || (status === 'draft' && quote.customerVisible);
}

function renderStats(snapshot = {}) {
  const summary = snapshot.summary || {};
  setOutstanding(summary.outstandingCents || 0);
  if (paidNode) paidNode.textContent = money(summary.paidCents || 0);
  if (subscriptionsNode) subscriptionsNode.textContent = String(summary.activeSubscriptions || 0);
  if (quotesNode) quotesNode.textContent = String(summary.quoteCount || 0);
}

function renderActions(snapshot = {}) {
  if (!actionsRoot) return;
  const quotes = snapshot.quotes || [];
  const invoices = snapshot.invoices || [];
  const subscriptions = snapshot.subscriptions || [];
  const rows = [];

  const reviewQuotes = quotes.filter(quoteCanAct);
  const openInvoices = invoices.filter((invoice) => !['paid', 'void', 'uncollectible'].includes(String(invoice.status).toLowerCase()));
  const pastDueSubscriptions = subscriptions.filter((subscription) => subscription.status === 'past_due');

  if (reviewQuotes.length) rows.push({ title: 'Quotes need your decision', detail: `${reviewQuotes.length} quote(s) are ready to review and accept.`, type: 'review quote', priority: 'medium' });
  if (openInvoices.length) rows.push({ title: 'Payment is available', detail: `${openInvoices.length} invoice(s) have an open balance.`, type: 'payment', priority: 'medium' });
  if (pastDueSubscriptions.length) rows.push({ title: 'Subscription payment issue', detail: `${pastDueSubscriptions.length} subscription(s) need payment attention.`, type: 'subscription', priority: 'high' });

  const checkout = new URLSearchParams(window.location.search).get('checkout');
  if (checkout === 'success') rows.unshift({ title: 'Payment submitted', detail: 'Stripe is confirming your payment. This page will refresh automatically.', type: 'payment status', priority: 'low' });
  if (checkout === 'cancelled') rows.unshift({ title: 'Checkout cancelled', detail: 'Nothing new was charged. You can restart checkout from your quote or invoice.', type: 'checkout', priority: 'medium' });

  if (!rows.length) rows.push({ title: 'Account is current', detail: 'No urgent Marketplace actions are needed right now.', type: 'account', priority: 'low' });

  actionsRoot.innerHTML = rows.map((action) => `
    <article class="item">
      <h3>${clean(action.title)}</h3>
      <p class="muted">${clean(action.detail)}</p>
      <div class="row"><span class="pill">${clean(label(action.priority))}</span><span class="pill">${clean(label(action.type))}</span></div>
    </article>
  `).join('');
}

function renderInvoices(snapshot = {}) {
  if (!invoicesRoot) return;
  const rows = snapshot.invoices || [];
  if (!rows.length) {
    invoicesRoot.innerHTML = '<div class="item muted">No invoices yet.</div>';
    return;
  }

  invoicesRoot.innerHTML = rows.slice(0, 10).map((invoice) => {
    const closed = ['paid', 'void', 'uncollectible'].includes(String(invoice.status).toLowerCase());
    const action = closed
      ? `<span class="pill">${invoice.status === 'paid' ? 'Paid' : clean(label(invoice.status))}</span>`
      : invoice.paymentUrl
        ? `<a class="btn btn-theme-primary" href="${clean(invoice.paymentUrl)}">Pay securely</a>`
        : `<button class="btn btn-theme-primary" type="button" data-commerce-action="invoice-checkout" data-invoice-id="${clean(invoice.id)}" data-busy-key="invoice:${clean(invoice.id)}">Create checkout</button>`;
    const itemSummary = (invoice.lineItems || []).slice(0, 3).map((item) => `${clean(item.title || item.serviceName)} × ${clean(item.quantity || 1)}`).join(' · ');

    return `
      <article class="item">
        <h3>${clean(invoice.invoiceNumber || invoice.id)}</h3>
        <p class="muted">${itemSummary || 'Marketplace services'}</p>
        <div class="row">
          <span class="pill">${clean(label(invoice.status))}</span>
          <span class="pill">Due ${clean(money(invoice.balanceDueCents))}</span>
          <span class="pill">${clean(dateTime(invoice.dueAtMs))}</span>
        </div>
        <div class="row" style="margin-top:12px">${action}</div>
      </article>
    `;
  }).join('');
}

function subscriptionActions(subscription = {}) {
  if (!subscription.providerActive) return '<span class="pill">Activation pending payment</span>';
  const buttons = [];
  if (subscription.status === 'active' && !subscription.cancelAtPeriodEnd) {
    buttons.push(`<button class="btn btn-theme-secondary" type="button" data-commerce-action="subscription" data-subscription-action="pause" data-subscription-id="${clean(subscription.id)}" data-busy-key="subscription:${clean(subscription.id)}">Pause</button>`);
  }
  if (subscription.status === 'paused') {
    buttons.push(`<button class="btn btn-theme-primary" type="button" data-commerce-action="subscription" data-subscription-action="resume" data-subscription-id="${clean(subscription.id)}" data-busy-key="subscription:${clean(subscription.id)}">Resume</button>`);
  }
  if (['active', 'paused', 'past_due'].includes(subscription.status) && !subscription.cancelAtPeriodEnd) {
    buttons.push(`<button class="btn btn-theme-secondary" type="button" data-commerce-action="subscription" data-subscription-action="cancel" data-subscription-id="${clean(subscription.id)}" data-busy-key="subscription:${clean(subscription.id)}">Cancel at period end</button>`);
  }
  if (subscription.cancelAtPeriodEnd) buttons.push('<span class="pill">Cancellation scheduled</span>');
  return buttons.join('');
}

function renderSubscriptions(snapshot = {}) {
  if (!subscriptionsRoot) return;
  const rows = snapshot.subscriptions || [];
  if (!rows.length) {
    subscriptionsRoot.innerHTML = '<div class="item muted">No subscriptions yet.</div>';
    return;
  }

  subscriptionsRoot.innerHTML = rows.slice(0, 10).map((subscription) => `
    <article class="item">
      <h3>${clean(subscription.companyName || 'Recurring Marketplace service')}</h3>
      <p class="muted">${clean(label(subscription.status))} · ${clean(label(subscription.interval))}</p>
      <div class="row">
        <span class="pill">${clean(money(subscription.amountCents))}</span>
        <span class="pill">Next: ${clean(dateTime(subscription.nextBillingAtMs || subscription.currentPeriodEndMs))}</span>
      </div>
      <div class="row" style="margin-top:12px">${subscriptionActions(subscription)}</div>
    </article>
  `).join('');
}

function quoteItems(quote = {}) {
  const items = quote.lineItems || [];
  if (!items.length) return '<p class="muted">No line items were provided.</p>';
  return `<div class="dashboard-list">${items.map((item) => `
    <div class="row" style="justify-content:space-between">
      <span>${clean(item.serviceName || item.title)} × ${clean(item.quantity || 1)}</span>
      <strong>${clean(money(item.totalCents || item.amountCents))}</strong>
    </div>
  `).join('')}</div>`;
}

function quoteActions(quote = {}) {
  if (quote.customerAcceptanceStatus === 'accepted') {
    return quote.paymentUrl
      ? `<a class="btn btn-theme-primary" href="${clean(quote.paymentUrl)}">Continue checkout</a>`
      : '<span class="pill">Accepted · Checkout preparing</span>';
  }
  if (quote.customerAcceptanceStatus === 'rejected' || quote.status === 'rejected') return '<span class="pill">Declined</span>';
  if (!quoteCanAct(quote)) return '<span class="pill">No action available</span>';

  const billing = quote.recurringEligible
    ? `<select data-quote-billing="${clean(quote.id)}" aria-label="Billing option for quote ${clean(quote.id)}">
        <option value="one_time">One-time service</option>
        <option value="monthly" ${quote.subscriptionInterval === 'monthly' ? 'selected' : ''}>Monthly subscription</option>
        <option value="biweekly" ${quote.subscriptionInterval === 'biweekly' ? 'selected' : ''}>Every two weeks</option>
        <option value="quarterly" ${quote.subscriptionInterval === 'quarterly' ? 'selected' : ''}>Quarterly subscription</option>
        <option value="yearly" ${quote.subscriptionInterval === 'yearly' ? 'selected' : ''}>Yearly subscription</option>
      </select>`
    : '';

  return `
    ${billing}
    <button class="btn btn-theme-primary" type="button" data-commerce-action="accept-quote" data-quote-id="${clean(quote.id)}" data-busy-key="quote:${clean(quote.id)}">Accept & checkout</button>
    <button class="btn btn-theme-secondary" type="button" data-commerce-action="reject-quote" data-quote-id="${clean(quote.id)}" data-busy-key="quote:${clean(quote.id)}">Decline</button>
  `;
}

function renderQuotes(snapshot = {}) {
  if (!quotesRoot) return;
  const rows = snapshot.quotes || [];
  if (!rows.length) {
    quotesRoot.innerHTML = '<div class="item muted">No quotes yet.</div>';
    return;
  }

  quotesRoot.innerHTML = rows.slice(0, 10).map((quote) => `
    <article class="item">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h3>Quote ${clean(quote.id)}</h3>
          <p class="muted">${clean(quote.companyName || 'Marketplace provider')} · ${clean(label(quote.status))}</p>
        </div>
        <strong>${clean(money(quote.totalCents))}</strong>
      </div>
      ${quoteItems(quote)}
      <div class="row" style="margin-top:10px">
        <span class="pill">Appointment: ${clean(dateTime(quote.requestedScheduleAtMs))}</span>
        ${quote.expiresAtMs ? `<span class="pill">Expires: ${clean(dateTime(quote.expiresAtMs))}</span>` : ''}
        ${quote.paymentStatus ? `<span class="pill">Payment: ${clean(label(quote.paymentStatus))}</span>` : ''}
      </div>
      ${quote.notes ? `<p class="muted" style="margin-top:10px">${clean(quote.notes)}</p>` : ''}
      <div class="row" style="margin-top:12px">${quoteActions(quote)}</div>
    </article>
  `).join('');
}

function render(snapshot = {}) {
  state.snapshot = snapshot;
  renderStats(snapshot);
  renderActions(snapshot);
  renderInvoices(snapshot);
  renderSubscriptions(snapshot);
  renderQuotes(snapshot);
  setBusy('');
  setStatus(`Marketplace commerce synced · ${new Date(snapshot.generatedAtMs || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
}

async function refresh() {
  if (!auth.currentUser) return;
  try {
    const response = await getSnapshotCall({});
    render(response.data || {});
  } catch (error) {
    console.error('Customer commerce refresh failed:', error);
    setStatus(errorMessage(error, 'Customer commerce could not load.'));
  }
}

async function acceptQuote(button) {
  const quoteId = button.dataset.quoteId;
  const billing = document.querySelector(`[data-quote-billing="${CSS.escape(quoteId)}"]`)?.value || 'one_time';
  const subscription = billing !== 'one_time';
  setBusy(`quote:${quoteId}`);
  setStatus('Reserving your appointment and preparing secure checkout…');
  try {
    const response = await acceptQuoteCall({ quoteId, subscription, interval: subscription ? billing : 'monthly' });
    const checkoutUrl = response.data?.checkoutUrl;
    if (!checkoutUrl) throw new Error('Checkout URL was not returned.');
    window.location.assign(checkoutUrl);
  } catch (error) {
    console.error('Quote acceptance failed:', error);
    setStatus(errorMessage(error));
    setBusy('');
    await refresh();
  }
}

async function rejectQuote(button) {
  const quoteId = button.dataset.quoteId;
  if (!window.confirm('Decline this quote?')) return;
  setBusy(`quote:${quoteId}`);
  try {
    await rejectQuoteCall({ quoteId });
    setStatus('Quote declined.');
    await refresh();
  } catch (error) {
    console.error('Quote rejection failed:', error);
    setStatus(errorMessage(error));
    setBusy('');
  }
}

async function createInvoiceCheckout(button) {
  const invoiceId = button.dataset.invoiceId;
  setBusy(`invoice:${invoiceId}`);
  setStatus('Preparing secure invoice checkout…');
  try {
    const response = await createInvoiceCheckoutCall({ invoiceId });
    const checkoutUrl = response.data?.checkoutUrl;
    if (!checkoutUrl) throw new Error('Checkout URL was not returned.');
    window.location.assign(checkoutUrl);
  } catch (error) {
    console.error('Invoice checkout failed:', error);
    setStatus(errorMessage(error));
    setBusy('');
    await refresh();
  }
}

async function manageSubscription(button) {
  const subscriptionId = button.dataset.subscriptionId;
  const action = button.dataset.subscriptionAction;
  if (action === 'cancel' && !window.confirm('Schedule this subscription to cancel at the end of the current billing period?')) return;
  setBusy(`subscription:${subscriptionId}`);
  try {
    await manageSubscriptionCall({ subscriptionId, action });
    setStatus(`Subscription ${action} request completed.`);
    await refresh();
  } catch (error) {
    console.error('Subscription action failed:', error);
    setStatus(errorMessage(error));
    setBusy('');
  }
}

function bindActions() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-commerce-action]');
    if (!button || state.busyKey) return;
    const action = button.dataset.commerceAction;
    if (action === 'accept-quote') acceptQuote(button);
    if (action === 'reject-quote') rejectQuote(button);
    if (action === 'invoice-checkout') createInvoiceCheckout(button);
    if (action === 'subscription') manageSubscription(button);
  });
}

function stop() {
  if (state.refreshTimer) window.clearInterval(state.refreshTimer);
  state.refreshTimer = null;
  state.started = false;
}

function start() {
  if (state.started) return;
  state.started = true;
  bindActions();
  refresh();
  state.refreshTimer = window.setInterval(refresh, 30000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('pagehide', stop);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    stop();
    window.location.assign('/login.html');
    return;
  }
  start();
});
