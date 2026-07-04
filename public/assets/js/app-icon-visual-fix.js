(() => {
  'use strict';
  const APP_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-png-2';
  const MARK = '/assets/brand/evaraos-mark.png?v=brand-png-2';

  function iconImg(src = APP_ICON) {
    const img = document.createElement('img');
    img.className = 'app-icon-logo-img app-icon-logo-img--forced';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
    img.onerror = () => { img.src = APP_ICON; };
    return img;
  }

  function forceVisible() {
    document.documentElement.style.setProperty('--evaraos-app-icon-png', `url("${APP_ICON}")`);
    document.querySelectorAll('.app-icon-preview.is-backgroundless,[data-current-icon-preview], [data-device-preview], [data-device-preview-light], [data-brand-title-mark]').forEach((node) => {
      if (!node) return;
      const isBackgroundless = node.classList.contains('is-backgroundless') || node.matches('[data-current-icon-preview],[data-brand-title-mark]');
      if (isBackgroundless) {
        node.classList.add('app-icon-force-png');
        node.replaceChildren(iconImg(APP_ICON));
      }
    });
    document.querySelectorAll('.app-icon-preview:not(.is-backgroundless):not(.app-icon-force-png)').forEach((node) => {
      if (!node.querySelector('img')) node.appendChild(iconImg(MARK));
    });
  }

  function boot() {
    forceVisible();
    requestAnimationFrame(forceVisible);
    setTimeout(forceVisible, 350);
    setTimeout(forceVisible, 1200);
    const grid = document.querySelector('[data-app-icon-grid]');
    if (grid) new MutationObserver(() => requestAnimationFrame(forceVisible)).observe(grid, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
  window.EvaraosAppIconVisualFix = { forceVisible, appIcon: APP_ICON, mark: MARK };
})();
