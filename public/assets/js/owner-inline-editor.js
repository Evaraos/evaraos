(() => {
  'use strict';

  const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
  const TEXT_KEY = 'evaraos-owner-inline-edits-v5';
  const STYLE_KEY = 'evaraos-owner-style-edits-v3';
  const BLOCK_KEY = 'evaraos-owner-blocks-v2';
  const ASSET_KEY = 'evaraos-owner-asset-edits-v1';

  let enabled = false;
  let selected = null;
  let edits = read(TEXT_KEY);
  let styles = read(STYLE_KEY);
  let blocks = read(BLOCK_KEY);
  let assets = read(ASSET_KEY);

  const ICONS = {
    brand: '◆', home: '⌂', dashboard: '◈', order: '+', jobs: '◒', leads: '◇', map: '⬢', messages: '✉', schedule: '◷', settings: '⚙', ai: '✦', user: '◉', finance: '$'
  };

  function read(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function saveAll() { write(TEXT_KEY, edits); write(STYLE_KEY, styles); write(BLOCK_KEY, blocks); write(ASSET_KEY, assets); }
  function pageId() { return location.pathname || '/'; }
  function roleAllowed(role = '') { return OWNER_ROLES.has(String(role || '').toLowerCase().replace(/\s+/g, '_')); }
  function uniqueId(prefix = 'owner') { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function nodeKey(node) {
    if (!node.dataset.ownerKey) node.dataset.ownerKey = node.dataset.ownerEdit || node.dataset.ownerBlock || uniqueId('node');
    return `${pageId()}::${node.dataset.ownerKey}`;
  }
  function toast(message) {
    let node = document.querySelector('.owner-editor-toast');
    if (!node) { node = document.createElement('div'); node.className = 'owner-editor-toast'; document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1400);
  }

  function ensureStyle() {
    if (document.getElementById('ownerInlineEditorStyle')) return;
    const style = document.createElement('style');
    style.id = 'ownerInlineEditorStyle';
    style.textContent = `
      [data-owner-edit],[data-owner-block]{position:relative!important;}
      html.owner-editor-on [data-owner-edit],html.owner-editor-on [data-owner-block],html.owner-editor-on .glass-card,html.owner-editor-on img,html.owner-editor-on svg{outline:1.5px dashed rgba(255,255,255,.34)!important;outline-offset:5px!important;border-radius:14px!important;}
      html.owner-editor-on [data-owner-edit]{cursor:text!important;}html.owner-editor-on [data-owner-block],html.owner-editor-on .glass-card{cursor:grab!important;}
      html.owner-editor-on .owner-selected{outline:2px solid rgba(242,23,45,.95)!important;outline-offset:8px!important;box-shadow:0 0 0 8px rgba(242,23,45,.10)!important;}
      html.owner-editor-on .owner-dragging{opacity:.55!important;transform:scale(.985)!important;}
      html.owner-editor-on .owner-edit-chip{display:inline-grid!important;}
      .owner-edit-chip{display:none!important;position:absolute!important;right:10px!important;top:10px!important;z-index:50!important;place-items:center!important;min-width:42px!important;height:26px!important;padding:0 9px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.38)!important;background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(255,255,255,.18))!important;color:#fff!important;font-size:11px!important;font-weight:950!important;backdrop-filter:blur(18px)!important;box-shadow:0 10px 22px rgba(0,0,0,.18)!important;}
      .owner-editor-fab{position:fixed!important;right:18px!important;bottom:calc(156px + env(safe-area-inset-bottom,0px))!important;z-index:9997!important;display:none!important;padding:12px 14px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.13))!important;border:1px solid rgba(255,255,255,.45)!important;color:var(--text-primary,#fff)!important;font-weight:950!important;box-shadow:0 18px 44px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.38)!important;backdrop-filter:blur(24px) saturate(1.35)!important;-webkit-backdrop-filter:blur(24px) saturate(1.35)!important;}
      .owner-editor-fab.is-visible{display:flex!important;}.owner-editor-fab.is-on{background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(242,23,45,.18))!important;}
      .owner-inspector{position:fixed!important;right:16px!important;top:calc(92px + env(safe-area-inset-top,0px))!important;width:min(360px,calc(100vw - 32px))!important;max-height:calc(100vh - 190px)!important;overflow:auto!important;z-index:9998!important;display:none!important;gap:12px!important;padding:14px!important;border-radius:26px!important;background:linear-gradient(145deg,rgba(255,255,255,.27),rgba(10,12,18,.72))!important;border:1px solid rgba(255,255,255,.34)!important;box-shadow:0 24px 62px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.28)!important;backdrop-filter:blur(30px) saturate(1.35)!important;-webkit-backdrop-filter:blur(30px) saturate(1.35)!important;color:#fff!important;}
      .owner-inspector.is-visible{display:grid!important;}.owner-inspector h3{margin:0!important;font-size:1.05rem!important;letter-spacing:-.04em!important;}.owner-inspector p{margin:0!important;color:rgba(255,255,255,.72)!important;font-size:.82rem!important;line-height:1.4!important;}
      .owner-panel-section{display:grid!important;gap:9px!important;padding:10px!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:18px!important;background:rgba(255,255,255,.07)!important;}.owner-panel-section strong{font-size:.78rem!important;text-transform:uppercase!important;letter-spacing:.1em!important;color:rgba(255,255,255,.76)!important;}
      .owner-inspector label{display:grid!important;gap:6px!important;font-size:.75rem!important;font-weight:900!important;color:rgba(255,255,255,.75)!important;}.owner-inspector input,.owner-inspector select{height:38px!important;border-radius:13px!important;border:1px solid rgba(255,255,255,.28)!important;background:rgba(255,255,255,.12)!important;color:#fff!important;padding:0 10px!important;}
      .owner-inspector-actions,.owner-inspector-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;}.owner-inspector button{border:1px solid rgba(255,255,255,.26)!important;border-radius:13px!important;padding:9px 10px!important;color:#fff!important;background:rgba(255,255,255,.14)!important;font-weight:900!important;}.owner-inspector button:hover{background:rgba(255,255,255,.24)!important;}
      .owner-drop-zone{border:1.5px dashed rgba(255,255,255,.44)!important;border-radius:24px!important;padding:18px!important;display:grid!important;gap:8px!important;place-items:center!important;text-align:center!important;min-height:86px!important;color:var(--text-secondary,rgba(255,255,255,.72))!important;background:rgba(255,255,255,.07)!important;}
      .owner-icon-token{display:inline-grid!important;place-items:center!important;width:44px!important;height:44px!important;border-radius:14px!important;background:rgba(255,255,255,.14)!important;border:1px solid rgba(255,255,255,.22)!important;font-size:22px!important;color:#fff!important;}
      .owner-editor-toast{position:fixed!important;left:50%!important;top:calc(env(safe-area-inset-top,0px) + 18px)!important;transform:translateX(-50%) translateY(-12px)!important;opacity:0!important;z-index:9999!important;padding:12px 14px!important;border-radius:18px!important;color:#fff!important;background:rgba(10,12,18,.76)!important;border:1px solid rgba(255,255,255,.32)!important;backdrop-filter:blur(22px)!important;transition:.2s ease!important;}.owner-editor-toast.is-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}
      @media(max-width:760px){.owner-inspector{left:12px!important;right:12px!important;top:auto!important;bottom:calc(84px + env(safe-area-inset-bottom,0px))!important;width:auto!important;max-height:42vh!important}.owner-editor-fab{bottom:calc(144px + env(safe-area-inset-bottom,0px))!important;}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    if (!document.querySelector('.owner-editor-fab')) {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'owner-editor-fab';
      fab.textContent = 'Live Edit';
      fab.addEventListener('click', toggleEditor);
      document.body.appendChild(fab);
    }
    if (!document.querySelector('.owner-inspector')) {
      const panel = document.createElement('aside');
      panel.className = 'owner-inspector';
      panel.innerHTML = `
        <h3>Owner Inspector</h3>
        <p>Click the app directly. Edit text in place. Shape cards, swap icons/images, or add blocks here.</p>
        <section class="owner-panel-section"><strong>Design</strong><label>Glass style<select data-owner-style="glass"><option value="">Default</option><option value="soft">Soft Glass</option><option value="glass">Liquid Glass</option><option value="strong">Strong Glass</option></select></label><div class="owner-inspector-grid"><label>Radius<input data-owner-style="radius" type="range" min="8" max="44" value="24"></label><label>Padding<input data-owner-style="padding" type="range" min="8" max="52" value="18"></label></div></section>
        <section class="owner-panel-section"><strong>Media & Icons</strong><label>Image URL<input data-owner-asset="image" placeholder="Paste image URL"></label><label>Icon<select data-owner-asset="icon">${Object.keys(ICONS).map((key) => `<option value="${key}">${key}</option>`).join('')}</select></label><button type="button" data-owner-apply-asset>Apply Media/Icon</button></section>
        <section class="owner-panel-section"><strong>Layout</strong><div class="owner-inspector-grid"><button type="button" data-owner-move="up">Move Up</button><button type="button" data-owner-move="down">Move Down</button></div><div class="owner-inspector-grid"><button type="button" data-owner-duplicate>Duplicate</button><button type="button" data-owner-remove>Remove</button></div></section>
        <section class="owner-panel-section"><strong>Add</strong><label>Block<select data-owner-insert-type><option value="section">Section</option><option value="card">Glass Card</option><option value="image">Image</option><option value="map">Map</option><option value="dev">Dev Block</option><option value="button">Button</option><option value="icon">Icon</option></select></label><button type="button" data-owner-insert-selected>Add Block</button></section>
        <div class="owner-inspector-actions"><button type="button" data-owner-save>Save</button><button type="button" data-owner-studio>Studio</button></div>
      `;
      panel.querySelector('[data-owner-save]').addEventListener('click', () => { saveAll(); toast('Saved locally'); });
      panel.querySelector('[data-owner-studio]').addEventListener('click', () => location.assign('/website-builder.html'));
      panel.querySelector('[data-owner-remove]').addEventListener('click', removeSelected);
      panel.querySelector('[data-owner-duplicate]').addEventListener('click', duplicateSelected);
      panel.querySelector('[data-owner-apply-asset]').addEventListener('click', applyAsset);
      panel.querySelector('[data-owner-insert-selected]').addEventListener('click', () => addBlock(panel.querySelector('[data-owner-insert-type]')?.value || 'section'));
      panel.querySelectorAll('[data-owner-move]').forEach((button) => button.addEventListener('click', () => moveSelected(button.dataset.ownerMove)));
      panel.querySelectorAll('[data-owner-style]').forEach((input) => input.addEventListener('input', () => applyStyle(input.dataset.ownerStyle, input.value)));
      document.body.appendChild(panel);
    }
  }

  function editableHost() { return document.querySelector('main') || document.querySelector('#appRoot') || document.body; }
  function isMediaNode(node) { return node?.matches?.('img,svg,.eva-icon,.eva-menu-icon,.eva-bottom-icon,.app-icon-logo-img,.owner-icon-token'); }
  function blockFor(node) { return isMediaNode(node) ? node : (node?.closest('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card') || node); }
  function pageBlocks() { const id = pageId(); blocks[id] = Array.isArray(blocks[id]) ? blocks[id] : []; return blocks[id]; }

  function selectNode(node) {
    if (!enabled || !node) return;
    selected?.classList.remove('owner-selected');
    selected = blockFor(node);
    selected?.classList.add('owner-selected');
    document.querySelector('.owner-inspector')?.classList.add('is-visible');
  }

  function addEditChip(node) {
    if (!node || !(node instanceof HTMLElement) || node.querySelector(':scope > .owner-edit-chip')) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'owner-edit-chip';
    chip.textContent = 'Edit';
    chip.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); selectNode(node); const editable = node.matches('[data-owner-edit]') ? node : node.querySelector('[data-owner-edit]'); if (editable && enabled) editable.focus?.(); });
    node.appendChild(chip);
  }

  function template(type, id) {
    const edit = (name) => `${id}-${name}`;
    const mapBox = '<div style="width:100%;min-height:150px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.06));border:1px solid rgba(255,255,255,.22)">Map</div>';
    return {
      section: `<strong data-owner-edit="${edit('title')}">New section</strong><small data-owner-edit="${edit('copy')}">Edit this section directly. Move it from the inspector.</small>`,
      card: `<strong data-owner-edit="${edit('title')}">Glass card</strong><small data-owner-edit="${edit('copy')}">Shape the glass, spacing, and content from the inspector.</small>`,
      image: `<img data-owner-key="${edit('image')}" alt="Owner image" style="width:100%;min-height:150px;border-radius:18px;object-fit:cover;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22)"><small data-owner-edit="${edit('copy')}">Image placeholder</small>`,
      map: `<strong data-owner-edit="${edit('title')}">Map block</strong>${mapBox}<small data-owner-edit="${edit('copy')}">Connect Google Maps/location data next.</small>`,
      dev: `<strong data-owner-edit="${edit('title')}">Developer block</strong><small data-owner-edit="${edit('copy')}">Advanced owner/senior engineer module placeholder.</small>`,
      button: `<button class="btn btn-theme-primary" data-owner-edit="${edit('button')}">New Button</button>`,
      icon: `<span class="owner-icon-token" data-owner-key="${edit('icon')}">${ICONS.brand}</span><small data-owner-edit="${edit('copy')}">Icon block</small>`
    }[type] || `<strong data-owner-edit="${edit('title')}">New section</strong>`;
  }

  function createBlock(type = 'section', id = uniqueId('block')) {
    const block = document.createElement(type === 'button' ? 'div' : 'section');
    block.className = type === 'card' ? 'glass-card owner-drop-zone' : 'owner-drop-zone';
    block.dataset.ownerBlock = id;
    block.dataset.ownerKey = id;
    block.draggable = enabled;
    block.innerHTML = template(type, id);
    return block;
  }

  function addBlock(type = 'section') {
    const id = uniqueId(type);
    const block = createBlock(type, id);
    const host = selected?.parentElement || editableHost();
    if (selected && selected.parentNode === host) host.insertBefore(block, selected.nextSibling); else host.appendChild(block);
    pageBlocks().push({ id, type });
    saveAll(); bindAll(); selectNode(block); toast(`${type} added`);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = selected.cloneNode(true);
    copy.dataset.ownerKey = uniqueId('copy');
    copy.dataset.ownerBlock = copy.dataset.ownerBlock ? copy.dataset.ownerKey : copy.dataset.ownerBlock;
    copy.querySelectorAll('[data-owner-bound],[data-owner-drag-bound],.owner-edit-chip').forEach((node) => node.remove?.());
    selected.parentNode?.insertBefore(copy, selected.nextSibling);
    bindAll(); selectNode(copy); toast('Duplicated');
  }

  function renderSavedBlocks() {
    const host = editableHost();
    pageBlocks().forEach((item) => { if (!document.querySelector(`[data-owner-block="${item.id}"]`)) host.appendChild(createBlock(item.type, item.id)); });
  }

  function applyDrafts() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => { const saved = edits[nodeKey(node)]; if (saved) node.textContent = saved; });
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card,img,.owner-icon-token').forEach((node) => {
      const key = nodeKey(node);
      const savedStyle = styles[key]; if (savedStyle) Object.assign(node.style, savedStyle);
      const savedAsset = assets[key];
      if (savedAsset?.src && node.tagName === 'IMG') node.src = savedAsset.src;
      if (savedAsset?.icon && node.classList.contains('owner-icon-token')) node.textContent = ICONS[savedAsset.icon] || savedAsset.icon;
    });
  }

  function applyStyle(kind, value) {
    if (!selected) return;
    const key = nodeKey(selected); styles[key] = styles[key] || {};
    if (kind === 'radius') { selected.style.borderRadius = `${value}px`; styles[key].borderRadius = `${value}px`; }
    if (kind === 'padding') { selected.style.padding = `${value}px`; styles[key].padding = `${value}px`; }
    if (kind === 'glass') {
      const bg = value === 'strong' ? 'linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))' : value === 'soft' ? 'linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.06))' : value === 'glass' ? 'linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,.10))' : '';
      selected.style.background = bg; styles[key].background = bg;
    }
    saveAll();
  }

  function applyAsset() {
    if (!selected) return;
    const panel = document.querySelector('.owner-inspector');
    const imageUrl = panel?.querySelector('[data-owner-asset="image"]')?.value?.trim();
    const icon = panel?.querySelector('[data-owner-asset="icon"]')?.value || 'brand';
    const key = nodeKey(selected); assets[key] = assets[key] || {};
    if (selected.tagName === 'IMG' && imageUrl) { selected.src = imageUrl; assets[key].src = imageUrl; toast('Image updated'); }
    else if (selected.classList.contains('owner-icon-token')) { selected.textContent = ICONS[icon] || icon; assets[key].icon = icon; toast('Icon updated'); }
    else {
      const img = selected.querySelector?.('img'); const iconNode = selected.querySelector?.('.owner-icon-token');
      if (img && imageUrl) { const imgKey = nodeKey(img); assets[imgKey] = { src: imageUrl }; img.src = imageUrl; toast('Image updated'); }
      else if (iconNode) { const iconKey = nodeKey(iconNode); assets[iconKey] = { icon }; iconNode.textContent = ICONS[icon] || icon; toast('Icon updated'); }
      else toast('Select an image or icon block first');
    }
    saveAll();
  }

  function moveSelected(direction) {
    if (!selected || !selected.parentNode) return;
    const parent = selected.parentNode;
    if (direction === 'up' && selected.previousElementSibling) parent.insertBefore(selected, selected.previousElementSibling);
    if (direction === 'down' && selected.nextElementSibling) parent.insertBefore(selected.nextElementSibling, selected);
    toast(direction === 'up' ? 'Moved up' : 'Moved down');
  }

  function removeSelected() {
    if (!selected) return;
    const id = selected.dataset.ownerBlock;
    if (id) blocks[pageId()] = pageBlocks().filter((item) => item.id !== id);
    selected.remove(); selected = null; saveAll();
    document.querySelector('.owner-inspector')?.classList.remove('is-visible'); toast('Removed');
  }

  function bindEditableNodes() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      if (node.dataset.ownerBound !== 'true') {
        node.dataset.ownerBound = 'true';
        node.addEventListener('click', () => selectNode(node));
        node.addEventListener('focus', () => selectNode(node));
        node.addEventListener('input', () => { edits[nodeKey(node)] = node.textContent.trim(); });
        node.addEventListener('blur', saveAll);
      }
      addEditChip(blockFor(node));
    });
  }

  function bindDraggableBlocks() {
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card,img,.owner-icon-token,.eva-icon,.eva-menu-icon,.eva-bottom-icon').forEach((node) => {
      if (node.dataset.ownerDragBound !== 'true') {
        node.dataset.ownerDragBound = 'true';
        node.addEventListener('click', () => selectNode(node));
        node.addEventListener('dragstart', (event) => { if (!enabled) return event.preventDefault(); node.classList.add('owner-dragging'); event.dataTransfer.setData('text/plain', 'owner-block'); selected = node; });
        node.addEventListener('dragend', () => node.classList.remove('owner-dragging'));
        node.addEventListener('dragover', (event) => { if (!enabled || !selected || selected === node) return; event.preventDefault(); });
        node.addEventListener('drop', (event) => { if (!enabled || !selected || selected === node) return; event.preventDefault(); node.parentNode.insertBefore(selected, node.nextSibling); toast('Moved'); });
      }
      addEditChip(node instanceof HTMLElement ? node : node.parentElement);
    });
  }

  function bindAll() { renderSavedBlocks(); applyDrafts(); bindEditableNodes(); bindDraggableBlocks(); }

  function toggleEditor() {
    enabled = !enabled;
    document.documentElement.classList.toggle('owner-editor-on', enabled);
    document.querySelector('.owner-editor-fab')?.classList.toggle('is-on', enabled);
    document.querySelector('.owner-inspector')?.classList.toggle('is-visible', enabled && !!selected);
    document.querySelectorAll('[data-owner-edit]').forEach((node) => { node.contentEditable = enabled ? 'plaintext-only' : 'false'; node.spellcheck = enabled; });
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card').forEach((node) => { node.draggable = enabled; });
    toast(enabled ? 'Live editing enabled' : 'Live editing disabled');
  }

  function expose(role = '') {
    const allowed = roleAllowed(role);
    document.querySelector('.owner-editor-fab')?.classList.toggle('is-visible', allowed);
    if (!allowed) { enabled = false; document.documentElement.classList.remove('owner-editor-on'); document.querySelector('.owner-inspector')?.classList.remove('is-visible'); }
  }

  function boot() {
    ensureStyle(); ensureUi(); bindAll();
    expose(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', (event) => expose(event.detail?.role || ''), { passive: true });
    new MutationObserver(() => bindAll()).observe(document.body, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();