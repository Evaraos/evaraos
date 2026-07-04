(() => {
  'use strict';

  const STORAGE_KEY = 'evaraos-app-icon-selection-v2';
  const CUSTOM_KEY = 'evaraos-custom-app-icon-v2';
  const SNAPSHOT_KEY = 'evaraos-app-icon-snapshot-v2';
  const MARK_SRC = '/assets/brand/evaraos-mark.png?v=brand-png-1';
  const APP_ICON_SRC = '/assets/brand/evaraos-app-icon.png?v=brand-png-1';
  let manifestBlobUrl = '';
  let saveTimer = null;

  const options = [
    ['none','No Background','static','Official Evaraos PNG mark, untouched.',['transparent','transparent']],
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
    ['orbitRings','Orbit Rings','animated','Precision rings revolve behind the mark.',['#d6102d','#050506']],
    ['neuralGrid','Neural Grid','animated','Connected system grid animation.',['#e30613','#07090d']],
    ['energyPulse','Energy Pulse','animated','Focused energy radiates outward.',['#ff3044','#250007']],
    ['redPlasma','Red Plasma','animated','Fluid plasma field motion.',['#ff203b','#090205']],
    ['lightSweepBg','Light Sweep','animated','A clean highlight sweeps the glass.',['#d7dbe2','#20232b']],
    ['crystalRefraction','Crystal Refraction','animated','Faceted light shifts across crystal.',['#ff5365','#f5f6fb']],
    ['adaptiveGradient','Adaptive Gradient','animated','Brand gradient slowly rebalances.',['#f20f2f','#101b3b']],
    ['particleDrift','Particle Drift','animated','Subtle particles drift in depth.',['#d90b26','#050506']],
    ['shineSweep','Shine Sweep','effect','Specular highlight crosses the E.',['#ffffff','#f2f3f6']],
    ['hoverFloat','Hover Float','effect','The mark gently lifts and settles.',['#15171d','#050506']],
    ['magneticTilt','Magnetic Tilt','effect','A restrained dimensional tilt.',['#2a2d35','#08090c']],
    ['breathingGlow','Breathing Glow','effect','Soft branded halo breathes.',['#e30613','#120003']],
    ['orbitReflection','Orbit Reflection','effect','Reflections orbit the glossy edges.',['#d9dde5','#090a0e']]
  ].map(([id,label,group,description,colors]) => ({ id, label, group, description, colors }));

  const byId = new Map(options.map(item => [item.id, item]));
  let activeId = readSelection();
  let customLogo = readCustomLogo();

  function readSelection() { try { const saved = localStorage.getItem(STORAGE_KEY); return byId.has(saved) ? saved : 'none'; } catch { return 'none'; } }
  function readCustomLogo() { try { const saved = localStorage.getItem(CUSTOM_KEY); return saved && saved.startsWith('data:image/') ? saved : ''; } catch { return ''; } }
  function activeLogoSrc() { return customLogo || MARK_SRC; }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true; }
  function groupLabel(group) { return group === 'animated' ? 'Animated background' : group === 'effect' ? 'Icon animation' : 'Static background'; }

  function logoImage() {
    const image = document.createElement('img');
    image.className = 'app-icon-logo-img';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.loading = 'eager';
    image.decoding = 'async';
    image.src = activeLogoSrc();
    image.addEventListener('error', () => { image.src = MARK_SRC; }, { once:true });
    return image;
  }

  function previewClass(option, current = false) {
    return [current ? 'app-icon-current-preview' : '', 'app-icon-preview', `app-icon-preview--${option.id}`, `app-icon-preview--${option.group}`, option.group === 'animated' ? 'is-animated' : '', option.group === 'effect' ? 'has-icon-effect' : '', option.id === 'none' ? 'is-backgroundless' : ''].filter(Boolean).join(' ');
  }

  function paint(node, option, current = false) { if (!node) return; node.className = previewClass(option, current); node.replaceChildren(logoImage()); }

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
      preview.appendChild(logoImage());
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
    document.querySelectorAll('[data-brand-title-mark]').forEach(node => { node.replaceChildren(logoImage()); node.classList.toggle('is-backgroundless', option.id === 'none'); });
    document.querySelectorAll('[data-current-icon-name]').forEach(node => { node.textContent = option.label; });
  }

  function ensureIconLink(rel, href, type = 'image/png') {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
    link.type = type;
    link.href = href;
  }

  function ensureManifest(icon = APP_ICON_SRC) {
    try {
      if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
      const manifest = { name:'Evaraos Inc', short_name:'Evaraos', id:'/', start_url:'/', scope:'/', display:'standalone', orientation:'portrait', background_color:'#050506', theme_color:'#e30613', icons:[{ src:icon, sizes:'512x512', type:'image/png', purpose:'any' }, { src:icon, sizes:'512x512', type:'image/png', purpose:'maskable' }] };
      manifestBlobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type:'application/manifest+json' }));
      let link = document.querySelector('link[rel="manifest"]');
      if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
      link.href = manifestBlobUrl;
    } catch {}
  }

  function canvasBackground(ctx, option, size) {
    if (option.id === 'none') return;
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, option.colors[0]);
    gradient.addColorStop(1, option.colors[1]);
    ctx.fillStyle = gradient;
    roundRect(ctx, 18, 18, size - 36, size - 36, size * .22); ctx.fill();
    const gloss = ctx.createLinearGradient(0, 0, 0, size * .58);
    gloss.addColorStop(0, 'rgba(255,255,255,.45)'); gloss.addColorStop(.48, 'rgba(255,255,255,.06)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss; roundRect(ctx, 34, 30, size - 68, size * .42, size * .18); ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) { const radius = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius); ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius); ctx.arcTo(x, y, x + w, y, radius); ctx.closePath(); }
  function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.crossOrigin = 'anonymous'; image.src = src; }); }

  async function buildSnapshot(option) {
    if (option.id === 'none' && !customLogo) return APP_ICON_SRC;
    const size = 512, canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    canvasBackground(ctx, option, size);
    const mark = await loadImage(activeLogoSrc());
    const markSize = option.id === 'none' ? 420 : 330;
    ctx.drawImage(mark, (size - markSize) / 2, (size - markSize) / 2, markSize, markSize);
    return canvas.toDataURL('image/png');
  }

  async function applySelection(showConfirmation = true) {
    clearTimeout(saveTimer);
    const option = byId.get(activeId) || byId.get('none');
    try {
      localStorage.setItem(STORAGE_KEY, option.id);
      const snapshot = await buildSnapshot(option);
      localStorage.setItem(SNAPSHOT_KEY, snapshot);
      ensureIconLink('icon', snapshot);
      ensureIconLink('shortcut icon', snapshot);
      ensureIconLink('apple-touch-icon', snapshot);
      ensureManifest(snapshot);
      navigator.serviceWorker?.getRegistration?.().then(registration => registration?.update?.()).catch(() => {});
      if (showConfirmation) toast(`${option.label} saved`);
      if (showConfirmation && isIOS()) showIOSRefreshHelper(option);
      window.dispatchEvent(new CustomEvent('evaraos:app-icon-change', { detail:{ option, snapshot } }));
    } catch (error) {
      console.warn('[App Icon Studio] Save failed', error);
      toast('Could not save icon');
    }
  }

  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => applySelection(true), 180); }
  function toast(message) {
    let node = document.querySelector('.app-icon-toast');
    if (!node) { node = document.createElement('div'); node.className = 'app-icon-toast'; node.setAttribute('role', 'status'); document.body.appendChild(node); }
    node.innerHTML = `<strong>Autosaved</strong><span>${message}</span>`;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1700);
  }

  function showIOSRefreshHelper(option) {
    let panel = document.querySelector('[data-ios-icon-refresh-helper]');
    if (!panel) { panel = document.createElement('section'); panel.className = 'app-icon-ios-helper glass-card'; panel.dataset.iosIconRefreshHelper = 'true'; document.querySelector('.app-icon-current-card')?.after(panel); }
    panel.innerHTML = `<div><p class="settings-kicker">IPHONE ICON REFRESH</p><h2>${option.label} is ready</h2><p>${isStandalone() ? 'iOS has received the new icon data, but an already-installed Home Screen icon is cached by the system.' : 'The icon data is ready for the next Add to Home Screen install.'}</p></div><ol><li>Remove the old Evaraos icon from the Home Screen.</li><li>Open Evaraos in Safari.</li><li>Tap Share → Add to Home Screen.</li></ol>`;
  }

  function selectOption(id) {
    if (!byId.has(id)) return;
    activeId = id;
    try { localStorage.setItem(STORAGE_KEY, activeId); } catch {}
    document.querySelectorAll('[data-app-icon-choice]').forEach(button => { const active = button.dataset.appIconChoice === id; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
    syncPreviews();
    queueSave();
  }

  function restoreOriginal() {
    activeId = 'none'; customLogo = '';
    try { localStorage.removeItem(CUSTOM_KEY); localStorage.setItem(STORAGE_KEY, 'none'); localStorage.removeItem(SNAPSHOT_KEY); } catch {}
    renderGrid(); syncPreviews(); applySelection(false).then(() => toast('Official PNG restored'));
  }

  function upload(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Use PNG, JPG, or WEBP'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      customLogo = String(reader.result || '');
      if (!customLogo.startsWith('data:image/')) { customLogo = ''; toast('Image upload failed'); return; }
      try { localStorage.setItem(CUSTOM_KEY, customLogo); } catch {}
      renderGrid(); syncPreviews(); applySelection(false).then(() => toast('Custom mark uploaded'));
    };
    reader.onerror = () => toast('Image upload failed');
    reader.readAsDataURL(file);
  }

  function bind() {
    const grid = document.querySelector('[data-app-icon-grid]');
    if (grid && grid.dataset.bound !== 'true') { grid.dataset.bound = 'true'; grid.addEventListener('click', event => { const button = event.target.closest('[data-app-icon-choice]'); if (button) selectOption(button.dataset.appIconChoice); }); }
    document.querySelectorAll('[data-apply-selected-icon]').forEach(button => { if (button.dataset.bound === 'true') return; button.dataset.bound = 'true'; button.addEventListener('click', () => applySelection(true)); });
    document.querySelectorAll('[data-restore-original-icon]').forEach(button => { if (button.dataset.bound === 'true') return; button.dataset.bound = 'true'; button.addEventListener('click', restoreOriginal); });
    document.querySelectorAll('[data-custom-icon-upload]').forEach(input => { if (input.dataset.bound === 'true') return; input.dataset.bound = 'true'; input.addEventListener('change', () => upload(input.files?.[0])); });
  }

  function hydrateSavedIcon() {
    try {
      const snapshot = localStorage.getItem(SNAPSHOT_KEY);
      if (snapshot && snapshot.startsWith('data:image/')) { ensureIconLink('icon', snapshot); ensureIconLink('shortcut icon', snapshot); ensureIconLink('apple-touch-icon', snapshot); ensureManifest(snapshot); }
    } catch {}
  }
  function boot() { renderGrid(); syncPreviews(); bind(); hydrateSavedIcon(); }
  window.EvaraosAppIcons = { options, selectOption, restoreOriginal, applySelection, currentIconId:() => activeId };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once:true }) : boot();
})();
