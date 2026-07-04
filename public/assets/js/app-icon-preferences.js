(() => {
  const KEY = 'evaraos-app-icon';
  const CUSTOM_KEY = 'evaraos-custom-app-icon';
  const FALLBACK = '/assets/icons/brand/current-uploaded-logo.svg?v=exact-e-4';
  const DATA_ASSET = '/assets/js/brand/current-logo-data.js?v=official-png-2';
  const backgrounds = ['primaryRed','darkCore','clearGlass','redGlow','coreWhite','frosted','waveWhite','hexBlack','matteBlack','topography','halftone','outlineRed','holoShift','aurora','energyRing','liquidFlow','pulse','crystal','glassOrbit','loadingOrbit','neonOrbit','plasma','vortex','stardust','dualOrbit','ringSpin','fabricCoin','eclipse','stripedRed','progress'];
  const labels = ['Primary Red','Dark Core','Clear Glass','Red Glow','Core White','Frosted','Wave White','Hex Black','Matte Black','Topography','Halftone','Outline Red','Holo Shift','Aurora','Energy Ring','Liquid Flow','Pulse','Crystal','Glass Orbit','Loading Orbit','Neon Orbit','Plasma','Vortex','Stardust','Dual Orbit','Ring Spin','Fabric Coin','Eclipse','Striped Red','Progress'];
  let logo = FALLBACK;
  try { logo = localStorage.getItem(CUSTOM_KEY) || window.EVARAOS_CURRENT_LOGO_DATA || FALLBACK; } catch { logo = window.EVARAOS_CURRENT_LOGO_DATA || FALLBACK; }
  const icons = Object.fromEntries(backgrounds.map((id, index) => [id, { id, label: `${index + 1}. ${labels[index]}`, shortLabel: labels[index] }]));
  function selectedId() { try { return icons[localStorage.getItem(KEY)] ? localStorage.getItem(KEY) : 'primaryRed'; } catch { return 'primaryRed'; } }
  function safeLogo() { return logo || FALLBACK; }
  function img() { return `<img class="app-icon-logo-img" src="${safeLogo()}" alt="" aria-hidden="true" loading="eager" onerror="this.onerror=null;this.src='${FALLBACK}'">`; }
  function paint(node, id) { if (!node) return; node.className = `${node.hasAttribute('data-current-icon-preview') ? 'app-icon-current-preview ' : ''}app-icon-preview has-current-logo app-icon-preview--${id}`; node.innerHTML = img(); }
  function sync(id = selectedId()) {
    paint(document.querySelector('[data-current-icon-preview]'), id);
    document.querySelectorAll('[data-device-preview]').forEach(node => paint(node, id));
    document.querySelectorAll('[data-device-preview-light]').forEach(node => paint(node, 'coreWhite'));
    document.querySelectorAll('[data-brand-title-mark]').forEach(node => { node.innerHTML = img(); });
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(link => { link.href = safeLogo(); });
  }
  function toast(text) { let t = document.querySelector('.app-icon-toast'); if (!t) { t = document.createElement('div'); t.className = 'app-icon-toast'; document.body.appendChild(t); } t.innerHTML = `<strong>Autosaved</strong><span>${text}</span>`; t.classList.add('is-visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('is-visible'), 1400); }
  function render() { const grid = document.querySelector('[data-app-icon-grid]'); if (!grid) { sync(); return; } const current = selectedId(); grid.innerHTML = backgrounds.map((id, index) => `<button class="app-icon-choice ${id === current ? 'is-active' : ''}" type="button" data-app-icon-choice="${id}" aria-label="${labels[index]}" aria-pressed="${id === current}"><span class="app-icon-preview has-current-logo app-icon-preview--${id}">${img()}</span><span class="app-icon-copy"><strong>${labels[index]}</strong></span></button>`).join(''); sync(current); }
  function handleUpload(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Use PNG, JPG, or WEBP'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      logo = String(reader.result || FALLBACK);
      try { localStorage.setItem(CUSTOM_KEY, logo); } catch {}
      render();
      toast('Custom icon uploaded');
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
        if (!button) return;
        const id = button.dataset.appIconChoice;
        try { localStorage.setItem(KEY, id); } catch {}
        grid.querySelectorAll('[data-app-icon-choice]').forEach(item => { const active = item.dataset.appIconChoice === id; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
        sync(id);
        toast(labels[backgrounds.indexOf(id)] || 'Icon selected');
      });
    }
    document.querySelectorAll('[data-apply-selected-icon]').forEach(button => { if (button.dataset.bound === 'true') return; button.dataset.bound = 'true'; button.addEventListener('click', () => { sync(); toast('Icon saved'); }); });
    document.querySelectorAll('[data-restore-original-icon]').forEach(button => { if (button.dataset.bound === 'true') return; button.dataset.bound = 'true'; button.addEventListener('click', () => { try { localStorage.removeItem(KEY); localStorage.removeItem(CUSTOM_KEY); } catch {} logo = window.EVARAOS_CURRENT_LOGO_DATA || FALLBACK; render(); toast('Original icon restored'); }); });
    document.querySelectorAll('[data-custom-icon-upload]').forEach(input => { if (input.dataset.bound === 'true') return; input.dataset.bound = 'true'; input.addEventListener('change', () => handleUpload(input.files && input.files[0])); });
  }
  function loadExactLogo() {
    return new Promise(resolve => {
      try {
        const saved = localStorage.getItem(CUSTOM_KEY);
        if (saved) { logo = saved; resolve(); return; }
      } catch {}
      if (window.EVARAOS_CURRENT_LOGO_DATA) { logo = window.EVARAOS_CURRENT_LOGO_DATA; resolve(); return; }
      const script = document.createElement('script');
      script.src = DATA_ASSET;
      script.onload = () => { logo = window.EVARAOS_CURRENT_LOGO_DATA || FALLBACK; resolve(); };
      script.onerror = () => { logo = FALLBACK; resolve(); };
      document.head.appendChild(script);
    });
  }
  async function boot() { try { await loadExactLogo(); } catch { logo = FALLBACK; } render(); bind(); }
  window.EvaraosAppIcons = { icons, renderPicker: render, currentIconId: selectedId };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
