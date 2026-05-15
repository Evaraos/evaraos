import { auth, db, onAuthStateChanged, collection, onSnapshot } from './firebase.js';

const countEl = document.getElementById('noticeCount');
const list = document.getElementById('noticeList');

let jobRows = [];
let invoiceRows = [];
let unsubscribeJobs = null;
let unsubscribeInvoices = null;

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function card(title, detail, type) {
  return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p><div class="row"><span class="pill">' + clean(type) + '</span></div></article>';
}

function renderFeed() {
  const items = [];

  jobRows.slice(0, 8).forEach((row) => {
    items.push({
      title: 'Job Update',
      detail: (row.customerName || 'Customer') + ' • ' + (row.status || 'active'),
      type: 'operations'
    });
  });

  invoiceRows.slice(0, 8).forEach((row) => {
    items.push({
      title: 'Invoice Update',
      detail: (row.invoiceNumber || 'Invoice') + ' • ' + (row.paymentStatus || row.status || 'pending'),
      type: 'finance'
    });
  });

  countEl.textContent = String(items.length);

  if (!items.length) {
    list.innerHTML = '<div class="item muted">No operational updates.</div>';
    return;
  }

  list.innerHTML = items.map((row) => card(row.title, row.detail, row.type)).join('');
}

function stopRealtimeFeed() {
  if (unsubscribeJobs) unsubscribeJobs();
  if (unsubscribeInvoices) unsubscribeInvoices();
  unsubscribeJobs = null;
  unsubscribeInvoices = null;
}

function startRealtimeFeed() {
  stopRealtimeFeed();

  list.innerHTML = '<div class="item muted">Starting live feed...</div>';

  unsubscribeJobs = onSnapshot(collection(db, 'jobs'), (snap) => {
    jobRows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderFeed();
  }, (error) => {
    console.error(error);
    list.innerHTML = '<div class="item muted">Job feed failed to load.</div>';
  });

  unsubscribeInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
    invoiceRows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderFeed();
  }, (error) => {
    console.error(error);
    list.innerHTML = '<div class="item muted">Invoice feed failed to load.</div>';
  });
}

function init() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    startRealtimeFeed();
  });
}

window.EvaraPageLifecycle?.registerCleanup?.(stopRealtimeFeed);
window.addEventListener('beforeunload', stopRealtimeFeed);
window.addEventListener('pagehide', stopRealtimeFeed);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
