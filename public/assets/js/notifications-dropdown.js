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
let eventsBound = false;

function removeGlobalShell() {
  document.getElementById('globalNotificationsDropdown')?.remove();
  document.getElementById('globalNotificationsDropdownStyles')?.remove();
}

function clean(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderInboxList(targetId = 'notificationsList') {
  const listNode = document.getElementById(targetId);
  if (!listNode) return;

  const rows = getNotifications();
  if (!rows.length) {
    listNode.innerHTML = '<div class="item muted">No operational notifications yet.</div>';
    return;
  }

  listNode.innerHTML = rows.map((notification) => {
    const unread = !notification.read && notification.state === 'unread' ? ' unread' : '';
    return '<article class="item' + unread + '" tabindex="0" role="button" data-global-notification-id="' + clean(notification.id) + '"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(notification.level || 'info')) + '</span><span class="pill">' + clean(label(notification.audience || 'team')) + '</span></div></article>';
  }).join('');
}

function bindInboxEvents(targetId = 'notificationsList') {
  const listNode = document.getElementById(targetId);
  if (!listNode || listNode.dataset.notificationsBound === 'true') return;
  listNode.dataset.notificationsBound = 'true';

  listNode.addEventListener('click', (event) => {
    const item = event.target.closest('[data-global-notification-id]');
    if (!item) return;
    markNotificationRead(item.getAttribute('data-global-notification-id'));
    renderInboxList(targetId);
  });

  listNode.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('[data-global-notification-id]');
    if (!item) return;
    event.preventDefault();
    markNotificationRead(item.getAttribute('data-global-notification-id'));
    renderInboxList(targetId);
  });
}

function renderDropdown() {
  removeGlobalShell();
  renderInboxList();
}

function openDropdown() {
  dropdownOpen = false;
  removeGlobalShell();
}

function closeDropdown() {
  dropdownOpen = false;
  removeGlobalShell();
}

function toggleDropdown() {
  dropdownOpen = false;
  removeGlobalShell();
}

function bindDropdownEvents() {
  if (eventsBound) return;
  eventsBound = true;
  bindInboxEvents();
}

export function startNotificationsDropdown() {
  stopNotificationsDropdown();
  removeGlobalShell();
  bindDropdownEvents();
  startNotificationEventBridge();

  listenerId = subscribeNotifications(() => {
    renderInboxList();
  });

  renderInboxList();
  return stopNotificationsDropdown;
}

export function stopNotificationsDropdown() {
  if (listenerId) unsubscribeNotifications(listenerId);
  listenerId = null;
  dropdownOpen = false;
  stopNotificationEventBridge();
  removeGlobalShell();
}

window.EvaraNotificationsDropdown = {
  startNotificationsDropdown,
  stopNotificationsDropdown,
  renderDropdown,
  renderInboxList,
  openDropdown,
  closeDropdown,
  toggleDropdown,
  getNotificationSummary
};
