(() => {
  'use strict';

  const BRAND_VERSION = 'brand-contract-2';
  const OFFICIAL_ICON = '/assets/brand/evaraos-app-icon.png?v=' + BRAND_VERSION;
  const MANIFEST = '/manifest.json?v=' + BRAND_VERSION;
  const STORAGE_KEY = 'evaraos-app-icon-selection-v3';
  const CUSTOM_KEY = 'evaraos-custom-app-icon-v6';
  const SNAPSHOT_KEY = 'evaraos-app-icon-snapshot-v3';
  const MIGRATION_KEY = 'evaraos-app-icon-studio-migrated:' + BRAND_VERSION;
  const LEGACY_KEYS = [
    'evaraos-app-icon-selection-v2','evaraos-app-icon-snapshot-v2',
    'evaraos-custom-app-icon-v2','evaraos-custom-app-icon-v3','evaraos-custom-app-icon-v4','evaraos-custom-app-icon-v5',
    'evaraos-official-app-icon-v1','evaraos-official-app-icon-v2','evaraos-official-app-icon-v3','evaraos-official-app-icon-v4',
    'evaraos-user-app-icon-v1','evaraos-user-app-icon-v2','evaraos-user-app-icon-v3','evaraos-custom-icon-v1'
  ];

  const options = [
    ['none','Official E Icon','static','Canonical Evaraos app icon with no generated background.',['transparent','transparent']],
    ['pearlWhite','Pearl White','static','Clean premium light surface.',['#ffffff','#eceff4']],
    ['pianoBlack','Piano Black','static','Deep reflective black glass.',['#050506','#1d1e24']],
    ['crimsonGlass','Crimson Glass','static','Signature red Liquid Glass.',['#ff3344','#7d0010']],
    ['graphite','Graphite','static','Executive dark graphite.',['#333640','#0b0c10']],
    ['titanium','Titanium','static','Brushed silver depth.',['#e7e9ec','#626873']],
    ['midnightBlue','Midnight Blue','static','Dark navy enterprise finish.',['#17335f','#050b18']],
    ['carbonFiber','Carbon Fiber','static','Technical woven carbon.',['#24262d','#050506']],
    ['rubyGlass','Ruby Glass','static','Polished ruby translucency.',['#ff3b4f','#460009']],
    ['frostedClear','Frosted Clear','static','Soft translucent glass.',['rgba(255,255,255,.92)','rgba(205,215,228,.48)']],
    ['satinSilver','Satin Silver','static','Muted premium metal.',['#f5f6f8','#9298a3']],
    ['deepNavy','Deep Navy','static','Near-black blue depth.',['#111d36','#02040a']],
    ['matteBlack','Matte Black','static','Minimal non-reflective black.',['#17181c','#030304']],
    ['softIvory','Soft Ivory','static','Warm clean neutral.',['#fffdf7','#e8e1d3']],
    ['burgundy','Burgundy','static','Deep red luxury finish.',['#8f1726','#260207']],
    ['liquidGlassWaves','Liquid Glass Waves','animated','Slow refractive wave motion.',['#ff3147','#15101b']],
    ['auroraFlow','Aurora Flow','animated','Adaptive red, blue, and violet flow.',['#ef2343','#193d77']],
    ['orbitRings','Orbit Rings','animated','Precision rings revolve behind the icon.',['#d6102d','#050506']],
    ['neuralGrid','Neural Grid','animated','Connected system grid animation.',['#e30613','#07090d']],
    ['energyPulse','Energy Pulse','animated','Focused energy radiates outward.',['#ff3044','#250007']],
    ['redPlasma','Red Plasma','animated','Fluid plasma field motion.',['#ff203b','#090205']],
    ['lightSweepBg','Light Sweep','animated','A clean highlight sweeps the glass.',['#d7dbe2','#20232b']],
    ['crystalRefraction','Crystal Refraction','animated','Faceted light shifts across crystal.',['#ff5365','#f5f6fb']],
    ['adaptiveGradient','Adaptive Gradient','animated','Brand gradient slowly rebalances.',['#f20f2f','#101b3b']],
    ['particleDrift','Particle Drift','animated','Subtle particles drift in depth.',['#d90b26','#050506']],
    ['shineSweep','Shine Sweep','effect','Specular highlight crosses the E.',['#ffffff','#f2f3f6']],
    ['hoverFloat','Hover Float','effect','The E gently lifts and settles.',['#15171d','#050506']],
    ['magneticTilt','Magnetic Tilt','effect','A restrained dimensional tilt.',['#2a2d35','#08090c']],
    ['breathingGlow','Breathing Glow','effect','Soft branded halo breathes.',['#e30613','#120003']],
    ['orbitReflection','Orbit Reflection','effect','Reflections orbit the glossy edges.',['#d9dde5','#090a0e']]
  ].map(([id,label,group,description,colors]) => ({ id,label,group,description,colors }));

  const byId = new Map(options.map(option => [option.id, option]));
  let activeId = 'none';
  let customIcon = '';
  let saveTimer = 0;

  function migrateLegacyState() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === '1') return;
      LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
      localStorage.setItem(MIGRATION_KEY, '1');
    } catch {}
  }

  function readSelection() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return byId.has(saved) ? saved : 'none';
    } catch { return 'none'; }
  }

  function readCustomIcon() {
    try {
      const saved = localStorage.getItem(CUSTOM_KEY) || '';
      return /^data:image\/(png|jpeg|webp);base64,/.test(saved) ? saved : '';
    } catch { return ''; }
  }

  function iconSource() { return customIcon || OFFICIAL_ICON; }
  function groupLabel(group) { return group === 'animated' ? 'Animated background' : group === 'effect' ? 'Icon animation' : 'Static background'; }
  function previewClass(option, current = false) {
    return [current ? 'app-icon-current-preview' : '', 'app-icon-preview', `app-icon-preview--${option.id}`, `app-icon-preview--${option.group}`, option.group === 'animated' ? 'is-animated' : '', option.group === 'effect' ? 'has-icon-effect' : '', option.id === 'none' ? 'is-backgroundless' : ''].filter(Boolean).join(' ');
  }

  function createIconImage() {
    const image = new Image();
    image.className = 'app-icon-logo-img';
    image.alt = '';
    image.loading = 'eager';
    image.decoding = 'async';
    image.src = iconSource();
    image.addEventListener('error', () => {
      if (image.src !== new URL(OFFICIAL_ICON, location.origin).href) image.src = OFFICIAL_ICON;
    }, { once: true });
    return image;
  }

  function paint(node, option, current = false) {
    if (!node) return;
    node.className = previewClass(option, current);
    node.replaceChildren(createIconImage());
  }

  function renderGrid() {
    const grid = document.querySelector('[data-app-icon-grid]');
    if (!grid) return;
    const fragment = document.createDocumentFragment();
    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-icon-choice' + (option.id === activeId ? ' is-active' : '');
      button.dataset.appIconChoice = option.id;
      button.setAttribute('aria-pressed', String(option.id === activeId));
      button.setAttribute('aria-label', `${option.label}. ${option.description}`);
      const preview = document.createElement('span');
      preview.className = previewClass(option);
      preview.appendChild(createIconImage());
      const copy = document.createElement('span');
      copy.className = 'app-icon-copy';
      copy.innerHTML = `<small>${String(index + 1).padStart(2, '0')}</small><strong>${option.label}</strong><em>${groupLabel(option.group)}</em>`;
      button.append(preview, copy);
      fragment.appendChild(button);
    });
    grid.replaceChildren(fragment);
  }

  function syncPreviews() {
    const option = byId.get(activeId) || byId.get('none');
    paint(document.querySelector('[data-current-icon-preview]'), option, true);
    document.querySelectorAll('[data-device-preview],[data-device-preview-light]').forEach(node => paint(node, option));
    document.querySelectorAll('[data-brand-title-mark]').forEach(node => paint(node, option));
    document.querySelectorAll('[data-current-icon-name]').forEach(node => { node.textContent = customIcon ? 'Custom Device Icon' : option.label; });
    document.querySelectorAll('[data-app-icon-choice]').forEach(button => {
      const selected = button.dataset.appIconChoice === activeId;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function ensureLink(rel, href, type = 'image/png') {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
    if (type) link.type = type;
    link.href = href;
  }

  function applyHeadIcon(src = OFFICIAL_ICON) {
    ensureLink('icon', src);
    ensureLink('shortcut icon', src);
    ensureLink('apple-touch-icon', src);
    ensureLink('manifest', MANIFEST, 'application/manifest+json');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  async function buildSnapshot(option) {
    if (option.id === 'none' && !customIcon) return OFFICIAL_ICON;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return OFFICIAL_ICON;

    if (option.id !== 'none') {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, option.colors[0]);
      gradient.addColorStop(1, option.colors[1]);
      ctx.fillStyle = gradient;
      roundRect(ctx, 18, 18, size - 36, size - 36, size * .22);
      ctx.fill();
      const gloss = ctx.createLinearGradient(0, 0, 0, size * .58);
      gloss.addColorStop(0, 'rgba(255,255,255,.45)');
      gloss.addColorStop(.48, 'rgba(255,255,255,.06)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      roundRect(ctx, 34, 30, size - 68, size * .42, size * .18);
      ctx.fill();
    }

    const icon = await loadImage(iconSource());
    const iconSize = option.id === 'none' ? 430 : 336;
    ctx.drawImage(icon, (size - iconSize) / 2, (size - iconSize) / 2, iconSize, iconSize);
    return canvas.toDataURL('image/png');
  }

  function toast(message) {
    let node = document.querySelector('.app-icon-toast');
    if (!node) { node = document.createElement('div'); node.className = 'app-icon-toast'; node.setAttribute('role', 'status'); document.body.appendChild(node); }
    node.innerHTML = `<strong>Saved</strong><span>${message}</span>`;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1700);
  }

  async function applySelection(showConfirmation = true) {
    clearTimeout(saveTimer);
    const option = byId.get(activeId) || byId.get('none');
    try {
      localStorage.setItem(STORAGE_KEY, option.id);
      const snapshot = await buildSnapshot(option);
      localStorage.setItem(SNAPSHOT_KEY, snapshot);
      applyHeadIcon(snapshot);
      if (showConfirmation) toast(`${option.label} applied to this browser. The installed production app icon remains the official E icon.`);
      window.dispatchEvent(new CustomEvent('evaraos:app-icon-change', { detail: { option, snapshot, officialIcon: OFFICIAL_ICON } }));
    } catch (error) {
      console.warn('[App Icon Studio] Save failed', error);
      applyHeadIcon(OFFICIAL_ICON);
      if (showConfirmation) toast('Could not save the browser preview');
    }
  }

  function selectOption(id) {
    if (!byId.has(id)) return;
    activeId = id;
    syncPreviews();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => applySelection(true), 180);
  }

  function restoreOriginal() {
    activeId = 'none';
    customIcon = '';
    try {
      [STORAGE_KEY, CUSTOM_KEY, SNAPSHOT_KEY, ...LEGACY_KEYS].forEach(key => localStorage.removeItem(key));
      localStorage.setItem(STORAGE_KEY, 'none');
    } catch {}
    renderGrid();
    syncPreviews();
    applyHeadIcon(OFFICIAL_ICON);
    toast('Official E icon restored');
  }

  function upload(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Use PNG, JPG, or WEBP'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(result)) { toast('Image upload failed'); return; }
      customIcon = result;
      try { localStorage.setItem(CUSTOM_KEY, customIcon); } catch {}
      renderGrid();
      syncPreviews();
      applySelection(false).then(() => toast('Custom browser icon preview saved'));
    };
    reader.onerror = () => toast('Image upload failed');
    reader.readAsDataURL(file);
  }

  function repair() {
    syncPreviews();
    let snapshot = '';
    try { snapshot = localStorage.getItem(SNAPSHOT_KEY) || ''; } catch {}
    applyHeadIcon(/^data:image\/(png|jpeg|webp);base64,/.test(snapshot) ? snapshot : OFFICIAL_ICON);
  }

  function bind() {
    const grid = document.querySelector('[data-app-icon-grid]');
    if (grid && grid.dataset.bound !== 'true') {
      grid.dataset.bound = 'true';
      grid.addEventListener('click', event => {
        const button = event.target.closest('[data-app-icon-choice]');
        if (button) selectOption(button.dataset.appIconChoice);
      });
    }
    document.querySelectorAll('[data-apply-selected-icon]').forEach(button => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => applySelection(true));
    });
    document.querySelectorAll('[data-restore-original-icon]').forEach(button => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', restoreOriginal);
    });
    document.querySelectorAll('[data-custom-icon-upload]').forEach(input => {
      if (input.dataset.bound === 'true') return;
      input.dataset.bound = 'true';
      input.addEventListener('change', () => upload(input.files?.[0]));
    });
  }

  function boot() {
    migrateLegacyState();
    activeId = readSelection();
    customIcon = readCustomIcon();
    renderGrid();
    syncPreviews();
    bind();
    repair();
  }

  window.EvaraosAppIcons = { options, selectOption, restoreOriginal, applySelection, repair, officialIcon: OFFICIAL_ICON, currentIconId: () => activeId };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();
