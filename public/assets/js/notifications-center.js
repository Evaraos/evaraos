import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  startNotificationEventBridge,
  stopNotificationEventBridge,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotifications,
  getNotificationSummary,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  archiveNotification,
  resolveNotification,
  NOTIFICATION_AUDIENCES
} from './operations-notifications.js';

const countEl = document.getElementById('noticeCount');
const list = document.getElementById('noticeList');
const statusNode = document.getElementById('noticeStatus');

let notificationListenerId = null;
let activeFilter = 'all';

function clean(v = '') {
  return String(v || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function allowedRole() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();

  return [
    'owner',
    'super_admin',
    'admin',
    'manager',
    'operations_manager',
    'dispatcher',
    'sales_manager',
    'field_manager',
    'staff',
    'sales_rep',
    'technician',
    'cleaner'
  ].includes(role);
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rows() {
  if (activeFilter === 'all') return getNotifications();
  if (activeFilter === 'unread') return getNotifications({ unreadOnly: true });
  return getNotifications({ audience: activeFilter });
}

function card(notification = {}) {
  const unread = !notification.read && notification.state === 'unread'
    ? ' unread'
    : '';

  return '<article class="item notification-item' + unread + '" data-id="' + clean(notification.id) + '"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(notification.level)) + '</span><span class="pill">' + clean(label(notification.priority)) + '</span><span class="pill">' + clean(label(notification.audience)) + '</span></div><div class="row" style="margin-top:10px"><button class="btn btn-theme-secondary beam-target" data-action="read" data-id="' + clean(notification.id) + '">Read</button><button class="btn btn-theme-secondary beam-target" data-action="unread" data-id="' + clean(notification.id) + '">Unread</button><button class="btn btn-theme-secondary beam-target" data-action="resolve" data-id="' + clean(notification.id) + '">Resolve</button><button class="btn btn-theme-secondary beam-target" data-action="archive" data-id="' + clean(notification.id) + '">Archive</button></div></article>';
}

function renderFeed() {
  const notifications = rows();
  const summary = getNotificationSummary();

  if (countEl) {
    countEl.textContent = String(summary.unread || notifications.length || 0);
  }

  if (!list) return;

  if (!notifications.length) {
    list.innerHTML = '<div class="item muted">No operational notifications.</div>';
    return;
  }

  list.innerHTML = notifications.slice(0, 20).map(card).join('');
}

function bindEvents() {
  list?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const id = button.getAttribute('data-id');
    const action = button.getAttribute('data-action');

    if (action === 'read') markNotificationRead(id);
    if (action === 'unread') markNotificationUnread(id);
    if (action === 'resolve') resolveNotification(id);
    if (action === 'archive') archiveNotification(id);

    renderFeed();
  });

  document.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-notification-filter]');
    if (!filter) return;

    activeFilter = filter.getAttribute('data-notification-filter') || 'all';
    renderFeed();
  });

  document.getElementById('notificationsMarkAllRead')?.addEventListener('click', () => {
    markAllNotificationsRead();
    renderFeed();
  });
}

function stopCenter() {
  if (notificationListenerId) unsubscribeNotifications(notificationListenerId);
  notificationListenerId = null;
  stopNotificationEventBridge();
}

function startCenter() {
  stopCenter();
  startNotificationEventBridge();

  notificationListenerId = subscribeNotifications(() => {
    renderFeed();
    status('Operational inbox synced.');
  });

  renderFeed();
}

function init() {
  bindEvents();

  window.EvaraPageLifecycle?.registerCleanup?.(stopCenter);
  window.addEventListener('pagehide', stopCenter);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopCenter();
      window.location.assign('/login.html');
      return;
    }

    if (!allowedRole()) {
      status('Notifications unavailable for this role.');
      return;
    }

    startCenter();
  });
}

window.EvaraNotificationsCenter = {
  startCenter,
  stopCenter,
  renderFeed,
  getNotifications,
  getNotificationSummary,
  audiences: NOTIFICATION_AUDIENCES
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
