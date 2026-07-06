(() => {
  'use strict';

  const ASSET_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-icon-final-5';
  const OFFICIAL_KEY = 'evaraos-official-app-icon-v3';
  const USER_ICON_KEY = 'evaraos-user-app-icon-v2';
  const BAD_LEGACY_KEYS = ['evaraos-official-app-icon-v1','evaraos-official-app-icon-v2','evaraos-user-app-icon-v1','evaraos-custom-app-icon-v5','evaraos-custom-app-icon-v4','evaraos-custom-app-icon-v3','evaraos-custom-icon-v1','evaraos-custom-app-icon-v2'];
  const OWNER_ROLES = new Set(['owner','super_admin','admin']);

  function readDataUrl(key) {
    try {
      const value = localStorage.getItem(key);
      return value && /^data:image\/(png|jpeg|webp);base64,/.test(value) ? value : '';
    } catch { return ''; }
  }

  function writeDataUrl(key, src) {
    if (!src || !/^data:image\/(png|jpeg|webp);base64,/.test(src)) return false;
    try { localStorage.setItem(key, src); return true; } catch { return false; }
  }

  function clearBadLegacy() {
    try { BAD_LEGACY_KEYS.forEach((key) => localStorage.removeItem(key)); } catch {}
  }

  function userIcon() { return readDataUrl(USER_ICON_KEY); }

  function findEmbeddedOfficialIcon() {
    const candidates = [
      '[data-app-icon-choice="none"] img.app-icon-logo-img',
      '[data-current-icon-preview] img.app-icon-logo-img',
      '.app-icon-choice img.app-icon-logo-img',
      '.app-icon-logo-img'
    ];
    for (const selector of candidates) {
      const img = document.querySelector(selector);
      const src = img?.getAttribute('src') || img?.src || '';
      if (/^data:image\/(png|jpeg|webp);base64,/.test(src)) return src;
    }
    return '';
  }

  function officialIcon() {
    return readDataUrl(OFFICIAL_KEY) || findEmbeddedOfficialIcon() || ASSET_ICON;
  }

  function activeIcon() { return userIcon() || officialIcon(); }

  async function hydrateOfficialIcon(force = false) {
    if (!force) {
      const saved = readDataUrl(OFFICIAL_KEY);
      if (saved) return saved;
    }
    const embedded = findEmbeddedOfficialIcon();
    if (embedded) {
      writeDataUrl(OFFICIAL_KEY, embedded);
      return embedded;
    }
    return ASSET_ICON;
  }

  function ensureRuntimeStyle() {
    let style = document.getElementById('appIconFinalGuardStyle');
    if (!style) { style = document.createElement('style'); style.id = 'appIconFinalGuardStyle'; document.head.appendChild(style); }
    style.textContent = `
      .app-icon-studio-shell{isolation:isolate!important;}
      .app-icon-current-card,.app-icon-background-card,.app-icon-tips-card,.app-icon-device-card{position:relative!important;overflow:hidden!important;}
      .app-icon-current-card:before,.app-icon-background-card:before{content:""!important;position:absolute!important;inset:-35%!important;background:radial-gradient(circle at 18% 18%,rgba(255,255,255,.34),transparent 30%),radial-gradient(circle at 82% 28%,rgba(242,23,45,.18),transparent 34%),radial-gradient(circle at 45% 100%,rgba(0,0,0,.18),transparent 38%)!important;pointer-events:none!important;z-index:-1!important;}
      [data-owner-icon-tools][hidden]{display:none!important;}
      [data-owner-icon-tools]{display:grid!important;gap:12px!important;margin-top:14px!important;padding:14px!important;border-radius:24px!important;background:linear-gradient(145deg,rgba(227,6,19,.22),rgba(255,255,255,.10))!important;border:1px solid rgba(255,255,255,.32)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 18px 44px rgba(0,0,0,.16)!important;}
      .app-icon-owner-actions{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;}
      .app-icon-owner-button{display:flex!important;align-items:center!important;gap:12px!important;min-height:60px!important;padding:12px 14px!important;border-radius:18px!important;color:var(--text-primary,#fff)!important;background:linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))!important;border:1px solid rgba(255,255,255,.42)!important;cursor:pointer!important;}
      .app-icon-owner-button small{display:block!important;color:var(--text-secondary,rgba(255,255,255,.72))!important;}
      .app-icon-logo-img,.app-icon-preview .app-icon-logo-img,.app-icon-title-mark .app-icon-logo-img{display:block!important;opacity:1!important;visibility:visible!important;width:88%!important;height:88%!important;max-width:92%!important;max-height:92%!important;object-fit:contain!important;object-position:center!important;filter:drop-shadow(0 12px 22px rgba(0,0,0,.22))!important;mix-blend-mode:normal!important;position:relative!important;z-index:10!important;}
      .app-icon-current-preview .app-icon-logo-img{width:94%!important;height:94%!important;}
      .app-icon-preview,.app-icon-title-mark{position:relative!important;display:grid!important;place-items:center!important;overflow:hidden!important;}
      .app-icon-preview:after,.app-icon-title-mark:after{content:""!important;position:absolute!important;inset:0!important;border-radius:inherit!important;background:linear-gradient(145deg,rgba(255,255,255,.42),transparent 34%,rgba(255,255,255,.10) 100%)!important;pointer-events:none!important;z-index:11!important;}
      .app-icon-preview.is-backgroundless,.app-icon-title-mark.is-backgroundless{background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.10))!important;background-image:none!important;}
      .settings-hub-card-icon[data-evaraos-brand-icon]{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;}
      .owner-edit-fab{position:fixed!important;right:18px!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;z-index:9998!important;display:none!important;align-items:center!important;gap:9px!important;padding:12px 14px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(227,6,19,.88),rgba(70,0,8,.82))!important;color:#fff!important;border:1px solid rgba(255,255,255,.45)!important;box-shadow:0 18px 44px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.32)!important;text-decoration:none!important;font-weight:900!important;backdrop-filter:blur(22px)!important;-webkit-backdrop-filter:blur(22px)!important;}
      .owner-edit-fab.is-visible{display:flex!important;}
    `;
  }

  function ensureOwnerPanel() {
    if (document.querySelector('[data-owner-icon-tools]')) return;
    const host = document.querySelector('.app-icon-current-copy') || document.querySelector('.app-icon-current-card');
    if (!host) return;
    const panel = document.createElement('aside');
    panel.className = 'app-icon-owner-tools';
    panel.dataset.ownerIconTools = 'true';
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div><p class="settings-kicker">OWNER EDITOR</p><h2>Live default icon control</h2><p>Upload the official default icon used by Restore, previews, settings, and favicon on this device.</p></div><div class="app-icon-owner-actions"><label class="app-icon-owner-button"><input type="file" accept="image/png,image/jpeg,image/webp" data-official-icon-upload hidden><span><strong>Upload Official Default Icon</strong><small>Owner/admin only. Replaces the default restore source.</small></span></label></div>';
    host.appendChild(panel);
  }

  function ensureOwnerFab() {
    if (document.querySelector('.owner-edit-fab')) return;
    const fab = document.createElement('a');
    fab.className = 'owner-edit-fab';
    fab.href = '/website-builder.html';
    fab.textContent = 'Edit Page';
    document.body.appendChild(fab);
  }

  function setLinks(src) {
    ['icon','shortcut icon','apple-touch-icon'].forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
      link.type = 'image/png'; link.href = src;
    });
  }

  function toast(message) {
    let node = document.querySelector('.app-icon-toast');
    if (!node) { node = document.createElement('div'); node.className = 'app-icon-toast'; document.body.appendChild(node); }
    node.innerHTML = `<strong>Saved</strong><span>${message}</span>`;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1700);
  }

  function patchImage(img, src) {
    if (!img) return;
    const current = img.getAttribute('src') || img.src || '';
    if (!/^data:image\//.test(current) || current !== src) img.src = src;
    img.onerror = () => { img.onerror = null; img.src = officialIcon(); };
    img.style.setProperty('display','block','important');
    img.style.setProperty('opacity','1','important');
    img.style.setProperty('visibility','visible','important');
    img.style.setProperty('object-fit','contain','important');
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
    document.querySelectorAll('[data-brand-title-mark],[data-current-icon-preview],[data-device-preview],[data-device-preview-light],.app-icon-preview').forEach((node) => {
      let img = node.querySelector('img.app-icon-logo-img');
      if (!img) { img = document.createElement('img'); img.className = 'app-icon-logo-img'; img.alt = ''; node.appendChild(img); }
      patchImage(img, src);
    });
    document.querySelectorAll('[data-current-icon-name]').forEach((node) => { node.textContent = userIcon() ? 'Custom Icon' : 'Official Icon'; });
    setLinks(src);
  }

  function clearUserIcon() { try { localStorage.removeItem(USER_ICON_KEY); clearBadLegacy(); } catch {} }
  function saveUserIcon(src) { if (writeDataUrl(USER_ICON_KEY, src)) { forceImages(src); toast('Custom icon uploaded'); } }
  function saveOfficialIcon(src) { if (writeDataUrl(OFFICIAL_KEY, src)) { clearUserIcon(); writeDataUrl(OFFICIAL_KEY, src); forceImages(src); toast('Official default icon updated'); } }

  function fileToDataUrl(file, callback) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Use PNG, JPG, or WEBP'); return; }
    const reader = new FileReader();
    reader.onload = () => { const src = String(reader.result || ''); /^data:image\/(png|jpeg|webp);base64,/.test(src) ? callback(src) : toast('Upload failed'); };
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
    document.querySelectorAll('[data-owner-icon-tools]').forEach((panel) => { panel.hidden = !allowed; panel.setAttribute('aria-hidden', String(!allowed)); });
    document.querySelector('.owner-edit-fab')?.classList.toggle('is-visible', allowed);
  }

  function bindOwnerAccess() {
    applyOwnerAccess(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', (event) => applyOwnerAccess(event.detail?.role || ''), { passive: true });
  }

  async function boot() {
    clearBadLegacy();
    ensureRuntimeStyle();
    ensureOwnerPanel();
    ensureOwnerFab();
    setTimeout(bindUpload, 60);
    bindRestore();
    bindOwnerAccess();
    const src = await hydrateOfficialIcon(false);
    forceImages(userIcon() || src);
    setTimeout(() => { bindUpload(); forceImages(); }, 300);
    setTimeout(() => forceImages(), 1200);
    const grid = document.querySelector('[data-app-icon-grid]');
    if (grid) new MutationObserver(() => requestAnimationFrame(() => forceImages())).observe(grid, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
  window.EvaraosIconGuard = { forceImages, activeIcon, hydrateOfficialIcon, saveOfficialIcon, saveUserIcon };
})();