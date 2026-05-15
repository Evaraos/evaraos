import { auth, db, onAuthStateChanged, collection, onSnapshot } from './firebase.js';

const openJobsEl = document.getElementById('openJobs');
const activeJobsEl = document.getElementById('activeJobs');
const onlineStaffEl = document.getElementById('onlineStaff');
const idleStaffEl = document.getElementById('idleStaff');
const readinessEl = document.getElementById('dispatchReadiness');
const jobsList = document.getElementById('dispatchJobs');
const staffList = document.getElementById('dispatchStaff');

let jobs = [];
let presence = [];
let unsubs = [];

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function stateFrom(lastSeen) {
  const diff = Date.now() - Number(lastSeen || 0);

  if (diff <= 120000) return 'online';
  if (diff <= 900000) return 'idle';
  return 'offline';
}

function render() {
  const openJobs = jobs.filter((j) => ['new', 'dispatch_review'].includes(String(j.status || '').toLowerCase()));
  const activeJobs = jobs.filter((j) => ['claimed', 'scheduled', 'in_progress'].includes(String(j.status || '').toLowerCase()));

  const online = presence.filter((p) => stateFrom(p.lastSeenMs) === 'online');
  const idle = presence.filter((p) => stateFrom(p.lastSeenMs) === 'idle');

  openJobsEl.textContent = String(openJobs.length);
  activeJobsEl.textContent = String(activeJobs.length);
  onlineStaffEl.textContent = String(online.length);
  idleStaffEl.textContent = String(idle.length);

  const readiness = online.length + idle.length;
  const score = openJobs.length ? Math.min(100, Math.round((readiness / openJobs.length) * 100)) : 100;

  readinessEl.textContent = score + '%';

  jobsList.innerHTML = openJobs.length
    ? openJobs.slice(0, 10).map((job) => {
        return '<article class="item"><h3>' + clean(job.customerName || 'Customer') + '</h3><p class="muted">' + clean(job.serviceType || job.service || 'Service') + '</p><div class="row"><span class="pill">' + clean(job.status || 'new') + '</span></div></article>';
      }).join('')
    : '<div class="item muted">No open jobs waiting for dispatch.</div>';

  staffList.innerHTML = presence.length
    ? presence.slice(0, 12).map((user) => {
        const state = stateFrom(user.lastSeenMs);

        return '<article class="item"><h3>' + clean(user.displayName || user.email || 'Staff') + '</h3><p class="muted">' + clean(user.role || 'staff') + '</p><div class="row"><span class="pill ' + state + '">' + state + '</span></div></article>';
      }).join('')
    : '<div class="item muted">No workforce activity detected.</div>';
}

function watch(name, assign) {
  const unsub = onSnapshot(collection(db, name), (snap) => {
    assign(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    render();
  });

  unsubs.push(unsub);
}

function start() {
  watch('jobs', (rows) => {
    jobs = rows;
  });

  watch('presence', (rows) => {
    presence = rows;
  });
}

function init() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    start();
  });
}

window.addEventListener('beforeunload', () => {
  unsubs.forEach((unsub) => unsub());
  unsubs = [];
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
