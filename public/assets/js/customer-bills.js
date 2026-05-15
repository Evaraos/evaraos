import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase.js';

const list = document.getElementById('billViewList');
const totalEl = document.getElementById('billViewTotal');
const countEl = document.getElementById('billViewCount');

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function paymentAction(row) {
  if (row.status === 'paid') {
    return '<span class="pill">Paid</span>';
  }

  if (row.paymentLink) {
    return '<a class="btn btn-theme-primary beam-target" href="' + clean(row.paymentLink) + '" target="_blank" rel="noopener noreferrer">Pay Invoice</a>';
  }

  return '<span class="pill">Payment link pending</span>';
}

async function loadBills(user) {
  const snap = await getDocs(collection(db, 'invoices'));

  const rows = snap.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      invoiceNumber: data.invoiceNumber || 'Invoice',
      customerUid: data.customerUid || '',
      service: data.service || 'Service',
      status: String(data.paymentStatus || data.status || 'pending').toLowerCase(),
      amount: Number(data.totalAmount || data.subtotal || 0),
      paymentLink: data.paymentLink || data.stripePaymentLink || data.checkoutUrl || ''
    };
  }).filter((row) => row.customerUid === user.uid);

  totalEl.textContent = money(rows.reduce((sum, row) => sum + row.amount, 0));
  countEl.textContent = String(rows.length);

  if (!rows.length) {
    list.innerHTML = '<div class="item muted">No billing records available.</div>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    return '<article class="item"><h3>' + clean(row.invoiceNumber) + '</h3><p class="muted">' + clean(row.service) + '</p><div class="row"><span class="pill">' + clean(row.status) + '</span><span class="pill">' + money(row.amount) + '</span>' + paymentAction(row) + '</div></article>';
  }).join('');
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    try {
      await loadBills(user);
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="item muted">Billing portal failed to load.</div>';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
