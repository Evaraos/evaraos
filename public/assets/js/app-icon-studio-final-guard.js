(() => {
  'use strict';

  const ASSET_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-icon-final-3';
  const B64_ICON = '/assets/brand/evaraos-icon-transparent-128.png.b64?v=brand-icon-final-3';
  const OFFICIAL_KEY = 'evaraos-official-app-icon-v2';
  const USER_ICON_KEY = 'evaraos-user-app-icon-v1';
  const LEGACY_CUSTOM_KEYS = [
    'evaraos-custom-app-icon-v5',
    'evaraos-custom-app-icon-v4',
    'evaraos-custom-app-icon-v3',
    'evaraos-custom-icon-v1',
    'evaraos-custom-app-icon-v2'
  ];
  const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);

  function readDataUrl(key) {
    try {
      const value = localStorage.getItem(key);
      return value && value.startsWith('data:image/') ? value : '';
    } catch { return ''; }
  }

  function userIcon() {
    return readDataUrl(USER_ICON_KEY) || LEGACY_CUSTOM_KEYS.map(readDataUrl).find(Boolean) || '';
  }

  function repoIcon() {
    return readDataUrl(OFFICIAL_KEY) || ASSET_ICON;
  }

  function activeIcon() {
    return userIcon() || repoIcon();
  }

  async function hydrateOfficialIcon(force = false) {
    try {
      const saved = readDataUrl(OFFICIAL_KEY);
      if (saved && !force) return saved;
      const response = await fetch(B64_ICON, { cache: 'no-store' });
      if (!response.ok) return ASSET_ICON;
      const b64 = (await response.text()).trim();
      if (!b64 || !b64.startsWith('iVBOR')) return ASSET_ICON;
      const dataUrl = `data:image/png;base64,${b64}`;
      localStorage.setItem(OFFICIAL_KEY, dataUrl);
      return dataUrl;
    } catch {
      return ASSET_ICON;
    }
  }

  function ensureRuntimeStyle() {
    let style = document.getElementById('appIconFinalGuardStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'appIconFinalGuardStyle';
      document.head.appendChild(style);
    }
    style.textContent = `
      [data-owner-icon-tools][hidden]{display:none!important;}
      [data-owner-icon-tools]{display:grid!important;gap:12px!important;margin-top:14px!important;padding:14px!important;border-radius:22px!important;background:linear-gradient(145deg,rgba(227,6,19,.18),rgba(255,255,255,.08))!important;border:1px solid rgba(255,255,255,.28)!important;}
      .app-icon-owner-actions{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;}
      .app-icon-owner-button{display:flex!important;align-items:center!important;gap:12px!important;min-height:60px!important;padding:12px 14px!important;border-radius:18px!important;color:var(--text-primary,#fff)!important;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.14))!important;border:1px solid rgba(255,255,255,.38)!important;cursor:pointer!important;}
      .app-icon-owner-button small{display:block!important;color:var(--text-secondary,rgba(255,255,255,.7))!important;}
      .app-icon-logo-img,
      .app-icon-preview.is-backgroundless .app-icon-logo-img,
      .app-icon-title-mark.is-backgroundless .app-icon-logo-img{
        display:block!important;opacity:1!important;visibility:visible!important;
        width:92%!important;height:92%!important;max-width:92%!important;max-height:92%!important;
        object-fit:contain!important;object-position:center!important;filter:none!important;mix-blend-mode:normal!important;
        position:relative!important;z-index:10!important;
      }
      .app-icon-preview,.app-icon-title-mark{position:relative!important;display:grid!important;place-items:center!important;overflow:hidden!important;}
      .app-icon-preview.is-backgroundless,.app-icon-title-mark.is-backgroundless{background:rgba(255,255,255,.08)!important;background-image:none!important;}
      .settings-hub-card-icon[data-evaraos-brand-icon]{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;}
    `;
  }

  function setLinks(src) {
    ['icon', 'shortcut icon', 'apple-touch-icon'].forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = src;
    });
  }

  function toast(message) {
    let node = document.querySelector('.app-icon-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'app-icon-toast';
      document.body.appendChild(node);
    }
    node.innerHTML = `<strong>Saved</strong><span>${message}</span>`;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1700);
  }

  function forceImages(src = activeIcon()) {
    ensureRuntimeStyle();
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {
      node.style.setProperty('--evaraos-brand-icon', `url("${src}")`);
      node.style.backgroundImage = `url("${src}")`;
      node.style.backgroundSize = 'contain';
      node.style.backgroundRepeat = 'no-repeat';
      node.style.backgroundPosition = 'center';
    });
    document.querySelectorAll('[data-brand-title-mark],[data-current-icon-preview],[data-device-preview],[data-device-preview-light],.app-icon-preview.is-backgroundless').forEach((node) => {
      node.classList.add('is-backgroundless');
      let img = node.querySelector('img.app-icon-logo-img');
      if (!img) {
        img = document.createElement('img');
        img.className = 'app-icon-logo-img';
        img.alt = '';
        node.replaceChildren(img);
      }
      img.src = src;
      img.style.setProperty('display', 'block', 'important');
      img.style.setProperty('opacity', '1', 'important');
      img.style.setProperty('visibility', 'visible', 'important');
      img.style.setProperty('width', '92%', 'important');
      img.style.setProperty('height', '92%', 'important');
      img.style.setProperty('object-fit', 'contain', 'important');
    });
    document.querySelectorAll('[data-current-icon-name]').forEach((node) => { node.textContent = userIcon() ? 'Custom Icon' : 'Official Icon'; });
    setLinks(src);
  }

  function clearUserIcon() {
    try {
      localStorage.removeItem(USER_ICON_KEY);
      LEGACY_CUSTOM_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {}
  }

  function saveUserIcon(src) {
    try { localStorage.setItem(USER_ICON_KEY, src); } catch {}
    forceImages(src);
    toast('Custom icon uploaded');
  }

  function saveOfficialIcon(src) {
    try { localStorage.setItem(OFFICIAL_KEY, src); } catch {}
    clearUserIcon();
    forceImages(src);
    toast('Official default icon updated');
  }

  function fileToDataUrl(file, callback) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast('Use PNG, JPG, or WEBP');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (!src.startsWith('data:image/')) {
        toast('Upload failed');
        return;
      }
      callback(src);
    };
    reader.onerror = () => toast('Upload failed');
    reader.readAsDataURL(file);
  }

  function bindUpload() {
    document.querySelectorAll('[data-custom-icon-upload]').forEach((input) => {
      if (input.dataset.finalGuardBound === 'true') return;
      input.dataset.finalGuardBound = 'true';
      input.addEventListener('change', () => fileToDataUrl(input.files && input.files[0], saveUserIcon), true);
    });

    document.querySelectorAll('[data-official-icon-upload]').forEach((input) => {
      if (input.dataset.finalGuardBound === 'true') return;
      input.dataset.finalGuardBound = 'true';
      input.addEventListener('change', () => fileToDataUrl(input.files && input.files[0], saveOfficialIcon), true);
    });
  }

  function bindRestore() {
    document.querySelectorAll('[data-restore-original-icon]').forEach((button) => {
      if (button.dataset.finalGuardBound === 'true') return;
      button.dataset.finalGuardBound = 'true';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearUserIcon();
        const src = await hydrateOfficialIcon(false);
        forceImages(src);
        toast('Official icon restored');
      }, true);
    });
  }

  function applyOwnerAccess(role = '') {
    const normalized = String(role || '').toLowerCase().replace(/\s+/g, '_');
    const allowed = OWNER_ROLES.has(normalized);
    document.querySelectorAll('[data-owner-icon-tools]').forEach((panel) => {
      panel.hidden = !allowed;
      panel.setAttribute('aria-hidden', String(!allowed));
    });
  }

  function bindOwnerAccess() {
    applyOwnerAccess(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', (event) => applyOwnerAccess(event.detail?.role || ''), { passive: true });
  }

  async function boot() {
    ensureRuntimeStyle();
    bindUpload();
    bindRestore();
    bindOwnerAccess();
    const src = await hydrateOfficialIcon(false);
    forceImages(userIcon() || src);
    setTimeout(() => forceImages(), 300);
    setTimeout(() => forceImages(), 1200);
    const grid = document.querySelector('[data-app-icon-grid]');
    if (grid) new MutationObserver(() => requestAnimationFrame(() => forceImages())).observe(grid, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
  window.EvaraosIconGuard = { forceImages, activeIcon, hydrateOfficialIcon, saveOfficialIcon, saveUserIcon };
})();