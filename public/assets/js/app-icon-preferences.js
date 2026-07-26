(() => {
  'use strict';

  const BRAND_VERSION = 'brand-contract-2';
  const OFFICIAL_ICON = '/assets/brand/evaraos-app-icon.png?v=' + BRAND_VERSION;
  const MANIFEST = '/manifest.json?v=' + BRAND_VERSION;
  const LEGACY_KEYS = [
    'evaraos-app-icon-selection-v2','evaraos-app-icon-snapshot-v2',
    'evaraos-custom-app-icon-v2','evaraos-custom-app-icon-v3','evaraos-custom-app-icon-v4','evaraos-custom-app-icon-v5',
    'evaraos-official-app-icon-v1','evaraos-official-app-icon-v2','evaraos-official-app-icon-v3','evaraos-official-app-icon-v4',
    'evaraos-user-app-icon-v1','evaraos-user-app-icon-v2','evaraos-user-app-icon-v3','evaraos-custom-icon-v1'
  ];

  function clearLegacyOverrides() {
    try { LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); } catch {}
  }

  function ensureLink(rel, href, type = 'image/png') {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (type) link.type = type;
    link.href = href;
  }

  function applyCanonicalIcon() {
    ensureLink('icon', OFFICIAL_ICON);
    ensureLink('shortcut icon', OFFICIAL_ICON);
    ensureLink('apple-touch-icon', OFFICIAL_ICON);
    ensureLink('manifest', MANIFEST, 'application/manifest+json');
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach(node => {
      if (node.tagName === 'IMG') node.src = OFFICIAL_ICON;
      else {
        node.style.setProperty('--evaraos-brand-icon', `url("${OFFICIAL_ICON}")`);
        node.style.backgroundImage = `url("${OFFICIAL_ICON}")`;
        node.style.backgroundSize = 'contain';
        node.style.backgroundPosition = 'center';
        node.style.backgroundRepeat = 'no-repeat';
      }
    });
  }

  function restoreOriginal() {
    clearLegacyOverrides();
    applyCanonicalIcon();
    window.dispatchEvent(new CustomEvent('evaraos:app-icon-change', {
      detail: { option: { id: 'none', label: 'Official E Icon' }, snapshot: OFFICIAL_ICON, officialIcon: OFFICIAL_ICON }
    }));
  }

  function boot() {
    clearLegacyOverrides();
    applyCanonicalIcon();
  }

  if (!window.EvaraosAppIcons) {
    window.EvaraosAppIcons = {
      options: [],
      selectOption: restoreOriginal,
      restoreOriginal,
      applySelection: async () => restoreOriginal(),
      repair: applyCanonicalIcon,
      officialIcon: OFFICIAL_ICON,
      currentIconId: () => 'none'
    };
  }

  window.addEventListener('pageshow', applyCanonicalIcon);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();
