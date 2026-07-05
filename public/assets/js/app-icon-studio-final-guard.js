(() => {
  'use strict';

  const ASSET_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-icon-final-1';
  const OFFICIAL_KEY = 'evaraos-official-app-icon-v1';
  const CUSTOM_KEYS = [
    OFFICIAL_KEY,
    'evaraos-custom-app-icon-v5',
    'evaraos-custom-app-icon-v4',
    'evaraos-custom-app-icon-v3',
    'evaraos-custom-icon-v1',
    'evaraos-custom-app-icon-v2'
  ];

  function storedIcon() {
    for (const key of CUSTOM_KEYS) {
      try {
        const value = localStorage.getItem(key);
        if (value && value.startsWith('data:image/')) return value;
      } catch {}
    }
    return '';
  }

  function officialIcon() {
    return storedIcon() || ASSET_ICON;
  }

  function ensureRuntimeStyle() {
    let style = document.getElementById('appIconFinalGuardStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'appIconFinalGuardStyle';
      document.head.appendChild(style);
    }
    style.textContent = `
      .app-icon-logo-img,
      .app-icon-preview.is-backgroundless .app-icon-logo-img,
      .app-icon-title-mark.is-backgroundless .app-icon-logo-img{
        display:block!important;opacity:1!important;visibility:visible!important;
        width:92%!important;height:92%!important;max-width:92%!important;max-height:92%!important;
        object-fit:contain!important;object-position:center!important;filter:none!important;mix-blend-mode:normal!important;
        position:relative!important;z-index:10!important;
      }
      .app-icon-preview,.app-icon-title-mark{position:relative!important;display:grid!important;place-items:center!important;overflow:hidden!important;}
      .app-icon-preview.is-backgroundless,.app-icon-title-mark.is-backgroundless{background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.12))!important;}
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

  function forceImages(src = officialIcon()) {
    ensureRuntimeStyle();
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
    document.querySelectorAll('[data-current-icon-name]').forEach((node) => { node.textContent = 'Official Icon'; });
    setLinks(src);
  }

  function saveOfficialIcon(src) {
    try {
      localStorage.setItem(OFFICIAL_KEY, src);
      localStorage.setItem('evaraos-custom-app-icon-v5', src);
    } catch {}
    forceImages(src);
  }

  function bindUpload() {
    document.querySelectorAll('[data-custom-icon-upload]').forEach((input) => {
      if (input.dataset.finalGuardBound === 'true') return;
      input.dataset.finalGuardBound = 'true';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || '');
          if (src.startsWith('data:image/')) saveOfficialIcon(src);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function bindRestore() {
    document.querySelectorAll('[data-restore-original-icon]').forEach((button) => {
      if (button.dataset.finalGuardBound === 'true') return;
      button.dataset.finalGuardBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        forceImages(officialIcon());
      }, true);
    });
  }

  function boot() {
    ensureRuntimeStyle();
    bindUpload();
    bindRestore();
    forceImages();
    setTimeout(forceImages, 300);
    setTimeout(forceImages, 1200);
    const grid = document.querySelector('[data-app-icon-grid]');
    if (grid) new MutationObserver(() => requestAnimationFrame(() => forceImages())).observe(grid, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
  window.EvaraosIconGuard = { forceImages, officialIcon };
})();
