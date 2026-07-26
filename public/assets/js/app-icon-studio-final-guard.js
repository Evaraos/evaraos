(() => {
  'use strict';

  const VERSION = 'brand-canonical-20260726-1';
  const MARK_SRC = `/assets/brand/evaraos-mark.png?v=${VERSION}`;
  const APP_ICON_SRC = `/assets/brand/evaraos-app-icon.png?v=${VERSION}`;
  const LEGACY_KEYS = [
    'evaraos-app-icon-snapshot-v2',
    'evaraos-official-app-icon-v1',
    'evaraos-official-app-icon-v2',
    'evaraos-official-app-icon-v3',
    'evaraos-official-app-icon-v4',
    'evaraos-user-app-icon-v1',
    'evaraos-user-app-icon-v2',
    'evaraos-user-app-icon-v3'
  ];

  function clearLegacyOverrides() {
    try { LEGACY_KEYS.forEach((key) => localStorage.removeItem(key)); } catch {}
  }

  function activeIcon() {
    return window.EvaraosAppIcons?.activeIcon?.()
      || window.EvaraosBrandAssets?.activeIcon?.()
      || APP_ICON_SRC;
  }

  function forceImages() {
    clearLegacyOverrides();
    window.EvaraosAppIcons?.forcePreviewSync?.();
    window.EvaraosBrandAssets?.apply?.();
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {
      node.style.setProperty('--evaraos-brand-icon', `url("${MARK_SRC}")`);
      node.style.backgroundImage = `url("${MARK_SRC}")`;
      node.style.backgroundSize = 'contain';
      node.style.backgroundPosition = 'center';
      node.style.backgroundRepeat = 'no-repeat';
    });
    return activeIcon();
  }

  function boot() {
    forceImages();
    window.addEventListener('evaraos:app-icon-change', forceImages);
    window.addEventListener('evara:app-builder-ready', forceImages);
    window.addEventListener('evara:app-builder-updated', forceImages);
    window.addEventListener('pageshow', forceImages);
  }

  window.EvaraosIconGuard = Object.freeze({
    version: VERSION,
    mark: MARK_SRC,
    canonicalIcon: APP_ICON_SRC,
    activeIcon,
    forceImages,
    repair: forceImages
  });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
