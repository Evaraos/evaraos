import { auth, db, onAuthStateChanged } from './firebase.js';
import { listenLimitedCollection, scheduleRender, safeText } from './firestore-lite.js';
import { renderListBatch } from './ui-virtualizer.js';

const revenueEl = document.getElementById('analyticsRevenue');
const jobsEl = document.getElementById('analyticsJobs');
const invoicesEl = document.getElementById('analyticsInvoices');
const paidEl = document.getElementById('analyticsPaid');
const payoutsEl = document.getElementById('analyticsPayouts');
const list = document.getElementById('analyticsList');

let jobs = [];
let invoices = [];
let transactions = [];
let payouts = [];
let staff = [];
let applications = [];
let realtimeStarted = false;

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function pct(n) {
  return Number(n || 0).toFixed(0) + '%';
}

function status(row) {
  return String(row.paymentStatus || row.invoiceStatus || row.status || '').toLowerCase();
}

function amount(row) {
  return Number(row.totalAmount || row.subtotal || row.amount || row.total || row.balance || 0);
}

function metricCard(metric) {
  return '<article class="item"><h3>' + safeText(metric.title) + '</h3><div class="row"><span class="pill">' + safeText(metric.value) + '</span></div><p class="muted">' + safeText(metric.note) + '</p></article>';
}

function buildMetrics() {
  const trackedRevenue = transactions.reduce((sum, row) => sum + amount(row), 0);
  const billableJobRevenue = jobs.reduce((sum, row) => sum + amount(row), 0);
  const paidInvoices = invoices.filter((row) => status(row) === 'paid');
  const unpaidInvoices = invoices.filter((row) => !['paid', 'cancelled', 'refunded'].includes(status(row)));
  const queuedPayouts = payouts.filter((row) => status(row) === 'queued');
  const completedJobs = jobs.filter((row) => String(row.status || '').toLowerCase() === 'completed');
  const activeJobs = jobs.filter((row) => ['claimed', 'scheduled', 'in_progress'].includes(String(row.status || '').toLowerCase()));
  const pendingApplications = applications.filter((row) => ['submitted', 'needs_more_info'].includes(String(row.status || '').toLowerCase()));

  const queuedPayoutTotal = queuedPayouts.reduce((sum, row) => sum + amount(row), 0);
  const unpaidInvoiceTotal = unpaidInvoices.reduce((sum, row) => sum + amount(row), 0);
  const paidRate = invoices.length ? (paidInvoices.length / invoices.length) * 100 : 0;
  const completionRate = jobs.length ? (completedJobs.length / jobs.length) * 100 : 0;
  const avgJobValue = jobs.length ? billableJobRevenue / jobs.length : 0;

  revenueEl.textContent = money(trackedRevenue || billableJobRevenue);
  jobsEl.textContent = String(jobs.length);
  invoicesEl.textContent = String(invoices.length);
  paidEl.textContent = String(paidInvoices.length);
  payoutsEl.textContent = String(queuedPayouts.length);

  return [
    { title: 'Revenue tracked', value: money(trackedRevenue), note: 'Live revenue confirmed through transaction records.' },
    { title: 'Billable job volume', value: money(billableJobRevenue), note: 'Live total value detected across priced jobs.' },
    { title: 'Unpaid invoice balance', value: money(unpaidInvoiceTotal), note: 'Live balance still pending from open invoices.' },
    { title: 'Queued payout total', value: money(queuedPayoutTotal), note: 'Live company/vendor payout queue currently waiting.' },
    { title: 'Paid invoice rate', value: pct(paidRate), note: paidInvoices.length + ' paid out of ' + invoices.length + ' invoices.' },
    { title: 'Job completion rate', value: pct(completionRate), note: completedJobs.length + ' completed jobs and ' + activeJobs.length + ' active jobs.' },
    { title: 'Average job value', value: money(avgJobValue), note: 'Live average revenue value across all jobs with totals.' },
    { title: 'Workforce size', value: String(staff.length), note: 'Approved staff profile records currently tracked.' },
    { title: 'Pending HR applications', value: String(pendingApplications.length), note: 'Applications waiting for HR review or follow-up.' }
  ];
}

const renderAnalytics = scheduleRender(() => {
  renderListBatch(list, buildMetrics(), metricCard, { batchSize: 5, maxItems: 20 });
});

function startRealtimeAnalytics() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  if (list) list.innerHTML = '<div class="item muted">Starting live analytics...</div>';

  listenLimitedCollection(db, 'jobs', (rows) => { jobs = rows; renderAnalytics(); }, { limit: 150 });
  listenLimitedCollection(db, 'invoices', (rows) => { invoices = rows; renderAnalytics(); }, { limit: 150 });
  listenLimitedCollection(db, 'transactions', (rows) => { transactions = rows; renderAnalytics(); }, { limit: 150 });
  listenLimitedCollection(db, 'payouts', (rows) => { payouts = rows; renderAnalytics(); }, { limit: 150 });
  listenLimitedCollection(db, 'staff_profiles', (rows) => { staff = rows; renderAnalytics(); }, { limit: 150 });
  listenLimitedCollection(db, 'staff_applications', (rows) => { applications = rows; renderAnalytics(); }, { limit: 150 });
}

function init() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    startRealtimeAnalytics();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
