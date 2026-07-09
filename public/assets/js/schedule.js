import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  query,
  where,
  onSnapshot,
  getSavedUserProfile,
  getSavedUserRole
} from './firebase.js';

const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const calendarPrev = document.getElementById('calendarPrev');
const calendarNext = document.getElementById('calendarNext');
const scheduleJobs = document.getElementById('scheduleJobs');
const scheduleActive = document.getElementById('scheduleActive');
const scheduleMonth = document.getElementById('scheduleMonth');

const PLATFORM_ROLES = new Set(['owner', 'super_admin', 'admin']);
const ACTIVE_STATUSES = new Set([
  'scheduled',
  'claimed',
  'assigned',
  'en_route',
  'arrived',
  'in_progress'
]);

let jobs = [];
let currentDate = new Date();
let unsubscribeJobs = null;

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value = '') {
  const role = normalize(value);
  if (role === 'tech') return 'technician';
  return role;
}

function monthLabel(date) {
  return date.toLocaleDateString([], {
    month: 'long',
    year: 'numeric'
  });
}

function statusClass(status = '') {
  const value = normalize(status);
  if (value === 'completed') return 'go';
  if (['in_progress', 'en_route', 'arrived'].includes(value)) return 'hot';
  if (['cancelled', 'failed'].includes(value)) return 'stop';
  return '';
}

function timestampDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof raw?.toDate === 'function') return raw.toDate();
  if (typeof raw?.seconds === 'number') return new Date(raw.seconds * 1000);

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function scheduledDate(job = {}) {
  const candidates = [
    job.scheduledAtMs,
    job.scheduledAt,
    job.scheduledFor,
    job.scheduleDate,
    job.startDate,
    job.appointmentAt,
    job.requestedScheduleAtMs,
    job.requestedScheduleAt
  ];

  for (const candidate of candidates) {
    const date = timestampDate(candidate);
    if (date) return date;
  }

  return null;
}

function scheduledTime(job = {}) {
  const date = scheduledDate(job);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function jobsForDate(date) {
  return jobs.filter((job) => {
    const scheduled = scheduledDate(job);
    if (!scheduled) return false;

    return scheduled.getFullYear() === date.getFullYear()
      && scheduled.getMonth() === date.getMonth()
      && scheduled.getDate() === date.getDate();
  }).sort((left, right) => scheduledDate(left) - scheduledDate(right));
}

function dayCard(date) {
  const dayJobs = jobsForDate(date);

  return `
    <article class="calendar-day glass-card aurora-card beam-target">
      <header>
        <strong>${escapeHtml(date.toLocaleDateString([], { weekday: 'short' }))}</strong>
        <span>${escapeHtml(String(date.getDate()))}</span>
      </header>

      ${dayJobs.length
        ? dayJobs.map((job) => `
            <div class="calendar-pill ${statusClass(job.status)}" title="${escapeHtml(job.status || 'scheduled')}">
              ${escapeHtml(scheduledTime(job))}${scheduledTime(job) ? ' • ' : ''}${escapeHtml(job.customerName || job.title || 'Job')}
              <br />
              ${escapeHtml(job.service || job.serviceType || job.serviceName || 'Service')}
            </div>
          `).join('')
        : '<div class="calendar-pill">No scheduled work</div>'}
    </article>
  `;
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const label = monthLabel(currentDate);

  if (calendarTitle) calendarTitle.textContent = label;
  if (scheduleMonth) scheduleMonth.textContent = label;

  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  if (calendarGrid) calendarGrid.innerHTML = days.map(dayCard).join('');
  if (scheduleJobs) scheduleJobs.textContent = String(jobs.filter((job) => scheduledDate(job)).length);
  if (scheduleActive) {
    scheduleActive.textContent = String(jobs.filter((job) => ACTIVE_STATUSES.has(normalize(job.status))).length);
  }
}

function renderScheduleError(message) {
  if (!calendarGrid) return;
  calendarGrid.innerHTML = `
    <div class="calendar-day">
      ${escapeHtml(message)}
    </div>
  `;
}

function stopJobsSubscription() {
  if (unsubscribeJobs) unsubscribeJobs();
  unsubscribeJobs = null;
}

function startJobsSubscription() {
  stopJobsSubscription();

  const profile = getSavedUserProfile() || {};
  const role = normalizeRole(profile.role || getSavedUserRole());
  const companyId = String(profile.companyId || '').trim();
  const source = collection(db, 'jobs');
  const feed = companyId
    ? query(source, where('companyId', '==', companyId))
    : PLATFORM_ROLES.has(role)
      ? source
      : null;

  if (!feed) {
    jobs = [];
    renderCalendar();
    renderScheduleError('A company assignment is required before the schedule can load.');
    return;
  }

  unsubscribeJobs = onSnapshot(feed, (snap) => {
    jobs = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
    renderCalendar();
  }, (error) => {
    console.error('Schedule subscription failed:', error);
    renderScheduleError(error.message || 'The schedule could not be loaded.');
  });
}

function bindEvents() {
  calendarPrev?.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar();
  });

  calendarNext?.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar();
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, (user) => {
    stopJobsSubscription();

    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    startJobsSubscription();
  });
}

window.addEventListener('pagehide', stopJobsSubscription);
window.addEventListener('beforeunload', stopJobsSubscription);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
