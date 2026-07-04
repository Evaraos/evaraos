(() => {
  'use strict';
  const KEY = 'evaraos-app-icon-selection-v2';
  const APP = '/assets/brand/evaraos-app-icon.png?v=brand-png-4';
  const MARK = '/assets/brand/evaraos-mark.png?v=brand-png-4';
  const OPTIONS = [
    ['none','No Background','Official app icon PNG'],['pearlWhite','Pearl White','Clean premium light surface'],['pianoBlack','Piano Black','Deep reflective black glass'],['crimsonGlass','Crimson Glass','Signature red Liquid Glass'],['graphite','Graphite','Executive graphite'],['titanium','Titanium','Brushed silver depth'],['midnightBlue','Midnight Blue','Dark navy finish'],['carbonFiber','Carbon Fiber','Technical woven carbon'],['rubyGlass','Ruby Glass','Polished ruby translucency'],['frostedClear','Frosted Clear','Soft translucent glass'],['satinSilver','Satin Silver','Muted premium metal'],['deepNavy','Deep Navy','Near-black blue depth'],['matteBlack','Matte Black','Minimal matte black'],['softIvory','Soft Ivory','Warm clean neutral'],['burgundy','Burgundy','Deep red luxury finish'],['liquidGlassWaves','Liquid Glass Waves','Slow refractive wave motion'],['auroraFlow','Aurora Flow','Adaptive color flow'],['orbitRings','Orbit Rings','Precision rings'],['neuralGrid','Neural Grid','Connected system grid'],['energyPulse','Energy Pulse','Focused energy pulse'],['redPlasma','Red Plasma','Fluid plasma field'],['lightSweepBg','Light Sweep','Clean highlight sweep'],['crystalRefraction','Crystal Refraction','Faceted light shifts'],['adaptiveGradient','Adaptive Gradient','Brand gradient'],['particleDrift','Particle Drift','Subtle particle depth'],['shineSweep','Shine Sweep','Specular highlight'],['hoverFloat','Hover Float','Gentle lift'],['magneticTilt','Magnetic Tilt','Dimensional tilt'],['breathingGlow','Breathing Glow','Soft red halo'],['orbitReflection','Orbit Reflection','Rotating reflections']
  ];
  const byId = new Map(OPTIONS.map(([id,label,description]) => [id,{id,label,description}]));
  let active = byId.has(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : 'none';

  function srcFor(id){ return id === 'none' ? APP : MARK; }
  function classFor(id, current){ return `${current ? 'app-icon-current-preview ' : ''}app-icon-preview app-icon-preview--${id} ${id === 'none' ? 'is-backgroundless' : ''}`; }
  function imgFor(id){ const img = new Image(); img.className = 'app-icon-logo-img'; img.alt = ''; img.decoding = 'async'; img.loading = 'eager'; img.src = srcFor(id); img.onerror = () => { img.src = APP; }; return img; }
  function paint(node,id,current=false){ if(!node) return; node.className = classFor(id,current); node.replaceChildren(imgFor(id)); }
  function paintTitle(node,id){ if(!node) return; node.className = `app-icon-title-mark ${id === 'none' ? 'is-backgroundless' : ''}`; node.replaceChildren(imgFor(id)); }

  function renderGrid(){
    const grid = document.querySelector('[data-app-icon-grid]');
    if(!grid) return;
    const frag = document.createDocumentFragment();
    OPTIONS.forEach(([id,label,description], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `app-icon-choice${id === active ? ' is-active' : ''}`;
      button.dataset.appIconChoice = id;
      button.setAttribute('aria-pressed', String(id === active));
      button.setAttribute('aria-label', `${label}. ${description}`);
      const preview = document.createElement('span');
      preview.className = classFor(id,false);
      preview.appendChild(imgFor(id));
      const copy = document.createElement('span');
      copy.className = 'app-icon-copy';
      copy.innerHTML = `<small>${String(index + 1).padStart(2,'0')}</small><strong>${label}</strong><em>${description}</em>`;
      button.append(preview, copy);
      frag.appendChild(button);
    });
    grid.replaceChildren(frag);
  }

  function sync(){
    const option = byId.get(active) || byId.get('none');
    paint(document.querySelector('[data-current-icon-preview]'), active, true);
    document.querySelectorAll('[data-device-preview],[data-device-preview-light]').forEach(node => paint(node, active));
    document.querySelectorAll('[data-brand-title-mark]').forEach(node => paintTitle(node, active));
    document.querySelectorAll('[data-current-icon-name]').forEach(node => { node.textContent = option.label; });
    document.querySelectorAll('[data-app-icon-choice]').forEach(button => {
      const selected = button.dataset.appIconChoice === active;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function setIcons(href){
    ['icon','shortcut icon','apple-touch-icon'].forEach(rel => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if(!link){ link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
      link.type = 'image/png'; link.href = href;
    });
  }

  function save(){
    localStorage.setItem(KEY, active);
    setIcons(srcFor(active));
    let toast = document.querySelector('.app-icon-toast');
    if(!toast){ toast = document.createElement('div'); toast.className = 'app-icon-toast'; document.body.appendChild(toast); }
    toast.innerHTML = `<strong>Saved</strong><span>${(byId.get(active)||byId.get('none')).label}</span>`;
    toast.classList.add('is-visible');
    clearTimeout(save.timer); save.timer = setTimeout(() => toast.classList.remove('is-visible'), 1500);
  }

  function select(id){ if(!byId.has(id)) return; active = id; sync(); save(); }
  function restore(){ active = 'none'; sync(); save(); }

  function boot(){
    renderGrid(); sync(); setIcons(srcFor(active));
    document.querySelector('[data-app-icon-grid]')?.addEventListener('click', e => { const btn = e.target.closest('[data-app-icon-choice]'); if(btn) select(btn.dataset.appIconChoice); });
    document.querySelectorAll('[data-apply-selected-icon]').forEach(btn => btn.addEventListener('click', save));
    document.querySelectorAll('[data-restore-original-icon]').forEach(btn => btn.addEventListener('click', restore));
  }
  window.EvaraosAppIcons = { selectOption: select, restoreOriginal: restore, applySelection: save, forcePreviewSync: sync };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, {once:true}) : boot();
})();
