(() => {
  'use strict';

  const VERSION = 'brand-canonical-20260726-1';
  const KEY = 'evaraos-app-icon-selection-v2';
  const PERSONAL_KEY = 'evaraos-custom-app-icon-v5';
  const APP_ICON_SRC = `/assets/brand/evaraos-app-icon.png?v=${VERSION}`;
  const FAVICON_SRC = '/favicon.ico';
  const OPTIONS = [["none","Official Icon","Official Evaraos app icon"],["pearlWhite","Pearl White","Clean premium light surface"],["pianoBlack","Piano Black","Deep reflective black glass"],["crimsonGlass","Crimson Glass","Signature red Liquid Glass"],["graphite","Graphite","Executive graphite"],["titanium","Titanium","Brushed silver depth"],["midnightBlue","Midnight Blue","Dark navy finish"],["carbonFiber","Carbon Fiber","Technical woven carbon"],["rubyGlass","Ruby Glass","Polished ruby translucency"],["frostedClear","Frosted Clear","Soft translucent glass"],["satinSilver","Satin Silver","Muted premium metal"],["deepNavy","Deep Navy","Near-black blue depth"],["matteBlack","Matte Black","Minimal matte black"],["softIvory","Soft Ivory","Warm clean neutral"],["burgundy","Burgundy","Deep red luxury finish"],["liquidGlassWaves","Liquid Glass Waves","Slow refractive wave motion"],["auroraFlow","Aurora Flow","Adaptive color flow"],["orbitRings","Orbit Rings","Precision rings"],["neuralGrid","Neural Grid","Connected system grid"],["energyPulse","Energy Pulse","Focused energy pulse"],["redPlasma","Red Plasma","Fluid plasma field"],["lightSweepBg","Light Sweep","Clean highlight sweep"],["crystalRefraction","Crystal Refraction","Faceted light shifts"],["adaptiveGradient","Adaptive Gradient","Brand gradient"],["particleDrift","Particle Drift","Subtle particle depth"],["shineSweep","Shine Sweep","Specular highlight"],["hoverFloat","Hover Float","Gentle lift"],["magneticTilt","Magnetic Tilt","Dimensional tilt"],["breathingGlow","Breathing Glow","Soft red halo"],["orbitReflection","Orbit Reflection","Rotating reflections"]];
  const byId = new Map(OPTIONS.map(([id, label, description]) => [id, { id, label, description }]));
  let active = byId.has(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : 'none';
  let customIcon = readCustomIcon();

  function isDataImage(value = '') {
    return /^data:image\/(png|jpeg|webp);base64,/i.test(String(value || ''));
  }

  function readCustomIcon() {
    try {
      const saved = localStorage.getItem(PERSONAL_KEY) || '';
      return isDataImage(saved) ? saved : '';
    } catch {
      return '';
    }
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

  function officialIcon() {
    return safePublishedUrl(window.EvaraAppBuilder?.getConfig?.()?.brand?.appIconUrl) || APP_ICON_SRC;
  }

  function iconSrc() {
    return customIcon || officialIcon();
  }

  function classFor(id, current = false) {
    return `${current ? 'app-icon-current-preview ' : ''}app-icon-preview app-icon-preview--${id} ${id === 'none' ? 'is-backgroundless' : ''}`;
  }

  function imgFor() {
    const image = new Image();
    image.className = 'app-icon-logo-img';
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = iconSrc();
    image.onerror = () => {
      if (image.src !== APP_ICON_SRC) image.src = APP_ICON_SRC;
    };
    return image;
  }

  function paint(node, id, current = false) {
    if (!node) return;
    node.className = classFor(id, current);
    node.replaceChildren(imgFor());
  }

  function paintTitle(node, id) {
    if (!node) return;
    node.className = `app-icon-title-mark ${id === 'none' ? 'is-backgroundless' : ''}`;
    node.replaceChildren(imgFor());
  }

  function renderGrid() {
    const grid = document.querySelector('[data-app-icon-grid]');
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    OPTIONS.forEach(([id, label, description], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `app-icon-choice${id === active ? ' is-active' : ''}`;
      button.dataset.appIconChoice = id;
      button.setAttribute('aria-pressed', String(id === active));
      button.setAttribute('aria-label', `${label}. ${description}`);

      const preview = document.createElement('span');
      preview.className = classFor(id);
      preview.replaceChildren(imgFor());

      const copy = document.createElement('span');
      copy.className = 'app-icon-copy';
      copy.innerHTML = `<small>${String(index + 1).padStart(2, '0')}</small><strong>${label}</strong><em>${description}</em>`;
      button.append(preview, copy);
      fragment.appendChild(button);
    });
    grid.replaceChildren(fragment);
  }

  function sync() {
    const option = byId.get(active) || byId.get('none');
    paint(document.querySelector('[data-current-icon-preview]'), active, true);
    document.querySelectorAll('[data-device-preview],[data-device-preview-light]').forEach((node) => paint(node, active));
    document.querySelectorAll('[data-brand-title-mark]').forEach((node) => paintTitle(node, active));
    document.querySelectorAll('[data-current-icon-name]').forEach((node) => {
      node.textContent = customIcon ? 'Personal Icon' : option.label;
    });
    document.querySelectorAll('[data-app-icon-choice]').forEach((button) => {
      const selected = button.dataset.appIconChoice === active;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function ensureLink(rel, href) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (rel === 'apple-touch-icon') {
      link.type = 'image/png';
      link.sizes = '512x512';
    } else {
      link.type = 'image/x-icon';
      link.removeAttribute('sizes');
    }
    link.href = href;
  }

  function setIcons(href) {
    ensureLink('icon', FAVICON_SRC);
    ensureLink('shortcut icon', FAVICON_SRC);
    ensureLink('apple-touch-icon', href);
  }

  function toast(message) {
    let node = document.querySelector('.app-icon-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'app-icon-toast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.innerHTML = `<strong>Saved</strong><span>${message}</span>`;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1600);
  }

  function save(showToast = true) {
    try { localStorage.setItem(KEY, active); } catch {}
    setIcons(iconSrc());
    if (showToast) toast((byId.get(active) || byId.get('none')).label);
    window.dispatchEvent(new CustomEvent('evaraos:app-icon-change', {
      detail: { id: active, src: iconSrc(), personal: Boolean(customIcon) }
    }));
  }

  function select(id) {
    if (!byId.has(id)) return;
    active = id;
    sync();
    save(true);
  }

  function restore() {
    active = 'none';
    customIcon = '';
    try {
      localStorage.removeItem(PERSONAL_KEY);
      localStorage.setItem(KEY, 'none');
    } catch {}
    renderGrid();
    sync();
    save(false);
    toast('Official icon restored');
  }

  function upload(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      toast('Use PNG, JPG, or WEBP');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      if (!isDataImage(value)) {
        toast('Upload failed');
        return;
      }
      customIcon = value;
      try { localStorage.setItem(PERSONAL_KEY, customIcon); } catch {}
      renderGrid();
      sync();
      save(false);
      toast('Personal icon uploaded');
    };
    reader.onerror = () => toast('Upload failed');
    reader.readAsDataURL(file);
  }

  function bind() {
    document.querySelector('[data-app-icon-grid]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-app-icon-choice]');
      if (button) select(button.dataset.appIconChoice);
    });
    document.querySelectorAll('[data-apply-selected-icon]').forEach((button) => {
      button.addEventListener('click', () => save(true));
    });
    document.querySelectorAll('[data-restore-original-icon]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        restore();
      });
    });
    document.querySelectorAll('[data-custom-icon-upload]').forEach((input) => {
      input.addEventListener('change', () => upload(input.files?.[0]));
    });
  }

  function refreshPublishedIcon() {
    if (customIcon) return;
    renderGrid();
    sync();
    setIcons(iconSrc());
  }

  function boot() {
    renderGrid();
    sync();
    setIcons(iconSrc());
    bind();
    window.addEventListener('evara:app-builder-ready', refreshPublishedIcon);
    window.addEventListener('evara:app-builder-updated', refreshPublishedIcon);
    window.addEventListener('pageshow', refreshPublishedIcon);
  }

  window.EvaraosAppIcons = {
    options: OPTIONS,
    selectOption: select,
    restoreOriginal: restore,
    applySelection: save,
    forcePreviewSync: sync,
    uploadIcon: upload,
    activeIcon: iconSrc,
    canonicalIcon: APP_ICON_SRC
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
