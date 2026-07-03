import {
  startNotificationEventBridge,
  stopNotificationEventBridge,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotifications,
  getNotificationSummary,
  markNotificationRead
} from './operations-notifications.js';

import {
  startMessageNotificationClient,
  stopMessageNotificationClient,
  markMessageNotificationRead
} from './message-notifications-client.js';

import {
  startPushNotifications,
  stopPushNotifications,
  enablePhoneNotifications
} from './push-notifications-client.js';

let listenerId = null;
let dropdownOpen = false;
let eventsBound = false;

function clean(value = '') { return String(value || '').replace(/[<>]/g, ''); }
function label(value = '') { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function ensurePanel() {
  let panel = document.getElementById('globalNotificationsPanel');
  if (panel) return panel;

  panel = document.createElement('section');
  panel.id = 'globalNotificationsPanel';
  panel.className = 'global-notifications-panel glass-card';
  panel.setAttribute('aria-label', 'Recent notifications');
  panel.innerHTML = '<div class="global-notifications-head"><strong>Notifications</strong><div class="global-notifications-actions"><button id="enableDeviceNotifications" type="button">Enable Phone Alerts</button><a href="/notifications_center.html">Open Center</a></div></div><div id="globalNotificationsList" class="global-notifications-list"><div class="item muted">No notifications yet.</div></div>';
  document.body.appendChild(panel);

  if (!document.getElementById('globalNotificationsDropdownStyles')) {
    const style = document.createElement('style');
    style.id = 'globalNotificationsDropdownStyles';
    style.textContent = `.global-notifications-panel{position:fixed;right:max(12px,calc((100vw - min(760px,100vw - 20px))/2));top:calc(var(--eva-topbar-offset,10px) + 72px);z-index:2147483646;width:min(390px,calc(100vw - 24px));max-height:min(560px,72vh);overflow:auto;padding:14px;border-radius:26px;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-8px) scale(.98);transition:opacity .18s ease,transform .2s ease,visibility .18s ease}.global-notifications-panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:none}.global-notifications-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.global-notifications-actions{display:flex;align-items:center;gap:8px}.global-notifications-head a,.global-notifications-head button{color:var(--text-primary);font-size:.76rem;font-weight:850;text-decoration:none}.global-notifications-head button{min-height:34px;padding:0 11px;border-radius:999px}.global-notifications-list{display:grid;gap:10px}.global-notifications-list .item{cursor:pointer;border-radius:18px;padding:12px;border:1px solid var(--liquid-border);background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom))}.global-notifications-list .item.unread{border-color:color-mix(in srgb,var(--accent-blue) 44%,var(--liquid-border))}`;
    document.head.appendChild(style);
  }

  return panel;
}

function renderDropdown() {
  const panel = ensurePanel();
  const countNode = document.getElementById('globalNotificationsCount');
  const listNode = document.getElementById('globalNotificationsList');
  const enableButton = document.getElementById('enableDeviceNotifications');
  const summary = getNotificationSummary();
  const rows = getNotifications().slice(0, 7);

  if (countNode) {
    countNode.textContent = String(summary.unread || 0);
    countNode.hidden = dropdownOpen || !summary.unread;
  }

  if (enableButton) {
    const permission = notificationPermission();
    const tokenReady = Boolean(localStorage.getItem('evaraos-fcm-token'));
    enableButton.hidden = permission === 'granted' && tokenReady;
    enableButton.textContent = permission === 'denied'
      ? 'Alerts Blocked'
      : permission === 'granted'
        ? 'Finish Phone Setup'
        : 'Enable Phone Alerts';
    enableButton.disabled = permission === 'denied';
  }

  if (listNode) {
    listNode.innerHTML = rows.length ? rows.map((notification) => {
      const unread = !notification.read && notification.state === 'unread' ? ' unread' : '';
      return `<article class="item${unread}" data-global-notification-id="${clean(notification.id)}" data-global-notification-url="${clean(notification.actionUrl || '')}"><h3>${clean(notification.title)}</h3><p class="muted">${clean(notification.detail || 'No details.')}</p><div class="row"><span class="pill">${clean(label(notification.level))}</span><span class="pill">${clean(label(notification.audience))}</span></div></article>`;
    }).join('') : '<div class="item muted">No notifications yet.</div>';
  }

  panel.classList.toggle('open', dropdownOpen);
  document.getElementById('globalNotificationsBell')?.setAttribute('aria-expanded', dropdownOpen ? 'true' : 'false');
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  document.addEventListener('click', async (event) => {
    const bell = event.target.closest('#globalNotificationsBell');
    const enableButton = event.target.closest('#enableDeviceNotifications');
    const panel = document.getElementById('globalNotificationsPanel');

    if (bell) {
      event.preventDefault();
      event.stopPropagation();
      dropdownOpen = !dropdownOpen;
      renderDropdown();
      return;
    }

    if (enableButton) {
      event.preventDefault();
      event.stopPropagation();
      await enablePhoneNotifications();
      renderDropdown();
      return;
    }

    const item = event.target.closest('[data-global-notification-id]');
    if (item) {
      const id = item.getAttribute('data-global-notification-id');
      const url = item.getAttribute('data-global-notification-url') || '';
      markNotificationRead(id);
      await markMessageNotificationRead(id).catch(() => {});
      renderDropdown();
      if (url) window.location.assign(url);
      return;
    }

    if (dropdownOpen && panel && !panel.contains(event.target)) {
      dropdownOpen = false;
      renderDropdown();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dropdownOpen) {
      dropdownOpen = false;
      renderDropdown();
    }
  });

  window.addEventListener('evara:message-notification-permission', renderDropdown);
  window.addEventListener('evara:push-status', renderDropdown);
}

export function startNotificationsDropdown() {
  stopNotificationsDropdown();
  ensurePanel();
  bindEvents();
  startNotificationEventBridge();
  startMessageNotificationClient();
  startPushNotifications();
  listenerId = subscribeNotifications(renderDropdown);
  renderDropdown();
  return stopNotificationsDropdown;
}

export function stopNotificationsDropdown() {
  if (listenerId) unsubscribeNotifications(listenerId);
  listenerId = null;
  stopNotificationEventBridge();
  stopMessageNotificationClient();
  stopPushNotifications();
}

window.EvaraNotificationsDropdown = {
  startNotificationsDropdown,
  stopNotificationsDropdown,
  renderDropdown
};
