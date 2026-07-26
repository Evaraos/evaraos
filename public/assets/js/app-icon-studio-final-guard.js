(() => {
  'use strict';

  const ASSET_ICON = '/assets/img/icon-512.png?v=brand-logo-1';
  const OFFICIAL_KEY = 'evaraos-official-app-icon-v4';
  const USER_ICON_KEY = 'evaraos-user-app-icon-v3';
  const BAD_LEGACY_KEYS = ['evaraos-official-app-icon-v1','evaraos-official-app-icon-v2','evaraos-official-app-icon-v3','evaraos-user-app-icon-v1','evaraos-user-app-icon-v2','evaraos-custom-app-icon-v5','evaraos-custom-app-icon-v4','evaraos-custom-app-icon-v3','evaraos-custom-icon-v1','evaraos-custom-app-icon-v2'];
  const OWNER_ROLES = new Set(['owner','super_admin','admin']);
  let bootOfficial = '';

  const isData = (src = '') => /^data:image\/(png|jpeg|webp);base64,/.test(String(src || '')) && !String(src).includes('UEsDB');
  function readDataUrl(key) { try { const value = localStorage.getItem(key); return isData(value) ? value : ''; } catch { return ''; } }
  function writeDataUrl(key, src) { if (!isData(src)) return false; try { localStorage.setItem(key, src); return true; } catch { return false; } }
  function clearBadLegacy() { try { BAD_LEGACY_KEYS.forEach((key) => localStorage.removeItem(key)); } catch {} }
  function userIcon() { return readDataUrl(USER_ICON_KEY); }
  function officialIcon() { return readDataUrl(OFFICIAL_KEY) || bootOfficial || ASSET_ICON; }
  function activeIcon() { return userIcon() || officialIcon(); }

  function findEmbeddedOfficialIcon() {
    for (const img of Array.from(document.querySelectorAll('img.app-icon-logo-img'))) {
      const src = img.getAttribute('src') || img.src || '';
      if (isData(src)) return src;
    }
    return '';
  }

  async function hydrateOfficialIcon(force = false) {
    if (!force) {
      const saved = readDataUrl(OFFICIAL_KEY);
      if (saved) return saved;
    }
    const embedded = findEmbeddedOfficialIcon();
    if (embedded) { bootOfficial = embedded; writeDataUrl(OFFICIAL_KEY, embedded); return embedded; }
    return ASSET_ICON;
  }

  function ensureRuntimeStyle() {
    let style = document.getElementById('appIconFinalGuardStyle');
    if (!style) { style = document.createElement('style'); style.id = 'appIconFinalGuardStyle'; document.head.appendChild(style); }
    style.textContent = `
      .app-icon-studio-shell{isolation:isolate!important;}
      .app-icon-current-card,.app-icon-background-card,.app-icon-tips-card,.app-icon-device-card{position:relative!important;overflow:hidden!important;}
      .app-icon-current-card:before,.app-icon-background-card:before{content:""!important;position:absolute!important;inset:-35%!important;background:radial-gradient(circle at 18% 18%,rgba(255,255,255,.36),transparent 30%),radial-gradient(circle at 82% 28%,rgba(242,23,45,.18),transparent 34%),radial-gradient(circle at 45% 100%,rgba(0,0,0,.20),transparent 38%)!important;pointer-events:none!important;z-index:-1!important;}
      [data-owner-icon-tools][hidden]{display:none!important;}
      [data-owner-icon-tools]{display:grid!important;gap:12px!important;margin-top:14px!important;padding:14px!important;border-radius:24px!important;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.08))!important;border:1px solid rgba(255,255,255,.34)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 18px 44px rgba(0,0,0,.16)!important;}
      .app-icon-owner-actions{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;}
      .app-icon-owner-button{display:flex!important;align-items:center!important;gap:12px!important;min-height:60px!important;padding:12px 14px!important;border-radius:18px!important;color:var(--text-primary,#fff)!important;background:linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))!important;border:1px solid rgba(255,255,255,.42)!important;cursor:pointer!important;}
      .app-icon-owner-button small{display:block!important;color:var(--text-secondary,rgba(255,255,255,.72))!important;}
      .app-icon-logo-img,.app-icon-preview .app-icon-logo-img,.app-icon-title-mark .app-icon-logo-img{display:block!important;opacity:1!important;visibility:visible!important;width:88%!important;height:88%!important;max-width:92%!important;max-height:92%!important;object-fit:contain!important;object-position:center!important;filter:drop-shadow(0 12px 22px rgba(0,0,0,.22))!important;mix-blend-mode:normal!important;position:relative!important;z-index:10!important;}
      .app-icon-logo-img.is-broken{display:none!important;}
      .app-icon-letter-fallback{position:absolute!important;z-index:10!important;font-weight:950!important;font-style:italic!important;font-size:2.6rem!important;line-height:1!important;color:#ff2638!important;filter:drop-shadow(0 10px 20px rgba(0,0,0,.24))!important;}
      .app-icon-current-preview .app-icon-letter-fallback{font-size:4.2rem!important;}
      .app-icon-current-preview .app-icon-logo-img{width:94%!important;height:94%!important;}
      .app-icon-preview,.app-icon-title-mark{position:relative!important;display:grid!important;place-items:center!important;overflow:hidden!important;}
      .app-icon-preview:after,.app-icon-title-mark:after{content:""!important;position:absolute!important;inset:0!important;border-radius:inherit!important;background:linear-gradient(145deg,rgba(255,255,255,.42),transparent 34%,rgba(255,255,255,.10) 100%)!important;pointer-events:none!important;z-index:11!important;}
      .app-icon-preview.is-backgroundless,.app-icon-title-mark.is-backgroundless{background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.10))!important;background-image:none!important;}
      .settings-hub-card-icon[data-evaraos-brand-icon]{background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important;}
      .owner-edit-fab{position:fixed!important;right:18px!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;z-index:9998!important;display:none!important;align-items:center!important;gap:9px!important;padding:12px 14px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.12))!important;color:var(--text-primary,#fff)!important;border:1px solid rgba(255,255,255,.45)!important;box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.34)!important;text-decoration:none!important;font-weight:900!important;backdrop-filter:blur(24px) saturate(1.35)!important;-webkit-backdrop-filter:blur(24px) saturate(1.35)!important;}
      .owner-edit-fab.is-visible{display:flex!important;}
    `;
  }

  function ensureOwnerPanel() {
    if (document.querySelector('[data-owner-icon-tools]')) return;
    const host = document.querySelector('.app-icon-current-copy') || document.querySelector('.app-icon-current-card');
    if (!host) return;
    const panel = document.createElement('aside');
    panel.className = 'app-icon-owner-tools'; panel.dataset.ownerIconTools = 'true'; panel.hidden = true; panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div><p class="settings-kicker">OWNER EDITOR</p><h2>Live default icon control</h2><p>Upload the official default icon used by Restore, previews, settings, and favicon on this device.</p></div><div class="app-icon-owner-actions"><label class="app-icon-owner-button"><input type="file" accept="image/png,image/jpeg,image/webp" data-official-icon-upload hidden><span><strong>Upload Official Default Icon</strong><small>Owner/admin only. Replaces the default restore source.</small></span></label></div>';
    host.appendChild(panel);
  }

  function ensureOwnerFab() {
    if (document.querySelector('.owner-edit-fab')) return;
    const fab = document.createElement('a'); fab.className = 'owner-edit-fab'; fab.href = '/website-builder.html'; fab.textContent = 'Edit Page'; document.body.appendChild(fab);
  }

  function setLinks(src) { ['icon','shortcut icon','apple-touch-icon'].forEach((rel) => { let link = document.querySelector(`link[rel="${rel}"]`); if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); } link.type = 'image/png'; link.href = src; }); }
  function toast(message) { let node = document.querySelector('.app-icon-toast'); if (!node) { node = document.createElement('div'); node.className = 'app-icon-toast'; document.body.appendChild(node); } node.innerHTML = `<strong>Saved</strong><span>${message}</span>`; node.classList.add('is-visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1700); }

  function ensureFallback(node) {
    let fallback = node.querySelector('.app-icon-letter-fallback');
    if (!fallback) { fallback = document.createElement('span'); fallback.className = 'app-icon-letter-fallback'; fallback.textContent = 'E'; node.appendChild(fallback); }
    return fallback;
  }

  function patchImage(img, src, node) {
    if (!img || !node) return;
    const fallback = ensureFallback(node);
    fallback.hidden = true;
    img.classList.remove('is-broken');
    img.onerror = () => { img.classList.add('is-broken'); fallback.hidden = false; };
    img.src = src;
    img.style.setProperty('display','block','important'); img.style.setProperty('opacity','1','important'); img.style.setProperty('visibility','visible','important'); img.style.setProperty('object-fit','contain','important');
  }

  function forceImages(src = activeIcon()) {
    ensureRuntimeStyle();
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => { node.style.setProperty('--evaraos-brand-icon', `url("${src}")`); node.style.backgroundImage = `url("${src}")`; node.style.backgroundSize = 'contain'; node.style.backgroundRepeat = 'no-repeat'; node.style.backgroundPosition = 'center'; });
    document.querySelectorAll('[data-brand-title-mark],[data-current-icon-preview],[data-device-preview],[data-device-preview-light],.app-icon-preview').forEach((node) => { let img = node.querySelector('img.app-icon-logo-img'); if (!img) { img = document.createElement('img'); img.className = 'app-icon-logo-img'; img.alt = ''; node.appendChild(img); } patchImage(img, src, node); });
    document.querySelectorAll('[data-current-icon-name]').forEach((node) => { node.textContent = userIcon() ? 'Custom Icon' : 'Official Icon'; });
    setLinks(src);
  }

  function clearUserIcon() { try { localStorage.removeItem(USER_ICON_KEY); clearBadLegacy(); } catch {} }
  function saveUserIcon(src) { if (writeDataUrl(USER_ICON_KEY, src)) { forceImages(src); toast('Custom icon uploaded'); } }
  function saveOfficialIcon(src) { if (writeDataUrl(OFFICIAL_KEY, src)) { clearUserIcon(); writeDataUrl(OFFICIAL_KEY, src); forceImages(src); toast('Official default icon updated'); } }
  function fileToDataUrl(file, callback) { if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Use PNG, JPG, or WEBP'); return; } const reader = new FileReader(); reader.onload = () => { const src = String(reader.result || ''); isData(src) ? callback(src) : toast('Upload failed'); }; reader.onerror = () => toast('Upload failed'); reader.readAsDataURL(file); }
  function bindUpload() { document.querySelectorAll('[data-custom-icon-upload]').forEach((input) => { if (input.dataset.finalGuardBound === 'true') return; input.dataset.finalGuardBound = 'true'; input.addEventListener('change', () => fileToDataUrl(input.files && input.files[0], saveUserIcon), true); }); document.querySelectorAll('[data-official-icon-upload]').forEach((input) => { if (input.dataset.finalGuardBound === 'true') return; input.dataset.finalGuardBound = 'true'; input.addEventListener('change', () => fileToDataUrl(input.files && input.files[0], saveOfficialIcon), true); }); }
  function bindRestore() { document.querySelectorAll('[data-restore-original-icon]').forEach((button) => { if (button.dataset.finalGuardBound === 'true') return; button.dataset.finalGuardBound = 'true'; button.addEventListener('click', async (event) => { event.preventDefault(); event.stopImmediatePropagation(); clearUserIcon(); const src = await hydrateOfficialIcon(false); forceImages(src); toast('Official icon restored'); }, true); }); }
  function applyOwnerAccess(role = '') { const normalized = String(role || '').toLowerCase().replace(/\s+/g, '_'); const allowed = OWNER_ROLES.has(normalized); document.querySelectorAll('[data-owner-icon-tools]').forEach((panel) => { panel.hidden = !allowed; panel.setAttribute('aria-hidden', String(!allowed)); }); document.querySelector('.owner-edit-fab')?.classList.toggle('is-visible', allowed); }
  function bindOwnerAccess() { applyOwnerAccess(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || ''); window.addEventListener('evara:session-ready', (event) => applyOwnerAccess(event.detail?.role || ''), { passive: true }); }

  async function repair() { const src = await hydrateOfficialIcon(false); forceImages(userIcon() || src); }
  async function boot() { clearBadLegacy(); ensureRuntimeStyle(); ensureOwnerPanel(); ensureOwnerFab(); setTimeout(bindUpload, 60); bindRestore(); bindOwnerAccess(); await repair(); setTimeout(() => { bindUpload(); repair(); }, 300); setTimeout(repair, 1200); const grid = document.querySelector('[data-app-icon-grid]'); if (grid) new MutationObserver(() => requestAnimationFrame(repair)).observe(grid, { childList: true, subtree: true }); }

  window.addEventListener('pageshow', () => setTimeout(repair, 60));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(repair, 60); });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
  window.EvaraosIconGuard = { forceImages, activeIcon, hydrateOfficialIcon, saveOfficialIcon, saveUserIcon, repair };
})();