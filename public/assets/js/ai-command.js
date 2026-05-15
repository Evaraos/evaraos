import { auth, db, onAuthStateChanged } from './firebase.js';
import { listenLimitedCollection, scheduleRender, safeText } from './firestore-lite.js';
import { renderListBatch } from './ui-virtualizer.js';

const revenueEl = document.getElementById('aiRevenue');
const opsRiskEl = document.getElementById('aiOpsRisk');
const dispatchScoreEl = document.getElementById('aiDispatchScore');
const workforceScoreEl = document.getElementById('aiWorkforceScore');
const healthScoreEl = document.getElementById('aiHealthScore');
const healthLabelEl = document.getElementById('aiHealthLabel');
const summaryListEl = document.getElementById('aiSummaryList');
const actionListEl = document.getElementById('aiActionList');

let jobs = [];
let invoices = [];
let workforce = [];
let assignments = [];
let realtimeStarted = false;

function currency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0));
}

function openJobs() {
  return jobs.filter((job) => ['new', 'dispatch_review', 'scheduled'].includes(String(job.status || '').toLowerCase()));
}

function paidRevenue() {
  return invoices.reduce((sum, invoice) => {
    const status = String(invoice.status || '').toLowerCase();
    return ['paid', 'complete', 'completed'].includes(status) ? sum + Number(invoice.total || invoice.balance || 0) : sum;
  }, 0);
}

function unpaidRevenue() {
  return invoices.reduce((sum, invoice) => {
    const status = String(invoice.status || '').toLowerCase();
    return ['unpaid', 'open', 'past_due'].includes(status) ? sum + Number(invoice.total || invoice.balance || 0) : sum;
  }, 0);
}

function workforceEfficiency() {
  const workers = workforce.filter((w) => w.lat && w.lng).length;
  const active = assignments.filter((a) => ['scheduled', 'pending', 'suggested'].includes(String(a.status || '').toLowerCase())).length;
  if (!workers) return 0;
  return Math.min(100, Math.round((active / workers) * 100));
}

function dispatchReadiness() {
  const workload = openJobs().length;
  const workers = workforce.filter((w) => w.lat && w.lng).length;
  if (!workload) return 100;
  return Math.max(0, Math.min(100, Math.round((workers / workload) * 100)));
}

function operationalRisk() {
  let score = 10;
  if (openJobs().length > workforce.length * 2) score += 30;
  if (unpaidRevenue() > 10000) score += 20;
  if (dispatchReadiness() < 50) score += 25;
  if (workforceEfficiency() > 90) score += 10;
  return Math.min(100, score);
}

function companyHealth() {
  const risk = operationalRisk();
  const dispatch = dispatchReadiness();
  const workforceScore = workforceEfficiency();
  return Math.max(0, Math.min(100, Math.round((dispatch * 0.4) + (workforceScore * 0.3) + ((100 - risk) * 0.3))));
}

function healthLabel(score) {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Stable';
  if (score >= 45) return 'Warning';
  return 'Critical';
}

function executiveSummary() {
  return [
    { title: 'Operational Health', detail: 'Current AI company health score is ' + companyHealth() + '.' },
    { title: 'Dispatch Readiness', detail: 'Dispatch readiness currently operating at ' + dispatchReadiness() + ' percent.' },
    { title: 'Revenue Pressure', detail: 'Outstanding balances currently total ' + currency(unpaidRevenue()) + '.' },
    { title: 'Workforce Efficiency', detail: 'Workforce utilization is currently ' + workforceEfficiency() + ' percent.' }
  ];
}

function executiveActions() {
  const items = [];
  if (dispatchReadiness() < 60) items.push('Increase active workforce availability and rebalance assignments.');
  if (unpaidRevenue() > 10000) items.push('Escalate collections and automate overdue invoice recovery.');
  if (workforceEfficiency() > 90) items.push('Current crews may be approaching operational saturation.');
  if (operationalRisk() > 70) items.push('Executive attention required due to elevated operational risk.');
  if (!items.length) items.push('Operational systems are stable at this time.');
  return [...new Set(items)];
}

function summaryCard(item) {
  return '<article class="item"><h3>' + safeText(item.title) + '</h3><p class="muted">' + safeText(item.detail) + '</p></article>';
}

function actionCard(item) {
  return '<article class="item"><p class="muted">' + safeText(item) + '</p></article>';
}

const render = scheduleRender(() => {
  const revenue = paidRevenue();
  const risk = operationalRisk();
  const dispatch = dispatchReadiness();
  const workforceScore = workforceEfficiency();
  const health = companyHealth();

  revenueEl.textContent = currency(revenue);
  opsRiskEl.textContent = String(risk);
  dispatchScoreEl.textContent = dispatch + '%';
  workforceScoreEl.textContent = workforceScore + '%';
  healthScoreEl.textContent = String(health);
  healthLabelEl.textContent = healthLabel(health);

  renderListBatch(summaryListEl, executiveSummary(), summaryCard, { batchSize: 4, maxItems: 12 });
  renderListBatch(actionListEl, executiveActions(), actionCard, { batchSize: 6, maxItems: 24 });
});

function initRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  listenLimitedCollection(db, 'jobs', (rows) => { jobs = rows; render(); }, { limit: 150 });
  listenLimitedCollection(db, 'invoices', (rows) => { invoices = rows; render(); }, { limit: 150 });
  listenLimitedCollection(db, 'workforce_locations', (rows) => { workforce = rows; render(); }, { limit: 150 });
  listenLimitedCollection(db, 'dispatch_assignments', (rows) => { assignments = rows; render(); }, { limit: 150 });
}

function init() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }
    initRealtime();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
