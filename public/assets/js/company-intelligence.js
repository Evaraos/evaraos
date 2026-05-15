import { auth, db, onAuthStateChanged } from './firebase.js';
import { listenLimitedCollection, scheduleRender, safeText } from './firestore-lite.js';
import { renderListBatch } from './ui-virtualizer.js';

const enterpriseHealthEl = document.getElementById('enterpriseHealth');
const enterpriseLabelEl = document.getElementById('enterpriseLabel');
const companyCountEl = document.getElementById('companyCount');
const enterpriseRevenueEl = document.getElementById('enterpriseRevenue');
const enterpriseJobsEl = document.getElementById('enterpriseJobs');
const enterpriseWorkforceEl = document.getElementById('enterpriseWorkforce');
const companyScoreListEl = document.getElementById('companyScoreList');
const companyActionListEl = document.getElementById('companyActionList');

let companies = [];
let jobs = [];
let invoices = [];
let workforce = [];
let realtimeStarted = false;

function currency(v) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(v || 0));
}

function companyMetrics(companyId) {
  const companyJobs = jobs.filter((job) => job.companyId === companyId);
  const companyInvoices = invoices.filter((invoice) => invoice.companyId === companyId);
  const companyWorkforce = workforce.filter((staff) => staff.companyId === companyId);

  const revenue = companyInvoices.reduce((sum, invoice) => {
    const status = String(invoice.status || '').toLowerCase();
    return ['paid', 'complete', 'completed'].includes(status)
      ? sum + Number(invoice.total || invoice.balance || 0)
      : sum;
  }, 0);

  const openJobs = companyJobs.filter((job) => {
    const status = String(job.status || '').toLowerCase();
    return ['new', 'dispatch_review', 'scheduled'].includes(status);
  }).length;

  const workforceCount = companyWorkforce.length;
  const readiness = openJobs ? Math.max(0, Math.min(100, Math.round((workforceCount / openJobs) * 100))) : 100;
  const risk = Math.min(100, 10 + (openJobs > workforceCount * 2 ? 35 : 0) + (readiness < 50 ? 20 : 0));
  const health = Math.max(0, Math.min(100, Math.round((readiness * 0.55) + ((100 - risk) * 0.45))));

  return { revenue, openJobs, workforceCount, readiness, risk, health };
}

function enterpriseHealth() {
  if (!companies.length) return 0;

  const total = companies.reduce((sum, company) => sum + companyMetrics(company.id).health, 0);
  return Math.round(total / companies.length);
}

function healthLabel(score) {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Stable';
  if (score >= 45) return 'Warning';
  return 'Critical';
}

function enterpriseRecommendations() {
  const actions = [];

  companies.forEach((company) => {
    const metrics = companyMetrics(company.id);
    const name = company.name || 'Company';

    if (metrics.risk > 70) actions.push(name + ' requires executive operational review.');
    if (metrics.readiness < 60) actions.push(name + ' should increase workforce coverage.');
    if (metrics.health > 90) actions.push(name + ' may serve as a benchmark operation model.');
  });

  if (!actions.length) actions.push('Enterprise operations currently stable across subsidiaries.');
  return [...new Set(actions)];
}

function companyCard(company) {
  const metrics = companyMetrics(company.id);

  return '<article class="item"><h3>' +
    safeText(company.name || 'Company') +
    '</h3><p class="muted">Enterprise operational benchmark and subsidiary health intelligence.</p><div class="row"><span class="pill">Health ' +
    metrics.health +
    '</span><span class="pill">Risk ' +
    metrics.risk +
    '</span><span class="pill">Revenue ' +
    currency(metrics.revenue) +
    '</span><span class="pill">Jobs ' +
    metrics.openJobs +
    '</span><span class="pill">Workforce ' +
    metrics.workforceCount +
    '</span></div></article>';
}

function actionCard(item) {
  return '<article class="item"><p class="muted">' + safeText(item) + '</p></article>';
}

const render = scheduleRender(() => {
  const totalRevenue = invoices.reduce((sum, invoice) => {
    const status = String(invoice.status || '').toLowerCase();
    return ['paid', 'complete', 'completed'].includes(status)
      ? sum + Number(invoice.total || invoice.balance || 0)
      : sum;
  }, 0);

  const health = enterpriseHealth();

  companyCountEl.textContent = String(companies.length);
  enterpriseRevenueEl.textContent = currency(totalRevenue);
  enterpriseJobsEl.textContent = String(jobs.length);
  enterpriseWorkforceEl.textContent = String(workforce.length);
  enterpriseHealthEl.textContent = String(health);
  enterpriseLabelEl.textContent = healthLabel(health);

  renderListBatch(companyScoreListEl, companies, companyCard, {
    batchSize: 10,
    maxItems: 100,
    emptyHTML: '<div class="item muted">No companies found.</div>'
  });

  renderListBatch(companyActionListEl, enterpriseRecommendations(), actionCard, {
    batchSize: 8,
    maxItems: 40,
    emptyHTML: '<div class="item muted">No recommendations found.</div>'
  });
});

function initRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  listenLimitedCollection(db, 'companies', (rows) => {
    companies = rows;
    render();
  }, { limit: 100 });

  listenLimitedCollection(db, 'jobs', (rows) => {
    jobs = rows;
    render();
  }, { limit: 150 });

  listenLimitedCollection(db, 'invoices', (rows) => {
    invoices = rows;
    render();
  }, { limit: 150 });

  listenLimitedCollection(db, 'workforce_locations', (rows) => {
    workforce = rows;
    render();
  }, { limit: 150 });
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
