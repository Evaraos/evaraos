import {
  auth,
  onAuthStateChanged
} from './firebase.js';

import {
  loadCustomerNotifications,
  subscribeCustomerNotifications,
  markPersistentNotificationRead,
  archivePersistentNotification,
  dismissPersistentNotification,
  markAllCustomerNotificationsRead
} from './persistent-customer-notifications-adapter.js';

const state = {
  customerId: '',
  notifications: [],
  filter: 'all',
  loading: true,
  error: '',
  unsubscribe: null
};

const root = document.getElementById('customerNotificationList');
const statusNode = document.getElementById('customerNotificationsStatus');
const summaryNode = document.getElementById('customerNotificationsSummary');
const unreadHeroNode = document.getElementById('customerNotificationUnread');
const totalNode = document.getElementById('customerNotificationTotal');
const unreadStatNode = document.getElementById('customerNotificationUnreadStat');
const urgentNode = document.getElementById('customerNotificationUrgent');
const updatedNode = document.getElementById('customerNotificationUpdated');
const allFilter = document.getElementById('notificationFilterAll');
const unreadFilter = document.getElementById('notificationFilterUnread');
const markAllReadButton = document.getElementById('notificationMarkAllRead');
const refreshButton = document.getElementById('notificationRefresh');
const SAFE_CUSTOMER_ACTION_ROUTES = new Set([
  '/customer-messaging.html',
  '/customer-service-history.html',
  '/customer_dashboard.html',
  '/customer_bills.html',
  '/customer-commerce.html'
]);

let initialized = false;

injectPageStyles();

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleCase(value = '') {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatUpdatedAt(timestamp = 0) {
  const value = Number(timestamp || 0);
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function summary(message = '') {
  if (summaryNode) summaryNode.textContent = message;
}

function verifiedCustomerSession(user = auth.currentUser) {
  const session = window.EvaraRouteSession;
  if (
    !user ||
    session?.source !== 'verified-route-guard' ||
    session.authenticated !== true ||
    session.role !== 'customer' ||
    session.userId !== user.uid
  ) {
    return null;
  }
  return session;
}

function safeActionUrl(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('//') || /^(javascript:|data:|vbscript:)/i.test(value)) return '';

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return '';
    if (!SAFE_CUSTOMER_ACTION_ROUTES.has(parsed.pathname)) return '';
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return '';
  }
}

function visibleNotifications() {
  if (state.filter === 'unread') {
    return state.notifications.filter((notification) => notification.status === 'unread');
  }
  return state.notifications;
}

function renderStats() {
  const rows = state.notifications;
  const unread = rows.filter((notification) => notification.status === 'unread');
  const urgent = rows.filter((notification) => notification.priority === 'urgent');
  const latest = rows.reduce((latestValue, row) => {
    const created = Number(row.createdAtMs || row.updatedAtMs || 0);
    if (!created) return latestValue;
    return Math.max(latestValue, created);
  }, 0);

  totalNode.textContent = String(rows.length || 0);
  unreadStatNode.textContent = String(unread.length || 0);
  urgentNode.textContent = String(urgent.length || 0);
  unreadHeroNode.textContent = String(unread.length || 0);
  updatedNode.textContent = latest ? formatUpdatedAt(latest) : '—';

  if (!rows.length) {
    summary('No customer notifications yet.');
    return;
  }

  summary(`${unread.length} unread update${unread.length === 1 ? '' : 's'} across ${rows.length} notification${rows.length === 1 ? '' : 's'}.`);
}

function renderNotifications() {
  if (!root) return;

  if (state.loading) {
    root.innerHTML = '<div class="item muted">Loading notifications…</div>';
    status('Checking your customer inbox…');
    renderStats();
    return;
  }

  if (state.error) {
    root.innerHTML = '<div class="item error">' + escapeHtml(state.error) + '</div>';
    status('Customer notifications are unavailable right now.');
    renderStats();
    return;
  }

  const rows = visibleNotifications();
  if (!rows.length) {
    root.innerHTML = '<div class="item muted">No ' + (state.filter === 'unread' ? 'unread ' : '') + 'notifications yet.</div>';
    status(state.filter === 'unread' ? 'No unread customer notifications.' : 'Your customer inbox is clear.');
    renderStats();
    return;
  }

  root.innerHTML = rows.map((notification) => {
    const id = escapeHtml(notification.id || '');
    const title = escapeHtml(notification.title || 'Customer notification');
    const body = escapeHtml(notification.body || 'No details were provided.');
    const type = escapeHtml(titleCase(notification.type || 'account'));
    const priority = escapeHtml(titleCase(notification.priority || 'normal'));
    const statusLabel = escapeHtml(titleCase(notification.status || 'unread'));
    const createdAt = escapeHtml(formatUpdatedAt(Number(notification.createdAtMs || notification.updatedAtMs || 0)));
    const safeUrl = safeActionUrl(notification.actionUrl || '');
    const readButton = notification.status === 'unread'
      ? '<button type="button" class="customer-notification-action" data-action="read" data-notification-id="' + id + '">Mark read</button>'
      : '';
    const actionLink = safeUrl
      ? '<a class="customer-notification-action is-link" href="' + escapeHtml(safeUrl) + '" data-action="open" data-notification-id="' + id + '" data-notification-url="' + escapeHtml(safeUrl) + '">Open</a>'
      : '';

    return `
      <article class="customer-notification-row ${notification.status === 'unread' ? 'is-unread' : ''} priority-${escapeHtml(notification.priority || 'normal')}" data-notification-id="${id}">
        <div class="customer-notification-head">
          <div>
            <p class="customer-notification-kicker">${type}</p>
            <h3>${title}</h3>
          </div>
          <span class="customer-notification-priority customer-notification-priority-${escapeHtml(notification.priority || 'normal')}">${priority}</span>
        </div>
        <p class="customer-notification-body">${body}</p>
        <div class="customer-notification-meta">
          <span>${createdAt}</span>
          <span>${statusLabel}</span>
        </div>
        <div class="customer-notification-actions">
          ${actionLink}
          ${readButton}
          <button type="button" class="customer-notification-action" data-action="archive" data-notification-id="${id}">Archive</button>
          <button type="button" class="customer-notification-action" data-action="dismiss" data-notification-id="${id}">Dismiss</button>
        </div>
      </article>
    `;
  }).join('');

  status('Customer notifications loaded.');
  renderStats();
}

function setFilter(filter = 'all') {
  state.filter = filter === 'unread' ? 'unread' : 'all';
  if (allFilter) allFilter.classList.toggle('is-active', state.filter === 'all');
  if (unreadFilter) unreadFilter.classList.toggle('is-active', state.filter === 'unread');
  allFilter?.setAttribute('aria-pressed', String(state.filter === 'all'));
  unreadFilter?.setAttribute('aria-pressed', String(state.filter === 'unread'));
  renderNotifications();
}

async function refreshCustomerNotifications() {
  const customerId = state.customerId;
  if (!customerId) return;
  state.loading = true;
  state.error = '';
  renderNotifications();

  try {
    const rows = await loadCustomerNotifications(customerId);
    if (state.customerId !== customerId || auth.currentUser?.uid !== customerId || !verifiedCustomerSession(auth.currentUser)) return;
    state.notifications = rows || [];
    state.loading = false;
    state.error = '';
    renderNotifications();
  } catch (error) {
    console.error('Failed to load customer notifications.', error);
    state.loading = false;
    state.error = 'Unable to load customer notifications right now.';
    renderNotifications();
  }
}

function stopSubscription() {
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }
}

function startSubscription() {
  stopSubscription();
  const customerId = state.customerId;
  if (!customerId || !verifiedCustomerSession(auth.currentUser)) return;

  state.unsubscribe = subscribeCustomerNotifications(customerId, (rows = [], error = null) => {
    if (state.customerId !== customerId || auth.currentUser?.uid !== customerId || !verifiedCustomerSession(auth.currentUser)) return;
    if (error) {
      state.loading = false;
      state.error = 'Live customer notification updates are unavailable.';
      renderNotifications();
      return;
    }

    state.notifications = rows || [];
    state.loading = false;
    state.error = '';
    renderNotifications();
  });
}

function resetCustomerState({ loading = true, error = '' } = {}) {
  stopSubscription();
  state.customerId = '';
  state.notifications = [];
  state.loading = loading;
  state.error = error;
  renderNotifications();
}

function startVerifiedCustomerSession() {
  const user = auth.currentUser;
  const session = verifiedCustomerSession(user);
  if (!session) {
    if (state.customerId || state.notifications.length) resetCustomerState();
    return;
  }

  if (state.customerId === user.uid && state.unsubscribe) return;

  if (state.customerId !== user.uid || state.notifications.length) resetCustomerState();
  state.customerId = user.uid;
  startSubscription();
  refreshCustomerNotifications();
}

async function handleNotificationAction(notificationId = '', action = '') {
  if (!notificationId || !action) return;

  try {
    if (action === 'read') {
      await markPersistentNotificationRead(notificationId);
    } else if (action === 'archive') {
      await archivePersistentNotification(notificationId);
    } else if (action === 'dismiss') {
      await dismissPersistentNotification(notificationId);
    } else if (action === 'open') {
      const target = safeActionUrl(document.querySelector('[data-notification-id="' + notificationId + '"]')?.dataset?.notificationUrl || '');
      if (target) window.location.assign(target);
      return;
    }
    renderNotifications();
  } catch (error) {
    console.error('Customer notification action failed.', error);
    status('This notification action could not be completed.');
  }
}

async function markAllRead() {
  if (!state.customerId) return;
  if (!state.notifications.some((row) => row.status === 'unread')) return;

  try {
    await markAllCustomerNotificationsRead(state.customerId);
    renderNotifications();
  } catch (error) {
    console.error('Failed to mark customer notifications read.', error);
    status('Unable to mark every customer notification as read.');
  }
}

function bindEvents() {
  allFilter?.addEventListener('click', () => setFilter('all'));
  unreadFilter?.addEventListener('click', () => setFilter('unread'));
  markAllReadButton?.addEventListener('click', markAllRead);
  refreshButton?.addEventListener('click', refreshCustomerNotifications);

  root?.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    event.preventDefault();
    event.stopPropagation();

    const action = actionButton.dataset.action;
    const notificationId = actionButton.dataset.notificationId;
    if (action === 'open') {
      const target = safeActionUrl(actionButton.dataset.notificationUrl || '');
      if (target) {
        window.location.assign(target);
      }
      return;
    }

    await handleNotificationAction(notificationId, action);
  });

  window.addEventListener('pagehide', stopSubscription);
  window.addEventListener('pageshow', (event) => {
    const user = auth.currentUser;
    const session = verifiedCustomerSession(user);
    if (!event.persisted || !user || !session || state.customerId !== user.uid) return;
    startSubscription();
    refreshCustomerNotifications();
  });
  window.addEventListener('evara:session-ready', startVerifiedCustomerSession);
  window.EvaraPageLifecycle?.registerCleanup?.(stopSubscription);
}

function injectPageStyles() {
  if (document.getElementById('customerNotificationsPageStyles')) return;

  const style = document.createElement('style');
  style.id = 'customerNotificationsPageStyles';
  style.textContent = `
    .dashboard-toolbar-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .segmented-control { display:inline-flex; gap:6px; padding:4px; border-radius:999px; background:rgba(148, 163, 184, 0.14); border:1px solid rgba(148, 163, 184, 0.18); }
    .segment-button { border:0; background:transparent; color:var(--text-secondary); font:inherit; font-weight:700; padding:7px 12px; border-radius:999px; cursor:pointer; }
    .segment-button.is-active { background:var(--accent-blue-soft, rgba(59,130,246,0.12)); color:var(--accent-blue, #2563eb); }
    .customer-notification-row { display:grid; gap:12px; padding:16px 18px; border-radius:22px; border:1px solid rgba(148,163,184,0.2); background:rgba(15,23,42,0.02); }
    .customer-notification-row.is-unread { border-color:rgba(37,99,235,0.35); background:rgba(59,130,246,0.04); }
    .customer-notification-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .customer-notification-kicker { margin:0 0 6px; font-size:.66rem; text-transform:uppercase; letter-spacing:.12em; color:var(--text-secondary); }
    .customer-notification-row h3 { margin:0; font-size:1rem; }
    .customer-notification-body { margin:0; color:var(--text-secondary); line-height:1.55; }
    .customer-notification-meta { display:flex; gap:10px; flex-wrap:wrap; color:var(--text-secondary); font-size:.74rem; }
    .customer-notification-priority { display:inline-flex; align-items:center; justify-content:center; min-height:28px; padding:0 10px; border-radius:999px; font-size:.68rem; font-weight:800; letter-spacing:.03em; }
    .customer-notification-priority-normal { background:rgba(148, 163, 184, 0.12); color:var(--text-secondary); }
    .customer-notification-priority-low { background:rgba(59,130,246,0.08); color:var(--accent-blue, #2563eb); }
    .customer-notification-priority-high { background:rgba(245,158,11,0.12); color:#b45309; }
    .customer-notification-priority-urgent { background:rgba(239,68,68,0.12); color:#b91c1c; }
    .customer-notification-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .customer-notification-action { min-height:34px; border:1px solid rgba(148,163,184,0.18); border-radius:999px; background:rgba(15,23,42,0.02); color:var(--text-primary); padding:0 12px; font:inherit; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
    .customer-notification-action.is-link { background:var(--accent-blue-soft, rgba(59,130,246,0.12)); border-color:rgba(96,165,250,0.25); color:var(--accent-blue, #2563eb); }
    @media (max-width: 760px) {
      .dashboard-toolbar-actions { width:100%; justify-content:space-between; }
      .customer-notification-head { flex-direction:column; }
    }
  `;
  document.head.appendChild(style);
}

async function startCustomerNotificationPage() {
  if (initialized) return;
  initialized = true;
  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      resetCustomerState({ loading: false });
      window.location.assign('/login.html');
      return;
    }

    if (state.customerId && state.customerId !== user.uid) resetCustomerState();
    startVerifiedCustomerSession();
  });

  startVerifiedCustomerSession();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startCustomerNotificationPage, { once: true });
} else {
  startCustomerNotificationPage();
}

window.EvaraCustomerNotificationsPage = {
  setFilter,
  refreshCustomerNotifications,
  startCustomerNotificationPage
};
