import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp
} from './firebase.js';

import { calculateSplit } from './split-engine.js';

const list = document.getElementById('paymentOpsList');

let invoices = [];

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function splitForInvoice(row) {
  if (row.platformAmount || row.companyAmount || row.vendorAmount || row.operatorAmount) {
    return {
      splitModel: row.splitModel || 'platform_vendor',
      splitLabel: row.splitLabel || '',
      platformPercent: row.platformPercent || 0,
      vendorPercent: row.vendorPercent || 0,
      operatorPercent: row.operatorPercent || 0,
      platformAmount: Number(row.platformAmount || 0),
      companyAmount: Number(row.companyAmount || row.vendorAmount || 0),
      vendorAmount: Number(row.vendorAmount || row.companyAmount || 0),
      operatorAmount: Number(row.operatorAmount || 0)
    };
  }

  return calculateSplit(row.amount, {
    splitModel: row.splitModel || row.companyType || 'platform_vendor',
    platformPercent: row.platformPercent,
    vendorPercent: row.vendorPercent,
    operatorPercent: row.operatorPercent
  });
}

async function savePaymentLink(invoiceId) {
  const field = document.querySelector('[data-payment-link="' + invoiceId + '"]');
  if (!field) return;

  const value = String(field.value || '').trim();

  await updateDoc(doc(db, 'invoices', invoiceId), {
    paymentLink: value,
    updatedAt: serverTimestamp()
  });

  alert('Payment link saved.');
  await loadInvoices();
}

async function markPaid(invoiceId) {
  const row = invoices.find((item) => item.id === invoiceId);
  if (!row) return;

  const split = splitForInvoice(row);

  await updateDoc(doc(db, 'invoices', invoiceId), {
    paymentStatus: 'paid',
    status: 'paid',
    paidAt: serverTimestamp(),
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

  const transactionRef = await addDoc(collection(db, 'transactions'), {
    invoiceId,
    invoiceNumber: row.invoiceNumber,
    jobId: row.jobId || '',
    customerUid: row.customerUid || '',
    customerName: row.customerName || '',
    companyId: row.companyId || '',
    companyName: row.companyName || '',
    companyType: row.companyType || '',
    type: 'invoice_payment',
    status: 'paid',
    amount: row.amount,
    platformAmount: split.platformAmount,
    companyAmount: split.companyAmount,
    vendorAmount: split.vendorAmount,
    operatorAmount: split.operatorAmount,
    platformPercent: split.platformPercent,
    vendorPercent: split.vendorPercent,
    operatorPercent: split.operatorPercent,
    splitModel: split.splitModel,
    splitLabel: split.splitLabel,
    source: 'payment_ops_manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (split.vendorAmount > 0 || split.companyAmount > 0) {
    await addDoc(collection(db, 'payouts'), {
      invoiceId,
      transactionId: transactionRef.id,
      companyId: row.companyId || '',
      companyName: row.companyName || '',
      userId: '',
      status: 'queued',
      payoutType: 'vendor_share',
      amount: Number(split.vendorAmount || split.companyAmount || 0),
      splitModel: split.splitModel,
      source: 'invoice_payment',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  if (split.operatorAmount > 0) {
    await addDoc(collection(db, 'payouts'), {
      invoiceId,
      transactionId: transactionRef.id,
      companyId: row.companyId || '',
      companyName: row.companyName || '',
      userId: row.operatorUid || '',
      status: 'queued',
      payoutType: 'operator_share',
      amount: Number(split.operatorAmount || 0),
      splitModel: split.splitModel,
      source: 'invoice_payment',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  alert('Invoice marked paid and financial records created.');
  await loadInvoices();
}

async function loadInvoices() {
  const snap = await getDocs(collection(db, 'invoices'));

  invoices = snap.docs.map((docItem) => {
    const data = docItem.data();

    return {
      id: docItem.id,
      invoiceNumber: data.invoiceNumber || 'Invoice',
      jobId: data.jobId || '',
      customerUid: data.customerUid || '',
      customerName: data.customerName || 'Customer',
      companyId: data.companyId || '',
      companyName: data.companyName || '',
      companyType: data.companyType || '',
      operatorUid: data.operatorUid || '',
      status: String(data.paymentStatus || data.status || 'pending').toLowerCase(),
      amount: Number(data.totalAmount || data.subtotal || 0),
      splitModel: data.splitModel || '',
      splitLabel: data.splitLabel || '',
      platformPercent: data.platformPercent,
      vendorPercent: data.vendorPercent,
      operatorPercent: data.operatorPercent,
      platformAmount: Number(data.platformAmount || 0),
      companyAmount: Number(data.companyAmount || 0),
      vendorAmount: Number(data.vendorAmount || 0),
      operatorAmount: Number(data.operatorAmount || 0),
      paymentLink: data.paymentLink || ''
    };
  });

  if (!invoices.length) {
    list.innerHTML = '<div class="item muted">No invoices available.</div>';
    return;
  }

  list.innerHTML = invoices.map((row) => {
    const paidButton = row.status === 'paid'
      ? '<button class="btn btn-theme-secondary beam-target" disabled>Paid</button>'
      : '<button class="btn btn-theme-primary beam-target" data-mark-paid="' + clean(row.id) + '">Mark Paid</button>';

    return '<article class="item"><h3>' + clean(row.invoiceNumber) + '</h3><p class="muted">' + clean(row.customerName) + '</p><div class="row"><span class="pill">' + clean(row.status) + '</span><span class="pill">' + money(row.amount) + '</span></div><div class="row"><input class="field" data-payment-link="' + clean(row.id) + '" placeholder="https://buy.stripe.com/..." value="' + clean(row.paymentLink) + '"><button class="btn btn-theme-secondary beam-target" data-save-payment="' + clean(row.id) + '">Save Link</button>' + paidButton + '</div></article>';
  }).join('');
}

function bindEvents() {
  list?.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-save-payment]');
    const paidButton = event.target.closest('[data-mark-paid]');

    try {
      if (saveButton) {
        await savePaymentLink(saveButton.getAttribute('data-save-payment'));
      }

      if (paidButton) {
        await markPaid(paidButton.getAttribute('data-mark-paid'));
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Payment operation failed.');
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

    try {
      await loadInvoices();
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="item muted">Payment operations failed to load.</div>';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
