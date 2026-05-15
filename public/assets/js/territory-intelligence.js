import { auth, db, onAuthStateChanged } from './firebase.js';
import { listenLimitedCollection, scheduleRender, safeText } from './firestore-lite.js';
import { renderListBatch } from './ui-virtualizer.js';

const territoryOpportunityEl = document.getElementById('territoryOpportunity');
const territoryLabelEl = document.getElementById('territoryLabel');
const territoryZonesEl = document.getElementById('territoryZones');
const territoryJobsEl = document.getElementById('territoryJobs');
const territoryStaffEl = document.getElementById('territoryStaff');
const territoryRevenueEl = document.getElementById('territoryRevenue');
const territoryListEl = document.getElementById('territoryList');
const territoryActionsEl = document.getElementById('territoryActions');

let jobs = [];
let workforce = [];
let invoices = [];
let realtimeStarted = false;

function currency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0));
}

function zoneKey(item) {
  return item.city || item.region || item.state || 'Unknown Territory';
}

function territoryData() {
  const zones = {};

  jobs.forEach((job) => {
    const key = zoneKey(job);
    zones[key] ||= { jobs: 0, workforce: 0, revenue: 0 };
    zones[key].jobs += 1;
  });

  workforce.forEach((staff) => {
    const key = zoneKey(staff);
    zones[key] ||= { jobs: 0, workforce: 0, revenue: 0 };
    zones[key].workforce += 1;
  });

  invoices.forEach((invoice) => {
    const key = zoneKey(invoice);
    zones[key] ||= { jobs: 0, workforce: 0, revenue: 0 };
    const status = String(invoice.status || '').toLowerCase();
    if (['paid', 'complete', 'completed'].includes(status)) {
      zones[key].revenue += Number(invoice.total || invoice.balance || 0);
    }
  });

  return Object.entries(zones).map(([name, metrics]) => {
    const coverage = metrics.jobs ? Math.max(0, Math.min(100, Math.round((metrics.workforce / metrics.jobs) * 100))) : 100;
    const opportunity = Math.max(0, Math.min(100, Math.round(((metrics.jobs * 12) + (metrics.revenue / 1000)) - coverage)));
    return { name, ...metrics, coverage, opportunity };
  }).sort((a, b) => b.opportunity - a.opportunity);
}

function enterpriseOpportunity(zones) {
  if (!zones.length) return 0;
  return Math.round(zones.reduce((sum, zone) => sum + zone.opportunity, 0) / zones.length);
}

function opportunityLabel(score) {
  if (score >= 85) return 'Aggressive Expansion';
  if (score >= 65) return 'High Opportunity';
  if (score >= 45) return 'Moderate Opportunity';
  return 'Stable Coverage';
}

function recommendations(zones) {
  const items = [];

  zones.forEach((zone) => {
    if (zone.coverage < 50 && zone.jobs >= 5) items.push('Increase workforce coverage in ' + zone.name + '.');
    if (zone.opportunity > 80) items.push(zone.name + ' shows strong expansion potential.');
    if (zone.revenue > 25000) items.push(zone.name + ' should be considered a strategic growth territory.');
  });

  if (!items.length) items.push('Territory coverage currently balanced across regions.');
  return [...new Set(items)];
}

function territoryCard(zone) {
  return '<article class="item"><h3>' +
    safeText(zone.name) +
    '</h3><p class="muted">Regional operational intelligence and growth forecasting.</p><div class="row"><span class="pill">Coverage ' +
    zone.coverage +
    '</span><span class="pill">Opportunity ' +
    zone.opportunity +
    '</span><span class="pill">Revenue ' +
    currency(zone.revenue) +
    '</span><span class="pill">Jobs ' +
    zone.jobs +
    '</span><span class="pill">Workforce ' +
    zone.workforce +
    '</span></div></article>';
}

function actionCard(item) {
  return '<article class="item"><p class="muted">' + safeText(item) + '</p></article>';
}

const render = scheduleRender(() => {
  const zones = territoryData();
  const opportunity = enterpriseOpportunity(zones);
  const revenue = invoices.reduce((sum, invoice) => {
    const status = String(invoice.status || '').toLowerCase();
    return ['paid', 'complete', 'completed'].includes(status) ? sum + Number(invoice.total || invoice.balance || 0) : sum;
  }, 0);

  territoryOpportunityEl.textContent = String(opportunity);
  territoryLabelEl.textContent = opportunityLabel(opportunity);
  territoryZonesEl.textContent = String(zones.length);
  territoryJobsEl.textContent = String(jobs.length);
  territoryStaffEl.textContent = String(workforce.length);
  territoryRevenueEl.textContent = currency(revenue);

  renderListBatch(territoryListEl, zones, territoryCard, {
    batchSize: 10,
    maxItems: 100,
    emptyHTML: '<div class="item muted">No territories detected.</div>'
  });

  renderListBatch(territoryActionsEl, recommendations(zones), actionCard, {
    batchSize: 8,
    maxItems: 40,
    emptyHTML: '<div class="item muted">No territory recommendations.</div>'
  });
});

function initRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  listenLimitedCollection(db, 'jobs', (rows) => { jobs = rows; render(); }, { limit: 150 });
  listenLimitedCollection(db, 'workforce_locations', (rows) => { workforce = rows; render(); }, { limit: 150 });
  listenLimitedCollection(db, 'invoices', (rows) => { invoices = rows; render(); }, { limit: 150 });
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
