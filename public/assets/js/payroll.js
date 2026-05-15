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

function payoutLabel(type = '') {
  const normalized = String(type || '').toLowerCase();

  if (normalized === 'vendor_share') return 'Vendor Share';
  if (normalized === 'operator_share') return 'Operator Share';
  if (normalized === 'company_share') return 'Company Share';

  return type || 'Payout';
}

function splitLabel(model = '') {
  const normalized = String(model || '').toLowerCase();

  if (normalized === 'platform_vendor') return 'Platform Vendor';
  if (normalized === 'subsidiary_expansion_partner') return 'Evaraos Subsidiary Expansion Partner';
  if (normalized === 'evara_expansion_partner') return 'Evaraos Subsidiary Expansion Partner';
  if (normalized === 'internal_subsidiary') return 'Evaraos Subsidiary Expansion Partner';

  return model || 'Unassigned Model';
}

function summarizeByType(rows = []) {
  return rows.reduce((summary, row) => {
    const key = row.payoutType || 'payout';
    summary[key] = summary[key] || { count: 0, amount: 0 };
    summary[key].count += 1;
    summary[key].amount += row.amount;
    return summary;
  }, {});
}

async function loadPayroll() {
  const snap = await getDocs(collection(db, 'payouts'));

  const rows = snap.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      companyName: data.companyName || 'Company',
      payoutType: data.payoutType || 'payout',
      splitModel: data.splitModel || '',
      status: String(data.status || 'queued').toLowerCase(),
      amount: Number(data.amount || 0),
      userId: data.userId || '',
      transactionId: data.transactionId || '',
      invoiceId: data.invoiceId || ''
    };
  });

  const summary = summarizeByType(rows);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  totalEl.textContent = money(total);
  countEl.textContent = String(rows.length);

  if (!rows.length) {
    list.innerHTML = '<div class="item muted">No payout records available.</div>';
    return;
  }

  const summaryHtml = Object.entries(summary).map(([type, item]) => {
    return '<article class="item"><h3>' + clean(payoutLabel(type)) + '</h3><p class="muted">' + clean(String(item.count)) + ' queued record(s)</p><div class="row"><span class="pill">Summary</span><span class="pill">' + money(item.amount) + '</span></div></article>';
  }).join('');

  const rowHtml = rows.map((row) => {
    return '<article class="item"><h3>' + clean(row.companyName) + '</h3><p class="muted">' + clean(payoutLabel(row.payoutType)) + '</p><p class="muted">Model: ' + clean(splitLabel(row.splitModel)) + '</p><div class="row"><span class="pill">' + clean(row.status) + '</span><span class="pill">' + money(row.amount) + '</span></div></article>';
  }).join('');

  list.innerHTML = summaryHtml + rowHtml;
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
