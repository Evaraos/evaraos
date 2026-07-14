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

const scheduleMain = document.getElementById('scheduleMain');
const calendarViewport = document.getElementById('calendarViewport');
const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const calendarPrev = document.getElementById('calendarPrev');
const calendarNext = document.getElementById('calendarNext');
const scheduleTodayBtn = document.getElementById('scheduleTodayBtn');
const scheduleSearch = document.getElementById('scheduleSearch');
const scheduleStatusFilter = document.getElementById('scheduleStatusFilter');
const scheduleClearFilters = document.getElementById('scheduleClearFilters');
const scheduleAgenda = document.getElementById('scheduleAgenda');
const scheduleAgendaCount = document.getElementById('scheduleAgendaCount');
const scheduleAgendaSummary = document.getElementById('scheduleAgendaSummary');
const scheduleConnectionLabel = document.getElementById('scheduleConnectionLabel');
const scheduleStatusCopy = document.getElementById('scheduleStatusCopy');
const scheduleJobs = document.getElementById('scheduleJobs');
const scheduleActive = document.getElementById('scheduleActive');
const scheduleToday = document.getElementById('scheduleToday');
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
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'failed']);
const SEARCH_DEBOUNCE_MS = 90;
const MAX_DAY_JOBS = 3;
const MAX_AGENDA_JOBS = 8;

let jobs = [];
let currentDate = firstOfMonth(new Date());
let unsubscribeJobs = null;
let searchTimer = null;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let hasRenderedFeed = false;
let lastCalendarHtml = '';
let lastAgendaHtml = '';
let lastRenderSignature = '';

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

function firstOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(left, right) {
  return Boolean(left && right)
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function sameMonth(left, right) {
  return Boolean(left && right)
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth();
}

function monthLabel(date) {
  return date.toLocaleDateString([], {
    month: 'long',
    year: 'numeric'
  });
}

function humanize(value = '') {
  return String(value || 'scheduled')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status = '') {
  const value = normalize(status);
  if (['completed', 'done', 'closed'].includes(value)) return 'go';
  if (['in_progress', 'en_route', 'arrived', 'active', 'working'].includes(value)) return 'hot';
  if (CANCELLED_STATUSES.has(value)) return 'stop';
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

function jobTitle(job = {}) {
  return job.customerName || job.title || job.name || 'Scheduled Job';
}

function jobService(job = {}) {
  return job.service || job.serviceType || job.serviceName || 'Service';
}

function jobTeam(job = {}) {
  if (job.assignedStaffName) return job.assignedStaffName;
  if (job.staffClaimedByName) return job.staffClaimedByName;
  if (Array.isArray(job.assignedToNames) && job.assignedToNames.length) return job.assignedToNames.join(', ');
  if (Array.isArray(job.assignedTeamNames) && job.assignedTeamNames.length) return job.assignedTeamNames.join(', ');
  return 'Unassigned team';
}

function jobLocation(job = {}) {
  return job.city || job.market || job.address || 'Location pending';
}

function setText(element, value) {
  if (!element) return;
  const next = String(value ?? '');
  if (element.textContent !== next) element.textContent = next;
}

function setBusy(isBusy) {
  scheduleMain?.setAttribute('aria-busy', String(Boolean(isBusy)));
  calendarGrid?.setAttribute('aria-busy', String(Boolean(isBusy)));
  scheduleAgenda?.setAttribute('aria-busy', String(Boolean(isBusy)));
}

function setConnectionState(state, message) {
  const label = state === 'connected'
    ? 'Schedule Connected'
    : state === 'error'
      ? 'Connection Failed'
      : 'Connecting';

  setText(scheduleConnectionLabel, label);
  setText(scheduleStatusCopy, message);

  const shell = scheduleConnectionLabel?.closest('.schedule-live-label');
  shell?.classList.toggle('is-connected', state === 'connected');
  shell?.classList.toggle('is-error', state === 'error');
}

function matchesStatus(job, filter) {
  if (filter === 'all') return true;
  const value = normalize(job.status);

  if (filter === 'active') return ACTIVE_STATUSES.has(value) || ['active', 'working'].includes(value);
  if (filter === 'completed') return ['completed', 'done', 'closed'].includes(value);
  if (filter === 'cancelled') return CANCELLED_STATUSES.has(value);

  return true;
}

function filteredJobs() {
  const term = normalize(scheduleSearch?.value || '');
  const statusFilter = normalize(scheduleStatusFilter?.value || 'all');

  return jobs.filter((job) => {
    if (!scheduledDate(job)) return false;

    const textMatch = !term || [
      jobTitle(job),
      jobService(job),
      jobTeam(job),
      jobLocation(job),
      job.companyName,
      job.status
    ].some((value) => normalize(value).includes(term));

    return textMatch && matchesStatus(job, statusFilter);
  });
}

function jobsForDate(date, source) {
  return source
    .filter((job) => sameDay(scheduledDate(job), date))
    .sort((left, right) => scheduledDate(left) - scheduledDate(right));
}

function calendarPill(job) {
  const time = scheduledTime(job);
  const title = jobTitle(job);
  const service = jobService(job);
  const href = `/jobs.html?job=${encodeURIComponent(job.id || '')}&from=schedule`;

  return `
    <a class="calendar-pill ${statusClass(job.status)}" href="${href}" title="${escapeHtml(`${humanize(job.status)}: ${title}`)}">
      <span class="calendar-pill-time">${escapeHtml(time || humanize(job.status))}</span>
      <span class="calendar-pill-title">${escapeHtml(title)}</span>
      <span class="calendar-pill-service">${escapeHtml(service)}</span>
    </a>
  `;
}

function dayCard(date, source) {
  const today = startOfDay(new Date());
  const dayJobs = jobsForDate(date, source);
  const visibleJobs = dayJobs.slice(0, MAX_DAY_JOBS);
  const remaining = Math.max(0, dayJobs.length - visibleJobs.length);
  const classes = [
    'calendar-day',
    'glass-card',
    'aurora-card',
    'beam-target',
    dayJobs.length ? '' : 'is-empty',
    sameDay(date, today) ? 'is-today' : ''
  ].filter(Boolean).join(' ');
  const dateLabel = date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return `
    <article class="${classes}" role="gridcell" aria-label="${escapeHtml(`${dateLabel}, ${dayJobs.length} scheduled job${dayJobs.length === 1 ? '' : 's'}`)}" data-calendar-date="${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}">
      <header>
        <strong>${escapeHtml(date.toLocaleDateString([], { weekday: 'short' }))}</strong>
        <span>${escapeHtml(String(date.getDate()))}</span>
      </header>
      ${dayJobs.length ? `<span class="schedule-day-count">${dayJobs.length} scheduled</span>` : ''}
      ${visibleJobs.map(calendarPill).join('')}
      ${remaining ? `<span class="calendar-more-pill">+${remaining} more</span>` : ''}
      ${dayJobs.length ? '' : '<span class="calendar-empty-label">Available</span>'}
    </article>
  `;
}

function monthGridHtml(source) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const leadingDays = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - leadingDays + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cells.push('<div class="calendar-day is-outside-month" aria-hidden="true"></div>');
      continue;
    }

    cells.push(dayCard(new Date(year, month, dayNumber), source));
  }

  return cells.join('');
}

function agendaItem(job) {
  const date = scheduledDate(job);
  const href = `/jobs.html?job=${encodeURIComponent(job.id || '')}&from=schedule-agenda`;

  return `
    <a class="schedule-agenda-item beam-target" href="${href}">
      <span class="schedule-agenda-date" aria-hidden="true">
        <span>${escapeHtml(date.toLocaleDateString([], { month: 'short' }))}</span>
        <strong>${escapeHtml(String(date.getDate()))}</strong>
      </span>
      <span class="schedule-agenda-copy">
        <strong>${escapeHtml(jobTitle(job))}</strong>
        <span>${escapeHtml(`${scheduledTime(job) || 'Time pending'} • ${jobService(job)}`)}</span>
        <span class="schedule-agenda-meta">
          <span>${escapeHtml(jobTeam(job))}</span>
          <span>${escapeHtml(jobLocation(job))}</span>
          <span>${escapeHtml(humanize(job.status))}</span>
        </span>
      </span>
    </a>
  `;
}

function renderAgenda(source) {
  const today = startOfDay(new Date());
  const upcoming = source
    .filter((job) => scheduledDate(job) >= today)
    .sort((left, right) => scheduledDate(left) - scheduledDate(right));
  const visible = upcoming.slice(0, MAX_AGENDA_JOBS);
  const html = visible.length
    ? visible.map(agendaItem).join('')
    : '<div class="schedule-state-card">No upcoming work matches the current filters.</div>';

  if (html !== lastAgendaHtml && scheduleAgenda) {
    scheduleAgenda.innerHTML = html;
    lastAgendaHtml = html;
  }

  setText(scheduleAgendaCount, upcoming.length);
  setText(
    scheduleAgendaSummary,
    upcoming.length
      ? `Showing the next ${Math.min(upcoming.length, MAX_AGENDA_JOBS)} of ${upcoming.length} upcoming scheduled job${upcoming.length === 1 ? '' : 's'}.`
      : 'Upcoming scheduled work will appear here.'
  );
}

function scrollTodayIntoView() {
  const today = new Date();
  if (!sameMonth(today, currentDate) || !calendarViewport || calendarViewport.scrollWidth <= calendarViewport.clientWidth) return;

  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const card = calendarGrid?.querySelector(`[data-calendar-date="${key}"]`);
  if (!card) return;

  const left = card.offsetLeft - Math.max(8, (calendarViewport.clientWidth - card.offsetWidth) / 2);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  calendarViewport.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
}

function renderCalendar({ focusToday = false, force = false } = {}) {
  const source = filteredJobs();
  const label = monthLabel(currentDate);
  const monthJobs = source.filter((job) => sameMonth(scheduledDate(job), currentDate));
  const activeMonthJobs = monthJobs.filter((job) => ACTIVE_STATUSES.has(normalize(job.status)) || ['active', 'working'].includes(normalize(job.status)));
  const todayJobs = source.filter((job) => sameDay(scheduledDate(job), new Date()));
  const signature = [
    currentDate.getFullYear(),
    currentDate.getMonth(),
    normalize(scheduleSearch?.value || ''),
    normalize(scheduleStatusFilter?.value || 'all'),
    source.map((job) => `${job.id}:${normalize(job.status)}:${scheduledDate(job)?.getTime() || 0}:${jobTitle(job)}:${jobService(job)}`).join('|')
  ].join('~');

  setText(calendarTitle, label);
  setText(scheduleMonth, label);
  setText(scheduleJobs, monthJobs.length);
  setText(scheduleActive, activeMonthJobs.length);
  setText(scheduleToday, todayJobs.length);
  setText(scheduleStatusCopy, `${monthJobs.length} scheduled job${monthJobs.length === 1 ? '' : 's'} in ${label}; ${todayJobs.length} scheduled today.`);

  calendarPrev?.setAttribute('aria-label', `Show ${monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}`);
  calendarNext?.setAttribute('aria-label', `Show ${monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}`);

  if (force || signature !== lastRenderSignature) {
    const html = monthGridHtml(source);
    if (calendarGrid && html !== lastCalendarHtml) {
      calendarGrid.innerHTML = html;
      lastCalendarHtml = html;
    }
    renderAgenda(source);
    lastRenderSignature = signature;
  }

  setBusy(false);

  if (focusToday) requestAnimationFrame(scrollTodayIntoView);
}

function skeletonMarkup() {
  return `
    <div class="schedule-skeleton" aria-hidden="true">
      <span class="schedule-skeleton-line"></span>
      <span class="schedule-skeleton-line"></span>
      <span class="schedule-skeleton-line"></span>
    </div>
  `;
}

function renderLoadingState() {
  setBusy(true);
  setConnectionState('loading', 'Loading the role-scoped schedule and preparing the month view.');
  setText(calendarTitle, 'Loading…');
  setText(scheduleMonth, '—');
  setText(scheduleJobs, 0);
  setText(scheduleActive, 0);
  setText(scheduleToday, 0);

  if (calendarGrid) calendarGrid.innerHTML = Array.from({ length: 14 }, skeletonMarkup).join('');
  if (scheduleAgenda) scheduleAgenda.innerHTML = '<div class="schedule-state-card">Loading upcoming work…</div>';
  setText(scheduleAgendaCount, 0);
  setText(scheduleAgendaSummary, 'Preparing the upcoming agenda.');

  lastCalendarHtml = '';
  lastAgendaHtml = '';
  lastRenderSignature = '';
}

function renderScheduleError(message) {
  const safeMessage = escapeHtml(message || 'The schedule could not be loaded.');
  if (calendarGrid) calendarGrid.innerHTML = `<div class="schedule-state-card is-error">${safeMessage}</div>`;
  if (scheduleAgenda) scheduleAgenda.innerHTML = `<div class="schedule-state-card is-error">${safeMessage}</div>`;
  setText(scheduleAgendaCount, 0);
  setText(scheduleAgendaSummary, 'Schedule data is currently unavailable.');
  setConnectionState('error', 'The scheduling feed could not connect.');
  setBusy(false);
}

function stopJobsSubscription() {
  if (unsubscribeJobs) unsubscribeJobs();
  unsubscribeJobs = null;
}

function startJobsSubscription() {
  stopJobsSubscription();
  renderLoadingState();

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
    renderScheduleError('A company assignment is required before the schedule can load.');
    return;
  }

  unsubscribeJobs = onSnapshot(feed, (snap) => {
    jobs = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
    setConnectionState('connected', 'Schedule is synchronized with the latest role-scoped job records.');
    renderCalendar({ focusToday: !hasRenderedFeed, force: true });
    hasRenderedFeed = true;
  }, (error) => {
    console.error('Schedule subscription failed:', error);
    renderScheduleError(error.message || 'The schedule could not be loaded.');
  });
}

function scheduleRender() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    renderCalendar({ force: true });
  }, SEARCH_DEBOUNCE_MS);
}

function clearFilters() {
  if (scheduleSearch) scheduleSearch.value = '';
  if (scheduleStatusFilter) scheduleStatusFilter.value = 'all';
  renderCalendar({ force: true });
  scheduleSearch?.focus();
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  calendarPrev?.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar({ force: true });
  });

  calendarNext?.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar({ force: true });
  });

  scheduleTodayBtn?.addEventListener('click', () => {
    currentDate = firstOfMonth(new Date());
    renderCalendar({ focusToday: true, force: true });
  });

  scheduleSearch?.addEventListener('input', scheduleRender);
  scheduleStatusFilter?.addEventListener('change', () => renderCalendar({ force: true }));
  scheduleClearFilters?.addEventListener('click', clearFilters);
}

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === 'function') {
    window.EvaraLoader.beginNavigationLoad(options);
  }
  requestAnimationFrame(() => window.location.assign(url));
}

function init() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, (user) => {
    stopJobsSubscription();

    if (!user) {
      navigateWithLoader('/login.html', {
        title: 'Returning to login',
        subtitle: 'Your session is not active.'
      });
      return;
    }

    startJobsSubscription();
  });
}

window.addEventListener('pagehide', () => {
  stopJobsSubscription();
  if (searchTimer) clearTimeout(searchTimer);
}, { once: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
