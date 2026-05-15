import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  onSnapshot
} from './firebase.js';

const workloadEl = document.getElementById('forecastWorkload');
const staffEl = document.getElementById('forecastStaff');
const invoicesEl = document.getElementById('forecastInvoices');
const assignmentsEl = document.getElementById('forecastAssignments');
const riskScoreEl = document.getElementById('opsRiskScore');
const riskListEl = document.getElementById('riskList');
const actionListEl = document.getElementById('actionList');

let jobs = [];
let workforce = [];
let invoices = [];
let assignments = [];

function currency(v) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(v || 0));
}

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function openJobs() {
  return jobs.filter((job) => {
    const status = String(job.status || '').toLowerCase();
    return ['new', 'dispatch_review', 'scheduled'].includes(status);
  });
}

function availableStaff() {
  return workforce.filter((staff) => staff.lat && staff.lng);
}

function unpaidInvoices() {
  return invoices.filter((invoice) => {
    const status = String(invoice.status || '').toLowerCase();
    return ['unpaid', 'past_due', 'open'].includes(status);
  });
}

function activeAssignments() {
  return assignments.filter((assignment) => {
    const status = String(assignment.status || '').toLowerCase();
    return ['suggested', 'pending', 'scheduled'].includes(status);
  });
}

function riskSignals() {
  const signals = [];

  const workload = openJobs().length;
  const staff = availableStaff().length;
  const invoiceBalance = unpaidInvoices().reduce((sum, invoice) => {
    return sum + Number(invoice.total || invoice.balance || 0);
  }, 0);
  const assignmentLoad = activeAssignments().length;

  if (workload > staff * 2) {
    signals.push({
      level: 'High',
      title: 'Dispatch overload risk',
      detail: 'Open workload is exceeding available workforce capacity.'
    });
  }

  if (invoiceBalance > 10000) {
    signals.push({
      level: 'Medium',
      title: 'Revenue pressure rising',
      detail: 'Outstanding unpaid balances are increasing.'
    });
  }

  if (assignmentLoad > workload) {
    signals.push({
      level: 'Medium',
      title: 'Assignment backlog forming',
      detail: 'Assignments are stacking faster than jobs are closing.'
    });
  }

  if (staff <= 2 && workload >= 5) {
    signals.push({
      level: 'Critical',
      title: 'Staffing shortage forecasted',
      detail: 'Current workforce may not support operational demand.'
    });
  }

  if (!signals.length) {
    signals.push({
      level: 'Stable',
      title: 'Operations stable',
      detail: 'No immediate predictive operational risks detected.'
    });
  }

  return signals;
}

function recommendations(signals) {
  const items = [];

  signals.forEach((signal) => {
    if (signal.title.includes('Dispatch')) {
      items.push('Increase available crews or rebalance territories.');
    }

    if (signal.title.includes('Revenue')) {
      items.push('Escalate invoice collections and follow-ups.');
    }

    if (signal.title.includes('Staffing')) {
      items.push('Trigger recruiting and HR outreach automation.');
    }

    if (signal.title.includes('Assignment')) {
      items.push('Review assignment completion times and routing efficiency.');
    }
  });

  if (!items.length) {
    items.push('Maintain current operational cadence.');
  }

  return [...new Set(items)];
}

function overallRisk(signals) {
  let score = 10;

  signals.forEach((signal) => {
    if (signal.level === 'Critical') score += 40;
    if (signal.level === 'High') score += 25;
    if (signal.level === 'Medium') score += 15;
  });

  return Math.min(100, score);
}

function render() {
  const workload = openJobs().length;
  const staff = availableStaff().length;
  const unpaid = unpaidInvoices().reduce((sum, invoice) => {
    return sum + Number(invoice.total || invoice.balance || 0);
  }, 0);
  const assignmentCount = activeAssignments().length;

  const signals = riskSignals();
  const actions = recommendations(signals);
  const risk = overallRisk(signals);

  workloadEl.textContent = String(workload);
  staffEl.textContent = String(staff);
  invoicesEl.textContent = currency(unpaid);
  assignmentsEl.textContent = String(assignmentCount);
  riskScoreEl.textContent = String(risk);

  riskListEl.innerHTML = signals.map((signal) => {
    return '<article class="item"><h3>' +
      clean(signal.title) +
      '</h3><p class="muted">' +
      clean(signal.detail) +
      '</p><div class="row"><span class="pill">' +
      clean(signal.level) +
      '</span></div></article>';
  }).join('');

  actionListEl.innerHTML = actions.map((item) => {
    return '<article class="item"><p class="muted">' +
      clean(item) +
      '</p></article>';
  }).join('');
}

function initRealtime() {
  onSnapshot(collection(db, 'jobs'), (snap) => {
    jobs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  });

  onSnapshot(collection(db, 'workforce_locations'), (snap) => {
    workforce = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  });

  onSnapshot(collection(db, 'invoices'), (snap) => {
    invoices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  });

  onSnapshot(collection(db, 'dispatch_assignments'), (snap) => {
    assignments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  });
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
