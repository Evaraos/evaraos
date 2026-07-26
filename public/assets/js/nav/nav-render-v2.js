import { getMount, buildHref, getVisibleLinks, isCurrentPage } from './nav-utils-v2.js';
import { APP_CATEGORIES, appsByCategory } from '../navigation/app-registry.js';
import { iconSvg, iconNameForApp, iconNameForCategory } from '../ui/icons.js';
import { registryRole } from './nav-authority-v1.js';

const NAV_RENDER_BUILD = 'nav-v61-role-authority';
const CATEGORY_ORDER = [
  APP_CATEGORIES.operations,
  APP_CATEGORIES.organizations,
  APP_CATEGORIES.finance,
  APP_CATEGORIES.customer,
  APP_CATEGORIES.intelligence,
  APP_CATEGORIES.system
];
const CATEGORY_TITLES = {
  operations: 'Operations',
  organizations: 'Organizations',
  finance: 'Finance',
  customer: 'Customer',
  intelligence: 'Executive',
  system: 'System'
};

function clean(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function activeAttrs(route = '') {
  return isCurrentPage(route) ? ' aria-current="page" data-active="true"' : '';
}

function roleLabel(role = '') {
  const value = String(role || 'guest').replaceAll('_', ' ');
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactAction(label, page, icon, active = true) {
  const href = buildHref(page);
  return `<a class="eva-menu-control" href="${href}" data-menu-link="${href}"${active ? activeAttrs(href) : ''}><span class="eva-menu-icon">${iconSvg(icon)}</span><strong>${clean(label)}</strong></a>`;
}

function accountGroup(authed) {
  if (!authed) {
    return `<section class="eva-menu-top-block eva-public-access-block"><div class="eva-top-block-head"><span class="eva-top-block-icon">${iconSvg('account')}</span><div><p>ACCESS</p><h3>Enter Evaraos</h3></div></div><div class="eva-account-strip eva-access-strip">${[['Login', 'login.html', 'login'], ['Signup', 'signup.html', 'signup'], ['Apply', 'staff_application.html', 'applications']].map((item) => compactAction(...item, false)).join('')}</div></section>`;
  }
  const actions = [['Account', 'settings/account.html', 'account'], ['Settings', 'settings-v2.html', 'settings'], ['Alerts', 'notifications_center.html', 'bell'], ['Workspace', 'settings/workspace.html', 'workspace']];
  return `<section class="eva-menu-top-block eva-menu-glass-group" data-glass="card"><div class="eva-top-block-head"><span class="eva-top-block-icon">${iconSvg('account')}</span><div><p>ACCOUNT</p><h3>Your Evaraos controls</h3></div></div><div class="eva-account-strip">${actions.map((item) => compactAction(...item)).join('')}<a class="eva-menu-control eva-logout-control" href="#logout" id="evaLogoutBtn" data-action="logout"><span class="eva-menu-icon">${iconSvg('logout')}</span><strong>Logout</strong></a></div></section>`;
}

function appSections(actualRole) {
  const groups = appsByCategory(registryRole(actualRole));
  return CATEGORY_ORDER.map((category) => {
    const apps = (groups[category] || []).filter((app) => app.id !== 'settings');
    if (!apps.length) return '';
    return `<section class="eva-app-section"><div class="eva-app-section-head"><span>${iconSvg(iconNameForCategory(category))}</span><strong>${clean(CATEGORY_TITLES[category] || category)}</strong><small>${apps.length}</small></div><div class="eva-app-list">${apps.map((app) => {
      const href = buildHref(app.route);
      return `<a class="eva-app-link" href="${href}" data-menu-link="${href}"${activeAttrs(href)}><span>${iconSvg(iconNameForApp(app.id))}</span><strong>${clean(app.title)}</strong><small>${iconSvg('arrowRight')}</small></a>`;
    }).join('')}</div></section>`;
  }).join('');
}

function aiGroup(authed) {
  const href = buildHref('ai.html');
  return `<section class="eva-menu-search-bottom eva-menu-glass-group" data-glass="card"><div class="eva-ai-prompt-head"><span class="eva-ai-orb">${iconSvg('ai')}</span><div><strong>Evaraos AI</strong><small>Search or open the assistant.</small></div><a class="eva-ai-launch-arrow" href="${href}" data-menu-link="${href}" aria-label="Open Evaraos AI">${iconSvg('arrowRight')}</a></div><form class="eva-search-shell" id="evaAiPromptForm"><span class="eva-search-icon">${iconSvg('search')}</span><input id="evaSearchInput" type="search" autocomplete="off" placeholder="${authed ? 'Search apps, pages, and tools' : 'Search access and onboarding'}"/><button class="eva-ai-send-btn" id="evaAiSendBtn" type="submit" aria-label="Search Evaraos">${iconSvg('arrowUp')}</button></form><div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div></section>`;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();
  const profile = groups.authority?.profile || {};
  const actualRole = groups.role || 'guest';
  const fallbackAvatar = iconSvg('account', 'eva-drawer-avatar-icon');
  const avatar = profile.image ? `<img src="${clean(profile.image)}" alt="${clean(profile.name)}" />` : fallbackAvatar;
  const menuContent = groups.authed && profile.image
    ? `<img class="eva-top-avatar" src="${clean(profile.image)}" alt="${clean(profile.name)}" />`
    : iconSvg('account', 'eva-top-action-icon');

  mount.innerHTML = `<div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}" data-navigation-role="${clean(actualRole)}"><header class="eva-nav-shell is-visible" id="evaNavShell"><div class="eva-nav-pill" id="evaNavPill"><div class="eva-menu-zone" id="evaMenuZone"><button class="eva-profile-trigger eva-top-action${groups.authed && profile.image ? ' has-avatar' : ''}" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open Evaraos menu">${menuContent}</button></div><button class="eva-top-alert eva-top-action" id="globalNotificationsBell" type="button" aria-expanded="false" aria-label="Open notifications">${iconSvg('bell', 'eva-top-action-icon')}<span id="globalNotificationsCount" class="eva-alert-count" hidden>0</span></button></div></header><div class="eva-backdrop" id="evaBackdrop"></div><aside class="eva-menu-panel" id="evaMenuPanel" aria-label="Evaraos menu"><div class="eva-drawer-profile"><div class="eva-drawer-avatar">${avatar}</div><div class="eva-drawer-identity"><strong>${clean(profile.name || 'Evaraos User')}</strong><span>${clean(roleLabel(actualRole))} · Adaptive Glass</span></div><div class="eva-drawer-actions"><button type="button" id="evaMenuThemeBtn" data-theme-toggle="true" aria-label="Change appearance" title="Change appearance">${iconSvg('appearance')}</button><button type="button" id="evaMenuCloseBtn" aria-label="Close menu">${iconSvg('close')}</button></div></div><nav class="eva-menu-apps" id="evaLinks" data-nav-role="${clean(actualRole)}">${accountGroup(groups.authed)}${groups.authed ? appSections(actualRole) : ''}</nav>${aiGroup(groups.authed)}</aside></div>`;

  requestAnimationFrame(() => window.EvaraTheme?.refreshAdaptiveGlass?.());
  return true;
}
