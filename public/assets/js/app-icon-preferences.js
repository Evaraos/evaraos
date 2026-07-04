(() => {
  'use strict';

  const STORAGE_KEY = 'evaraos-app-icon-selection-v2';
  const CUSTOM_KEY = 'evaraos-custom-app-icon-v2';
  const MARK_SRC = '/assets/brand/evaraos-mark.png?v=brand-png-1';
  const APP_ICON_SRC = '/assets/brand/evaraos-app-icon.png?v=brand-png-1';

  const options = [
    { id:'none', label:'No Background', group:'static', description:'Official Evaraos PNG mark, untouched.', colors:['transparent','transparent'] },
    { id:'pearlWhite', label:'Pearl White', group:'static', description:'Clean premium light surface.', colors:['#ffffff','#eceff4'] },
    { id:'pianoBlack', label:'Piano Black', group:'static', description:'Deep reflective black glass.', colors:['#050506','#1d1e24'] },
    { id:'crimsonGlass', label:'Crimson Glass', group:'static', description:'Signature red Liquid Glass.', colors:['#ff3344','#7d0010'] },
    { id:'graphite', label:'Graphite', group:'static', description:'Executive dark graphite.', colors:['#333640','#0b0c10'] },
    { id:'titanium', label:'Titanium', group:'static', description:'Brushed silver depth.', colors:['#e7e9ec','#626873'] },
    { id:'midnightBlue', label:'Midnight Blue', group:'static', description:'Dark navy enterprise finish.', colors:['#17335f','#050b18'] },
    { id:'carbonFiber', label:'Carbon Fiber', group:'static', description:'Technical woven carbon.', colors:['#24262d','#050506'] },
    { id:'rubyGlass', label:'Ruby Glass', group:'static', description:'Polished ruby translucency.', colors:['#ff3b4f','#460009'] },
    { id:'frostedClear', label:'Frosted Clear', group:'static', description:'Soft translucent glass.', colors:['rgba(255,255,255,.92)','rgba(205,215,228,.48)'] },
    { id:'satinSilver', label:'Satin Silver', group:'static', description:'Muted premium metal.', colors:['#f5f6f8','#9298a3'] },
    { id:'deepNavy', label:'Deep Navy', group:'static', description:'Near-black blue depth.', colors:['#111d36','#02040a'] },
    { id:'matteBlack', label:'Matte Black', group:'static', description:'Minimal non-reflective black.', colors:['#17181c','#030304'] },
    { id:'softIvory', label:'Soft Ivory', group:'static', description:'Warm clean neutral.', colors:['#fffdf7','#e8e1d3'] },
    { id:'burgundy', label:'Burgundy', group:'static', description:'Deep red luxury finish.', colors:['#8f1726','#260207'] },

    { id:'liquidGlassWaves', label:'Liquid Glass Waves', group:'animated', description:'Slow refractive wave motion.', colors:['#ff3147','#15101b'] },
    { id:'auroraFlow', label:'Aurora Flow', group:'animated', description:'Adaptive red, blue, and violet flow.', colors:['#ef2343','#193d77'] },
    { id:'orbitRings', label:'Orbit Rings', group:'animated', description:'Precision rings revolve behind the mark.', colors:['#d6102d','#050506'] },
    { id:'neuralGrid', label:'Neural Grid', group:'animated', description:'Connected system grid animation.', colors:['#e30613','#07090d'] },
    { id:'energyPulse', label:'Energy Pulse', group:'animated', description:'Focused energy radiates outward.', colors:['#ff3044','#250007'] },
    { id:'redPlasma', label:'Red Plasma', group:'animated', description:'Fluid plasma field motion.', colors:['#ff203b','#090205'] },
    { id:'lightSweepBg', label:'Light Sweep', group:'animated', description:'A clean highlight sweeps the glass.', colors:['#d7dbe2','#20232b'] },
    { id:'crystalRefraction', label:'Crystal Refraction', group:'animated', description:'Faceted light shifts across crystal.', colors:['#ff5365','#f5f6fb'] },
    { id:'adaptiveGradient', label:'Adaptive Gradient', group:'animated', description:'Brand gradient slowly rebalances.', colors:['#f20f2f','#101b3b'] },
    { id:'particleDrift', label:'Particle Drift', group:'animated', description:'Subtle particles drift in depth.', colors:['#d90b26','#050506'] },

    { id:'shineSweep', label:'Shine Sweep', group:'effect', description:'Specular highlight crosses the E.', colors:['#ffffff','#f2f3f6'] },
    { id:'hoverFloat', label:'Hover Float', group:'effect', description:'The mark gently lifts and settles.', colors:['#15171d','#050506'] },
    { id:'magneticTilt', label:'Magnetic Tilt', group:'effect', description:'A restrained dimensional tilt.', colors:['#2a2d35','#08090c'] },
    { id:'breathingGlow', label:'Breathing Glow', group:'effect', description:'Soft branded halo breathes.', colors:['#e30613','#120003'] },
    { id:'orbitReflection', label:'Orbit Reflection', group:'effect', description:'Reflections orbit the glossy edges.', colors:['#d9dde5','#090a0e'] }
  ];

  const byId = new Map(options.map(item => [item.id, item]));
  let activeId = readSelection();
  let customLogo = readCustomLogo();

  function readSelection() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return byId.has(saved) ? saved : 'none';
    } catch { return 'none'; }
  }

  function readCustomLogo() {
    try {
      const saved = localStorage.getItem(CUSTOM_KEY);
      return saved && saved.startsWith('data:image/') ? saved : '';
    } catch { return ''; }
  }

  function activeLogoSrc() { return customLogo || MARK_SRC; }

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
    return [
      current ? 'app-icon-current-preview' : '',
      'app-icon-preview',
      `app-icon-preview--${option.id}`,
      `app-icon-preview--${option.group}`,
      option.group === 'animated' ? 'is-animated' : '',
      option.group === 'effect' ? 'has-icon-effect' : '',
      option.id === 'none' ? 'is-backgroundless' : ''
    ].filter(Boolean).join(' ');
  }

  function paint(node, option, current = false) {
    if (!node) return;
    node.className = previewClass(option, current);
    node.replaceChildren(logoImage());
  }

  function groupLabel(group) {
    return group === 'animated' ? 'Animated background' : group === 'effect' ? 'Icon animation' : 'Static background';
  }

  function renderGrid() {
    const grid = document.querySelector('[data-app-icon-grid]');
    if (!grid) return;
    grid.replaceChildren();
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
      const number = document.createElement('small');
      number.textContent = String(index + 1).padStart(2, '0');
      const strong = document.createElement('strong');
      strong.textContent = option.label;
      const badge = document.createElement('em');
      badge.textContent = groupLabel(option.group);
      copy.append(number, strong, badge);
      button.append(preview, copy);
      grid.appendChild(button);
    });
  }

  function syncPreviews() {
    const option = byId.get(activeId) || byId.get('none');
    paint(document.querySelector('[data-current-icon-preview]'), option, true);
    document.querySelectorAll('[data-device-preview]').forEach(node => paint(node, option));
    document.querySelectorAll('[data-device-preview-light]').forEach(node => paint(node, option));
    document.querySelectorAll('[data-brand-title-mark]').forEach(node => {
      node.replaceChildren(logoImage());
      node.classList.toggle('is-backgroundless', option.id === 'none');
    });
    document.querySelectorAll('[data-current-icon-name]').forEach(node => { node.textContent = option.label; });
  }

  function ensureIconLink(rel, href, type = 'image/png') {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.type = type;
    link.href = href;
  }

  function canvasBackground(ctx, option, size) {
    if (option.id === 'none') return;
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

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function buildSnapshot(option) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    canvasBackground(ctx, option, size);
    const mark = await loadImage(activeLogoSrc());
    const markSize = option.id === 'none' ? 420 : 330;
    const x = (size - markSize) / 2;
    const y = (size - markSize) / 2;
    ctx.drawImage(mark, x, y, markSize, markSize);
    return canvas.toDataURL('image/png');
  }

  async function applySelection(showConfirmation = true) {
    const option = byId.get(activeId) || byId.get('none');
    try {
      localStorage.setItem(STORAGE_KEY, option.id);
      const snapshot = await buildSnapshot(option);
      localStorage.setItem('evaraos-app-icon-snapshot-v2', snapshot);
      ensureIconLink('icon', snapshot);
      ensureIconLink('shortcut icon', snapshot);
      ensureIconLink('apple-touch-icon', option.id === 'none' ? APP_ICON_SRC : snapshot);
      const registration = await navigator.serviceWorker?.getRegistration?.();
      registration?.update?.();
      if (showConfirmation) toast(`${option.label} saved`);
      window.dispatchEvent(new CustomEvent('evaraos:app-icon-change', { detail:{ option, snapshot } }));
    } catch (error) {
      console.warn('[App Icon Studio] Save failed', error);
      toast('Could not save icon');
    }
  }

  function toast(message) {
    let node = document.querySelector('.app-icon-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'app-icon-toast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.innerHTML = `<strong>Autosaved</strong><span>${message}</span>`;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1700);
  }

  function selectOption(id) {
    if (!byId.has(id)) return;
    activeId = id;
    document.querySelectorAll('[data-app-icon-choice]').forEach(button => {
      const active = button.dataset.appIconChoice === id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    syncPreviews();
    applySelection(true);
  }

  function restoreOriginal() {
    activeId = 'none';
    customLogo = '';
    try {
      localStorage.removeItem(CUSTOM_KEY);
      localStorage.setItem(STORAGE_KEY, 'none');
    } catch {}
    renderGrid();
    syncPreviews();
    applySelection(false).then(() => toast('Official PNG restored'));
  }

  function upload(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast('Use PNG, JPG, or WEBP');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      customLogo = String(reader.result || '');
      if (!customLogo.startsWith('data:image/')) {
        customLogo = '';
        toast('Image upload failed');
        return;
      }
      try { localStorage.setItem(CUSTOM_KEY, customLogo); } catch {}
      renderGrid();
      syncPreviews();
      applySelection(false).then(() => toast('Custom mark uploaded'));
    };
    reader.onerror = () => toast('Image upload failed');
    reader.readAsDataURL(file);
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
    renderGrid();
    syncPreviews();
    bind();
    applySelection(false);
  }

  window.EvaraosAppIcons = { options, selectOption, restoreOriginal, applySelection, currentIconId:() => activeId };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once:true }) : boot();
})();
