import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase.js';
import { calculateSplit } from './split-engine.js';

const list = document.getElementById('revenueList');
const totalEl = document.getElementById('revenueTotal');
const countEl = document.getElementById('revenueCount');

const money = (n) => '$' + Number(n || 0).toFixed(2);
const clean = (v) => String(v || '').replace(/[<>]/g, '');

function splitForRecord(record, amount) {
  if (record.platformAmount || record.companyAmount || record.vendorAmount || record.operatorAmount) {
    return {
      splitModel: record.splitModel || 'platform_vendor',
      splitLabel: record.splitLabel || '',
      platformAmount: Number(record.platformAmount || 0),
      companyAmount: Number(record.companyAmount || record.vendorAmount || 0),
      vendorAmount: Number(record.vendorAmount || record.companyAmount || 0),
      operatorAmount: Number(record.operatorAmount || 0)
    };
  }

  return calculateSplit(amount, {
    splitModel: record.splitModel || record.companyType || 'platform_vendor',
    platformPercent: record.platformPercent,
    vendorPercent: record.vendorPercent,
    operatorPercent: record.operatorPercent
  });
}

async function loadRevenue() {
  const snap = await getDocs(collection(db, 'jobs'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const billable = rows.filter((r) => Number(r.totalAmount || r.subtotal || r.amount || 0) > 0);
  const total = billable.reduce((sum, r) => sum + Number(r.totalAmount || r.subtotal || r.amount || 0), 0);

  totalEl.textContent = money(total);
  countEl.textContent = String(billable.length);

  if (!billable.length) {
    list.innerHTML = '<div class="item muted">No revenue records yet. Add totals to jobs to activate this view.</div>';
    return;
  }

  list.innerHTML = billable.map((r) => {
    const amount = Number(r.totalAmount || r.subtotal || r.amount || 0);
    const split = splitForRecord(r, amount);
    const splitLabel = split.splitLabel || split.splitModel || 'platform_vendor';

    return '<article class="item"><h3>' + clean(r.customerName || r.title || 'Revenue Record') + '</h3><p class="muted">' + clean(r.service || r.serviceType || 'Service') + '</p><p class="muted">Model: ' + clean(splitLabel) + '</p><p class="muted">Total: ' + money(amount) + '</p><p class="muted">Platform: ' + money(split.platformAmount) + '</p><p class="muted">Vendor/Company: ' + money(split.vendorAmount || split.companyAmount) + '</p>' + (split.operatorAmount ? '<p class="muted">Operator: ' + money(split.operatorAmount) + '</p>' : '') + '</article>';
  }).join('');
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }
    try {
      await loadRevenue();
    } catch (error) {
      console.error('Revenue load failed:', error);
      list.innerHTML = '<div class="item muted">Revenue load failed.</div>';
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
