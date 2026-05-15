import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getSavedUserProfile
} from './firebase.js';

import { calculateSplit } from './split-engine.js';

const list = document.getElementById('billList');
const totalEl = document.getElementById('billTotal');
const countEl = document.getElementById('billCount');

let billableRows = [];
let activeUser = null;
let activeProfile = null;

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function invoiceNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return 'EVA-' + stamp + '-' + random;
}

function splitForJob(row) {
  return calculateSplit(row.amount, {
    splitModel: row.splitModel || row.companyType || 'platform_vendor',
    platformPercent: row.platformPercent,
    vendorPercent: row.vendorPercent,
    operatorPercent: row.operatorPercent
  });
}

async function createInvoice(jobId) {
  const row = billableRows.find((item) => item.id === jobId);
  if (!row) return;

  if (row.invoiceId || row.status === 'invoiced') {
    alert('This job already has an invoice attached.');
    return;
  }

  const split = splitForJob(row);
  const number = invoiceNumber();

  const invoiceRef = await addDoc(collection(db, 'invoices'), {
    invoiceNumber: number,
    jobId: row.id,
    customerUid: row.customerUid || '',
    customerName: row.customer,
    customerEmail: row.customerEmail || '',
    companyId: row.companyId || '',
    companyName: row.companyName || '',
    companyType: row.companyType || '',
    service: row.service,
    status: 'pending',
    paymentStatus: 'unpaid',
    subtotal: row.amount,
    totalAmount: row.amount,
    platformAmount: split.platformAmount,
    companyAmount: split.companyAmount,
    vendorAmount: split.vendorAmount,
    operatorAmount: split.operatorAmount,
    platformPercent: split.platformPercent,
    vendorPercent: split.vendorPercent,
    operatorPercent: split.operatorPercent,
    splitModel: split.splitModel,
    splitLabel: split.splitLabel,
    source: 'job_billing',
    createdBy: activeUser?.uid || '',
    createdByName: activeProfile?.fullName || activeProfile?.displayName || activeUser?.email || 'System',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'jobs', row.id), {
    invoiceId: invoiceRef.id,
    invoiceNumber: number,
    invoiceStatus: 'invoiced',
    paymentStatus: 'unpaid',
    platformAmount: split.platformAmount,
    companyAmount: split.companyAmount,
    vendorAmount: split.vendorAmount,
    operatorAmount: split.operatorAmount,
    platformPercent: split.platformPercent,
    vendorPercent: split.vendorPercent,
    operatorPercent: split.operatorPercent,
    splitModel: split.splitModel,
    splitLabel: split.splitLabel,
    updatedAt: serverTimestamp()
  });

  alert('Invoice created: ' + number);
  await loadBilling();
}

async function loadBilling() {
  const snap = await getDocs(collection(db, 'jobs'));

  billableRows = snap.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      customer: data.customerName || 'Customer',
      customerUid: data.customerUid || '',
      customerEmail: data.customerEmail || '',
      companyId: data.companyId || '',
      companyName: data.companyName || '',
      companyType: data.companyType || '',
      splitModel: data.splitModel || '',
      platformPercent: data.platformPercent,
      vendorPercent: data.vendorPercent,
      operatorPercent: data.operatorPercent,
      service: data.service || data.serviceType || 'Service',
      status: String(data.invoiceStatus || data.status || 'pending_invoice').toLowerCase(),
      invoiceId: data.invoiceId || '',
      invoiceNumber: data.invoiceNumber || '',
      amount: Number(data.totalAmount || data.subtotal || data.amount || 0)
    };
  }).filter((row) => row.amount > 0);

  totalEl.textContent = money(billableRows.reduce((sum, row) => sum + row.amount, 0));
  countEl.textContent = String(billableRows.length);

  if (!billableRows.length) {
    list.innerHTML = '<div class="item muted">No billable jobs yet.</div>';
    return;
  }

  list.innerHTML = billableRows.map((row) => {
    const button = row.invoiceId || row.status === 'invoiced'
      ? '<button class="btn btn-theme-secondary beam-target" disabled>Invoice Created</button>'
      : '<button class="btn btn-theme-primary beam-target" data-create-invoice="' + clean(row.id) + '">Create Invoice</button>';

    return '<article class="item"><h3>' + clean(row.customer) + '</h3><p class="muted">' + clean(row.service) + '</p><div class="actions"><span class="item muted">' + clean(row.status) + '</span><span class="item muted">' + money(row.amount) + '</span>' + button + '</div>' + (row.invoiceNumber ? '<p class="muted">Invoice: ' + clean(row.invoiceNumber) + '</p>' : '') + '</article>';
  }).join('');
}

function bindEvents() {
  list?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-create-invoice]');
    if (!button) return;

    try {
      button.disabled = true;
      button.textContent = 'Creating...';
      await createInvoice(button.getAttribute('data-create-invoice'));
    } catch (error) {
      console.error(error);
      alert(error.message || 'Invoice creation failed.');
      button.disabled = false;
      button.textContent = 'Create Invoice';
    }
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    activeUser = user;
    activeProfile = getSavedUserProfile() || {};

    try {
      await loadBilling();
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="item muted">Billing engine failed to load.</div>';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
