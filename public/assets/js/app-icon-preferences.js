(() => {
  'use strict';

  const VERSION = 'brand-canonical-20260726-1';
  const VERSION_KEY = 'evaraos-brand-runtime-version';
  const PERSONAL_KEY = 'evaraos-custom-app-icon-v5';
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
    'evaraos-user-app-icon-v3',
    'evaraos-custom-app-icon-v1',
    'evaraos-custom-app-icon-v2',
    'evaraos-custom-app-icon-v3',
    'evaraos-custom-app-icon-v4',
    'evaraos-custom-icon-v1'
  ];

  function isDataImage(value = '') {
    return /^data:image\/(png|jpeg|webp);base64,/i.test(String(value || ''));
  }

  function safePublishedUrl(value = '') {
    const candidate = String(value || '').trim();
    if (!candidate) return '';
    if (candidate.startsWith('/assets/')) return candidate;
    try {
      const url = new URL(candidate, location.origin);
      if (url.origin === location.origin) return url.href;
      if (['firebasestorage.googleapis.com', 'storage.googleapis.com'].includes(url.hostname)) return url.href;
    } catch {}
    return '';
  }

  function publishedIcon() {
    const configured = safePublishedUrl(window.EvaraAppBuilder?.getConfig?.()?.brand?.appIconUrl);
    return configured || APP_ICON_SRC;
  }

  function personalIcon() {
    try {
      const saved = localStorage.getItem(PERSONAL_KEY) || '';
      return isDataImage(saved) ? saved : '';
    } catch {
      return '';
    }
  }

  function activeIcon() {
    return personalIcon() || publishedIcon();
  }

  function ensureLink(rel, href) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = href;
  }

  function migrateLegacyState() {
    try {
      if (localStorage.getItem(VERSION_KEY) === VERSION) return;
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem('evaraos-app-icon-selection-v2', 'none');
      localStorage.setItem(VERSION_KEY, VERSION);
    } catch {}
  }

  function apply() {
    migrateLegacyState();
    const icon = activeIcon();
    document.documentElement.style.setProperty('--evaraos-brand-icon', `url("${MARK_SRC}")`);
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {
      node.style.setProperty('--evaraos-brand-icon', `url("${MARK_SRC}")`);
      node.style.backgroundImage = `url("${MARK_SRC}")`;
      node.style.backgroundSize = 'contain';
      node.style.backgroundPosition = 'center';
      node.style.backgroundRepeat = 'no-repeat';
    });
    ['icon', 'shortcut icon', 'apple-touch-icon'].forEach((rel) => ensureLink(rel, icon));
    window.EvaraBrand = {
      ...(window.EvaraBrand || {}),
      version: VERSION,
      mark: MARK_SRC,
      appIcon: icon,
      canonicalAppIcon: APP_ICON_SRC,
      apply
    };
    window.dispatchEvent(new CustomEvent('evaraos:brand-applied', {
      detail: { version: VERSION, mark: MARK_SRC, appIcon: icon }
    }));
    return { version: VERSION, mark: MARK_SRC, appIcon: icon };
  }

  function boot() {
    apply();
    window.addEventListener('evara:app-builder-ready', apply);
    window.addEventListener('evara:app-builder-updated', apply);
    window.addEventListener('pageshow', apply);
  }

  window.EvaraosBrandAssets = Object.freeze({
    version: VERSION,
    mark: MARK_SRC,
    canonicalAppIcon: APP_ICON_SRC,
    activeIcon,
    apply
  });
  window.EvaraosAppIcons = {
    ...(window.EvaraosAppIcons || {}),
    applySelection: apply,
    currentIconId: () => personalIcon() ? 'personal' : 'official'
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
