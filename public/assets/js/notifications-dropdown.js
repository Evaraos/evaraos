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

function ensureDropdownStyles() {
  let style = document.getElementById('globalNotificationsDropdownStyles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'globalNotificationsDropdownStyles';
    document.head.appendChild(style);
  }

  style.textContent = `
    .global-notifications-dropdown {
      position: fixed;
      right: max(14px, env(safe-area-inset-right));
      top: max(14px, env(safe-area-inset-top));
      z-index: 2147483000;
      color: var(--eva-nav-text, var(--text-primary, #f8fbff));
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif;
    }

    .global-notifications-bell {
      position: relative;
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, .24);
      background: rgba(255, 255, 255, .74);
      color: #07111f;
      box-shadow: 0 18px 50px rgba(15, 23, 42, .14), inset 0 1px 0 rgba(255, 255, 255, .72);
      backdrop-filter: blur(22px) saturate(160%);
      -webkit-backdrop-filter: blur(22px) saturate(160%);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
    }

    .global-notifications-bell:hover,
    .global-notifications-dropdown.open .global-notifications-bell {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--eva-active-accent, #2563eb) 34%, rgba(148, 163, 184, .24));
      box-shadow: 0 20px 58px rgba(15, 23, 42, .18), 0 0 0 1px color-mix(in srgb, var(--eva-active-accent, #2563eb) 10%, transparent), inset 0 1px 0 rgba(255, 255, 255, .76);
    }

    .global-notifications-icon {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: block;
      background: var(--eva-active-accent, #2563eb);
      box-shadow: 0 0 18px color-mix(in srgb, var(--eva-active-accent, #2563eb) 55%, transparent);
    }

    .global-notifications-count {
      position: absolute;
      right: -4px;
      top: -4px;
      min-width: 20px;
      height: 20px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      padding: 0 6px;
      background: #dc2626;
      color: #fff;
      font-size: 11px;
      font-weight: 950;
      box-shadow: 0 8px 18px rgba(220, 38, 38, .26);
    }

    .global-notifications-panel {
      position: absolute;
      right: 0;
      top: 56px;
      width: min(370px, calc(100vw - 28px));
      max-height: min(520px, calc(100vh - 104px));
      overflow: auto;
      padding: 14px;
      display: none;
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(255,255,255,.94), rgba(248,250,252,.82));
      border: 1px solid rgba(148, 163, 184, .22);
      box-shadow: 0 28px 76px rgba(15, 23, 42, .18), inset 0 1px 0 rgba(255, 255, 255, .82);
      backdrop-filter: blur(28px) saturate(170%);
      -webkit-backdrop-filter: blur(28px) saturate(170%);
      scrollbar-width: none;
    }

    .global-notifications-panel::-webkit-scrollbar { display: none; }
    .global-notifications-dropdown.open .global-notifications-panel { display: block; animation: globalNotificationsIn .22s cubic-bezier(.16,1,.3,1) both; }

    .global-notifications-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .global-notifications-head strong { font-weight: 950; letter-spacing: -.035em; }
    .global-notifications-head a { color: inherit; font-size: 12px; font-weight: 900; text-decoration: none; opacity: .76; }
    .global-notifications-list { display: grid; gap: 10px; }

    .global-notifications-list .item {
      cursor: pointer;
      border-radius: 20px;
      padding: 13px;
      border: 1px solid rgba(148, 163, 184, .18);
      background: rgba(255,255,255,.62);
      color: inherit;
      transition: transform .15s ease, border-color .15s ease, background .15s ease;
    }

    .global-notifications-list .item:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--eva-active-accent, #2563eb) 28%, rgba(148, 163, 184, .18)); }
    .global-notifications-list .item.unread { border-color: rgba(220, 38, 38, .34); }
    .global-notifications-list .item h3 { margin: 0 0 6px; font-size: .94rem; line-height: 1.2; letter-spacing: -.02em; }
    .global-notifications-list .item p { margin: 0; font-size: .82rem; line-height: 1.42; opacity: .72; }
    .global-notifications-list .item .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
    .global-notifications-list .pill { min-height: 24px; padding: 0 9px; border-radius: 999px; display: inline-flex; align-items: center; font-size: .68rem; font-weight: 900; background: rgba(15, 23, 42, .06); }
    .global-notifications-list .muted { opacity: .72; }

    html[data-theme="dark"] .global-notifications-bell,
    body[data-theme="dark"] .global-notifications-bell,
    html.dark .global-notifications-bell,
    body.dark .global-notifications-bell {
      color: #f8fbff;
      background: rgba(255,255,255,.08);
      border-color: rgba(255,255,255,.12);
      box-shadow: 0 18px 50px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08);
    }

    html[data-theme="dark"] .global-notifications-panel,
    body[data-theme="dark"] .global-notifications-panel,
    html.dark .global-notifications-panel,
    body.dark .global-notifications-panel {
      background: linear-gradient(145deg, rgba(17,24,39,.96), rgba(3,7,18,.92));
      border-color: rgba(255,255,255,.11);
      box-shadow: 0 32px 84px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.07);
    }

    html[data-theme="dark"] .global-notifications-list .item,
    body[data-theme="dark"] .global-notifications-list .item,
    html.dark .global-notifications-list .item,
    body.dark .global-notifications-list .item {
      background: rgba(255,255,255,.055);
      border-color: rgba(255,255,255,.10);
    }

    html[data-theme="dark"] .global-notifications-list .pill,
    body[data-theme="dark"] .global-notifications-list .pill {
      background: rgba(255,255,255,.09);
    }

    @keyframes globalNotificationsIn {
      from { opacity: 0; transform: translateY(-6px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (max-width: 520px) {
      .global-notifications-dropdown { right: 12px; top: 12px; }
      .global-notifications-bell { width: 42px; height: 42px; }
      .global-notifications-panel { top: 52px; width: min(350px, calc(100vw - 24px)); border-radius: 24px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .global-notifications-panel,
      .global-notifications-bell,
      .global-notifications-list .item { animation: none !important; transition: none !important; transform: none !important; }
    }
  `;
}

function ensureDropdownShell() {
  let shell = document.getElementById('globalNotificationsDropdown');
  if (shell) return shell;

  ensureDropdownStyles();

  shell = document.createElement('div');
  shell.id = 'globalNotificationsDropdown';
  shell.className = 'global-notifications-dropdown';
  shell.innerHTML = `
    <button id="globalNotificationsBell" class="global-notifications-bell beam-target" type="button" aria-label="Open notifications" aria-expanded="false">
      <span class="global-notifications-icon" aria-hidden="true"></span>
      <span id="globalNotificationsCount" class="global-notifications-count">0</span>
    </button>
    <section id="globalNotificationsPanel" class="global-notifications-panel" aria-label="Recent notifications">
      <div class="global-notifications-head">
        <strong>Notifications</strong>
        <a href="/notifications.html">Open Inbox</a>
      </div>
      <div id="globalNotificationsList" class="global-notifications-list" aria-live="polite">
        <div class="item muted">No notifications yet.</div>
      </div>
    </section>
  `;
  document.body.appendChild(shell);
  return shell;
}

function renderDropdown() {
  const shell = ensureDropdownShell();
  const bell = document.getElementById('globalNotificationsBell');
  const countNode = document.getElementById('globalNotificationsCount');
  const listNode = document.getElementById('globalNotificationsList');
  const summary = getNotificationSummary();
  const rows = getNotifications().slice(0, 6);

  if (bell) bell.setAttribute('aria-expanded', dropdownOpen ? 'true' : 'false');

  if (countNode) {
    const unread = Number(summary.unread || 0);
    countNode.textContent = unread > 99 ? '99+' : String(unread);
    countNode.style.display = unread ? 'grid' : 'none';
  }

  if (!listNode) return;

  if (!rows.length) {
    listNode.innerHTML = '<div class="item muted">No operational notifications yet.</div>';
    shell.classList.toggle('open', dropdownOpen);
    return;
  }

  listNode.innerHTML = rows.map((notification) => {
    const unread = !notification.read && notification.state === 'unread' ? ' unread' : '';
    return '<article class="item' + unread + '" tabindex="0" role="button" data-global-notification-id="' + clean(notification.id) + '"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(notification.level || 'info')) + '</span><span class="pill">' + clean(label(notification.audience || 'team')) + '</span></div></article>';
  }).join('');

  shell.classList.toggle('open', dropdownOpen);
}

function openDropdown() {
  dropdownOpen = true;
  renderDropdown();
}

function closeDropdown() {
  dropdownOpen = false;
  renderDropdown();
}

function toggleDropdown() {
  dropdownOpen = !dropdownOpen;
  renderDropdown();
}

function bindDropdownEvents() {
  if (eventsBound) return;
  eventsBound = true;

  const shell = ensureDropdownShell();
  const bell = document.getElementById('globalNotificationsBell');
  const listNode = document.getElementById('globalNotificationsList');

  bell?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleDropdown();
  });

  listNode?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-global-notification-id]');
    if (!item) return;
    markNotificationRead(item.getAttribute('data-global-notification-id'));
    renderDropdown();
  });

  listNode?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('[data-global-notification-id]');
    if (!item) return;
    event.preventDefault();
    markNotificationRead(item.getAttribute('data-global-notification-id'));
    renderDropdown();
  });

  document.addEventListener('click', (event) => {
    if (!shell.contains(event.target)) closeDropdown();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dropdownOpen) closeDropdown();
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
  dropdownOpen = false;
  stopNotificationEventBridge();
  renderDropdown();
}

window.EvaraNotificationsDropdown = {
  startNotificationsDropdown,
  stopNotificationsDropdown,
  renderDropdown,
  openDropdown,
  closeDropdown,
  toggleDropdown
};
