import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase.js';

const list = document.getElementById('ledgerList');
const total = document.getElementById('ledgerTotal');
const count = document.getElementById('ledgerCount');
const pending = document.getElementById('ledgerPending');
const search = document.getElementById('ledgerSearch');
const refresh = document.getElementById('ledgerRefresh');

let rows = [];

function dollars(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function safe(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function draw() {
  const q = String(search?.value || '').toLowerCase();
  const view = rows.filter((row) => {
    return [row.name, row.service, row.status].join(' ').toLowerCase().includes(q);
  });

  total.textContent = dollars(view.reduce((sum, row) => sum + row.amount, 0));
  count.textContent = String(view.length);
  pending.textContent = String(view.filter((row) => ['new', 'pending', 'draft'].includes(row.status)).length);

  if (!view.length) {
    list.innerHTML = '<div class="ledger-item muted">No ledger activity found.</div>';
    return;
  }

  list.innerHTML = view.map((row) => {
    return '<article class="ledger-item"><h3>' + safe(row.name) + '</h3><p class="muted">' + safe(row.service) + '</p><div class="ledger-row"><span class="ledger-pill">' + safe(row.status) + '</span><span class="ledger-pill">' + dollars(row.amount) + '</span></div></article>';
  }).join('');
}

async function load() {
  list.innerHTML = '<div class="ledger-item muted">Loading ledger...</div>';

  const snap = await getDocs(collection(db, 'jobs'));
  rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.customerName || data.title || 'Job Record',
      service: data.service || data.serviceType || 'Service',
      status: String(data.paymentStatus || data.invoiceStatus || data.status || 'new').toLowerCase(),
      amount: Number(data.totalAmount || data.subtotal || data.amount || 0)
    };
  }).filter((row) => row.amount > 0 || row.status !== 'new');

  draw();
}

function init() {
  search?.addEventListener('input', draw);
  refresh?.addEventListener('click', load);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    try {
      await load();
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="ledger-item muted">Ledger failed to load.</div>';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
