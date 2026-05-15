import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase.js';

const list = document.getElementById('revenueList');
const totalEl = document.getElementById('revenueTotal');
const countEl = document.getElementById('revenueCount');

const money = (n) => '$' + Number(n || 0).toFixed(2);
const clean = (v) => String(v || '').replace(/[<>]/g, '');

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
    const platform = amount * 0.3;
    const company = amount * 0.7;
    return '<article class="item"><h3>' + clean(r.customerName || r.title || 'Revenue Record') + '</h3><p class="muted">' + clean(r.service || r.serviceType || 'Service') + '</p><p class="muted">Total: ' + money(amount) + '</p><p class="muted">Platform: ' + money(platform) + '</p><p class="muted">Company: ' + money(company) + '</p></article>';
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
