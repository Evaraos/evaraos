import {
  startNotificationEventBridge,
  stopNotificationEventBridge,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotifications,
  getNotificationSummary,
  markNotificationRead
} from './operations-notifications.js';

let listenerId = null;
let dropdownOpen = false;

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ensureDropdownShell() {
  let shell = document.getElementById('globalNotificationsDropdown');

  if (shell) return shell;

  shell = document.createElement('div');
  shell.id = 'globalNotificationsDropdown';
  shell.className = 'global-notifications-dropdown';
  shell.innerHTML = '<button id="globalNotificationsBell" class="global-notifications-bell beam-target" type="button" aria-label="Open notifications"><span class="global-notifications-icon">●</span><span id="globalNotificationsCount" class="global-notifications-count">0</span></button><section id="globalNotificationsPanel" class="global-notifications-panel glass-card" aria-label="Recent notifications"><div class="global-notifications-head"><strong>Notifications</strong><a href="./notifications.html">Open Inbox</a></div><div id="globalNotificationsList" class="global-notifications-list"><div class="item muted">No notifications yet.</div></div></section>';
  document.body.appendChild(shell);

  if (!document.getElementById('globalNotificationsDropdownStyles')) {
    const style = document.createElement('style');
    style.id = 'globalNotificationsDropdownStyles';
    style.textContent = `.global-notifications-dropdown{position:fixed;right:18px;top:18px;z-index:9000}.global-notifications-bell{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:var(--text-primary,#fff);box-shadow:0 18px 50px rgba(0,0,0,.28);backdrop-filter:blur(18px);cursor:pointer}.global-notifications-icon{font-size:13px}.global-notifications-count{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;border-radius:999px;display:grid;place-items:center;padding:0 6px;background:rgba(255,70,70,.95);color:#fff;font-size:11px;font-weight:900}.global-notifications-panel{position:absolute;right:0;top:56px;width:min(360px,calc(100vw - 32px));max-height:520px;overflow:auto;padding:14px;display:none}.global-notifications-dropdown.open .global-notifications-panel{display:block}.global-notifications-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.global-notifications-head a{color:var(--text-primary,#fff);font-size:12px;font-weight:900;text-decoration:none}.global-notifications-list{display:grid;gap:10px}.global-notifications-list .item{cursor:pointer}.global-notifications-list .item.unread{border-color:rgba(255,80,80,.35)}`;
    document.head.appendChild(style);
  }

  return shell;
}

function renderDropdown() {
  const shell = ensureDropdownShell();
  const countNode = document.getElementById('globalNotificationsCount');
  const listNode = document.getElementById('globalNotificationsList');
  const summary = getNotificationSummary();
  const rows = getNotifications().slice(0, 6);

  if (countNode) {
    countNode.textContent = String(summary.unread || 0);
    countNode.style.display = summary.unread ? 'grid' : 'none';
  }

  if (!listNode) return;

  if (!rows.length) {
    listNode.innerHTML = '<div class="item muted">No operational notifications yet.</div>';
    return;
  }

  listNode.innerHTML = rows.map((notification) => {
    const unread = !notification.read && notification.state === 'unread' ? ' unread' : '';
    return '<article class="item' + unread + '" data-global-notification-id="' + clean(notification.id) + '"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(notification.level)) + '</span><span class="pill">' + clean(label(notification.audience)) + '</span></div></article>';
  }).join('');

  shell.classList.toggle('open', dropdownOpen);
}

function bindDropdownEvents() {
  const shell = ensureDropdownShell();
  const bell = document.getElementById('globalNotificationsBell');
  const listNode = document.getElementById('globalNotificationsList');

  bell?.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdownOpen = !dropdownOpen;
    shell.classList.toggle('open', dropdownOpen);
  });

  listNode?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-global-notification-id]');
    if (!item) return;

    const id = item.getAttribute('data-global-notification-id');
    markNotificationRead(id);
    renderDropdown();
  });

  document.addEventListener('click', (event) => {
    if (!shell.contains(event.target)) {
      dropdownOpen = false;
      shell.classList.remove('open');
    }
  });
}

export function startNotificationsDropdown() {
  stopNotificationsDropdown();
  ensureDropdownShell();
  bindDropdownEvents();
  startNotificationEventBridge();

  listenerId = subscribeNotifications(() => {
    renderDropdown();
  });

  renderDropdown();
  return stopNotificationsDropdown;
}

export function stopNotificationsDropdown() {
  if (listenerId) unsubscribeNotifications(listenerId);
  listenerId = null;
  stopNotificationEventBridge();
}

window.EvaraNotificationsDropdown = {
  startNotificationsDropdown,
  stopNotificationsDropdown,
  renderDropdown
};
