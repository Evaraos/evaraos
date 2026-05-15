import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase.js';

const list = document.getElementById('payrollList');
const totalEl = document.getElementById('payrollTotal');
const countEl = document.getElementById('payrollCount');

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

async function loadPayroll() {
  const snap = await getDocs(collection(db, 'payouts'));

  const rows = snap.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      companyName: data.companyName || 'Company',
      payoutType: data.payoutType || 'payout',
      status: String(data.status || 'queued').toLowerCase(),
      amount: Number(data.amount || 0)
    };
  });

  totalEl.textContent = money(rows.reduce((sum, row) => sum + row.amount, 0));
  countEl.textContent = String(rows.length);

  if (!rows.length) {
    list.innerHTML = '<div class="item muted">No payout records available.</div>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    return '<article class="item"><h3>' + clean(row.companyName) + '</h3><p class="muted">' + clean(row.payoutType) + '</p><div class="row"><span class="pill">' + clean(row.status) + '</span><span class="pill">' + money(row.amount) + '</span></div></article>';
  }).join('');
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    try {
      await loadPayroll();
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="item muted">Payroll engine failed to load.</div>';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
