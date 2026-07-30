import { NAV_STATE } from './nav-config.js';
import { syncThemeLabel } from './nav-utils-v2.js';
import { applyProgress, atTopOfPage } from './nav-scroll.js';
import { renderNav } from './nav-render-v2.js';
import { bindMenu, openMenu, closeMenu } from './nav-menu.js';
import { bindAllNavEvents } from './nav-events.js';

export function rebindNavAfterRender() {
  bindAllNavEvents();
  bindMenu();
  syncThemeLabel();
}

export function refreshNav() {
  try {
    const wasOpen = document.body.classList.contains('nav-menu-open');
    if (wasOpen) closeMenu(false);

    renderNav();

    const immediate = atTopOfPage() ? 1 : NAV_STATE.progress;
    applyProgress(immediate);
    rebindNavAfterRender();

    if (wasOpen) openMenu();
  } catch (error) {
    console.warn('Nav refresh failed:', error);
  }
}

function scheduleRefresh() {
  queueMicrotask(refreshNav);
  requestAnimationFrame(refreshNav);
}

export function bindRuntimeRefresh() {
  if (NAV_STATE.sessionRefreshBound) return;
  NAV_STATE.sessionRefreshBound = true;

  window.addEventListener('evara:session-ready', scheduleRefresh);

  window.addEventListener('storage', (event) => {
    if (['evaraos-user', 'evaraos-role'].includes(event.key)) scheduleRefresh();
    if (event.key === 'evaraos-appearance') syncThemeLabel();
  });

  window.addEventListener('evara:theme-applied', syncThemeLabel);
  window.addEventListener('evara:appearance-updated', syncThemeLabel);

  window.addEventListener('pageshow', () => {
    NAV_STATE.isNavigating = false;
    window.EvaraTheme?.applyAppearance?.();
    scheduleRefresh();
    applyProgress(1);

    if (window.EvaraLoader && typeof window.EvaraLoader.completeNavigationLoad === 'function') {
      window.EvaraLoader.completeNavigationLoad();
    } else {
      document.body.classList.remove('app-loading');
      document.body.classList.add('app-ready');
    }
  });

  // A page may load nav.js after Firebase and the route guard have already
  // emitted their events. Rebuild once immediately from window.EvaraRouteSession.
  scheduleRefresh();
}
