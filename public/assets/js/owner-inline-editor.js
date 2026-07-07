(() => {
  'use strict';
  const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
  const STORE_KEY = 'evaraos-owner-inline-edits-v3';
  const STYLE_KEY = 'evaraos-owner-style-edits-v1';
  let enabled = false;
  let edits = read(STORE_KEY);
  let styles = read(STYLE_KEY);
  let selected = null;

  function read(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function saveEdits() { write(STORE_KEY, edits); write(STYLE_KEY, styles); }
  function roleAllowed(role = '') { return OWNER_ROLES.has(String(role || '').toLowerCase().replace(/\s+/g, '_')); }
  function nodeKey(node) { if (!node.dataset.ownerKey) node.dataset.ownerKey = node.dataset.ownerEdit || node.dataset.ownerBlock || `owner-${Date.now()}-${Math.random().toString(16).slice(2)}`; return `${location.pathname}::${node.dataset.ownerKey}`; }

  function ensureStyle() {
    if (document.getElementById('ownerInlineEditorStyle')) return;
    const style = document.createElement('style');
    style.id = 'ownerInlineEditorStyle';
    style.textContent = `
      [data-owner-edit],[data-owner-block]{position:relative!important;}
      html.owner-editor-on [data-owner-edit],html.owner-editor-on [data-owner-block],html.owner-editor-on .glass-card{outline:1.5px dashed rgba(255,255,255,.44)!important;outline-offset:6px!important;border-radius:16px!important;}
      html.owner-editor-on [data-owner-edit]{cursor:text!important;}
      html.owner-editor-on [data-owner-block],html.owner-editor-on .glass-card{cursor:grab!important;}
      html.owner-editor-on .owner-selected{outline:2px solid rgba(242,23,45,.95)!important;outline-offset:8px!important;box-shadow:0 0 0 8px rgba(242,23,45,.10)!important;}
      html.owner-editor-on .owner-dragging{opacity:.55!important;transform:scale(.985)!important;}
      .owner-editor-fab{position:fixed!important;right:18px!important;bottom:calc(156px + env(safe-area-inset-bottom,0px))!important;z-index:9997!important;display:none!important;padding:12px 14px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.13))!important;border:1px solid rgba(255,255,255,.45)!important;color:var(--text-primary,#fff)!important;font-weight:950!important;box-shadow:0 18px 44px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.38)!important;backdrop-filter:blur(24px) saturate(1.35)!important;-webkit-backdrop-filter:blur(24px) saturate(1.35)!important;}
      .owner-editor-fab.is-visible{display:flex!important;}
      .owner-editor-fab.is-on{background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(242,23,45,.18))!important;}
      .owner-inspector{position:fixed!important;right:16px!important;top:calc(92px + env(safe-area-inset-top,0px))!important;width:min(330px,calc(100vw - 32px))!important;max-height:calc(100vh - 190px)!important;overflow:auto!important;z-index:9998!important;display:none!important;gap:10px!important;padding:14px!important;border-radius:24px!important;background:linear-gradient(145deg,rgba(255,255,255,.25),rgba(10,12,18,.72))!important;border:1px solid rgba(255,255,255,.32)!important;box-shadow:0 24px 62px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.28)!important;backdrop-filter:blur(28px) saturate(1.35)!important;-webkit-backdrop-filter:blur(28px) saturate(1.35)!important;color:#fff!important;}
      .owner-inspector.is-visible{display:grid!important;}
      .owner-inspector h3{margin:0!important;font-size:1.05rem!important;letter-spacing:-.04em!important;}
      .owner-inspector p{margin:0!important;color:rgba(255,255,255,.72)!important;font-size:.82rem!important;line-height:1.4!important;}
      .owner-inspector label{display:grid!important;gap:6px!important;font-size:.75rem!important;font-weight:900!important;color:rgba(255,255,255,.75)!important;}
      .owner-inspector input,.owner-inspector select{height:38px!important;border-radius:13px!important;border:1px solid rgba(255,255,255,.28)!important;background:rgba(255,255,255,.12)!important;color:#fff!important;padding:0 10px!important;}
      .owner-inspector-actions,.owner-inspector-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;}
      .owner-inspector button{border:1px solid rgba(255,255,255,.26)!important;border-radius:13px!important;padding:9px 10px!important;color:#fff!important;background:rgba(255,255,255,.14)!important;font-weight:900!important;}
      .owner-inspector button:hover{background:rgba(255,255,255,.24)!important;}
      .owner-drop-zone{border:1.5px dashed rgba(255,255,255,.44)!important;border-radius:24px!important;padding:18px!important;display:grid!important;place-items:center!important;text-align:center!important;min-height:86px!important;color:var(--text-secondary,rgba(255,255,255,.72))!important;background:rgba(255,255,255,.07)!important;}
      .owner-editor-toast{position:fixed!important;left:50%!important;top:calc(env(safe-area-inset-top,0px) + 18px)!important;transform:translateX(-50%) translateY(-12px)!important;opacity:0!important;z-index:9999!important;padding:12px 14px!important;border-radius:18px!important;color:#fff!important;background:rgba(10,12,18,.76)!important;border:1px solid rgba(255,255,255,.32)!important;backdrop-filter:blur(22px)!important;transition:.2s ease!important;}
      .owner-editor-toast.is-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}
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
      panel.innerHTML = '<h3>Owner Inspector</h3><p>Select text, a glass card, or a section. Edit it directly, then adjust layout and content here.</p><label>Glass style<select data-owner-style="glass"><option value="">Default</option><option value="glass">Liquid Glass</option><option value="soft">Soft Glass</option><option value="strong">Strong Glass</option></select></label><div class="owner-inspector-grid"><label>Radius<input data-owner-style="radius" type="range" min="8" max="40" value="24"></label><label>Padding<input data-owner-style="padding" type="range" min="8" max="48" value="18"></label></div><div class="owner-inspector-grid"><button type="button" data-owner-move="up">Move Up</button><button type="button" data-owner-move="down">Move Down</button></div><div class="owner-inspector-actions"><button type="button" data-owner-insert="section">Add Section</button><button type="button" data-owner-insert="card">Add Card</button><button type="button" data-owner-insert="image">Add Image</button><button type="button" data-owner-insert="map">Add Map</button><button type="button" data-owner-insert="dev">Dev Block</button><button type="button" data-owner-remove>Remove</button></div><div class="owner-inspector-actions"><button type="button" data-owner-save>Save</button><button type="button" data-owner-studio>Studio</button></div>';
      panel.querySelector('[data-owner-save]').addEventListener('click', () => { saveEdits(); toast('Saved locally'); });
      panel.querySelector('[data-owner-studio]').addEventListener('click', () => location.assign('/website-builder.html'));
      panel.querySelector('[data-owner-remove]').addEventListener('click', removeSelected);
      panel.querySelectorAll('[data-owner-insert]').forEach((button) => button.addEventListener('click', () => addBlock(button.dataset.ownerInsert)));
      panel.querySelectorAll('[data-owner-move]').forEach((button) => button.addEventListener('click', () => moveSelected(button.dataset.ownerMove)));
      panel.querySelectorAll('[data-owner-style]').forEach((input) => input.addEventListener('input', () => applyStyle(input.dataset.ownerStyle, input.value)));
      document.body.appendChild(panel);
    }
  }

  function toast(message) {
    let node = document.querySelector('.owner-editor-toast');
    if (!node) { node = document.createElement('div'); node.className = 'owner-editor-toast'; document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1400);
  }

  function editableHost() { return document.querySelector('main') || document.querySelector('#appRoot') || document.body; }
  function blockFor(node) { return node?.closest('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card') || node; }

  function selectNode(node) {
    if (!enabled || !node) return;
    selected?.classList.remove('owner-selected');
    selected = blockFor(node);
    selected?.classList.add('owner-selected');
    document.querySelector('.owner-inspector')?.classList.add('is-visible');
  }

  function applyDrafts() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => { const key = nodeKey(node); if (edits[key]) node.textContent = edits[key]; });
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card').forEach((node) => { const saved = styles[nodeKey(node)]; if (saved) Object.assign(node.style, saved); });
  }

  function addBlock(type = 'section') {
    const host = selected?.parentElement || editableHost();
    const block = document.createElement(type === 'button' ? 'div' : 'section');
    block.className = type === 'card' ? 'glass-card owner-drop-zone' : 'owner-drop-zone';
    block.dataset.ownerBlock = `custom-${Date.now()}`;
    block.draggable = enabled;
    const content = {
      section: '<strong data-owner-edit="customTitle">New section</strong><small data-owner-edit="customCopy">Edit this section directly. Move it from the inspector.</small>',
      card: '<strong data-owner-edit="customCardTitle">Glass card</strong><small data-owner-edit="customCardCopy">Use the inspector for glass, spacing, movement, images, maps, and dev blocks.</small>',
      image: '<img alt="Owner image placeholder" style="max-width:100%;border-radius:18px;min-height:120px;background:rgba(255,255,255,.12);"><small data-owner-edit="imageCopy">Image placeholder</small>',
      map: '<strong>Map block</strong><small data-owner-edit="mapCopy">Map placeholder — connect Google Maps/location data next.</small>',
      dev: '<strong>Developer block</strong><small data-owner-edit="devCopy">Advanced module placeholder for owner/senior engineer logic.</small>',
      button: '<button class="btn btn-theme-primary" data-owner-edit="buttonText">New Button</button>'
    }[type] || '<strong data-owner-edit="customTitle">New section</strong>';
    block.innerHTML = content;
    if (selected && selected.parentNode === host) host.insertBefore(block, selected.nextSibling); else host.appendChild(block);
    bindEditableNodes(); bindDraggableBlocks(); selectNode(block); toast(`${type} added`);
  }

  function applyStyle(kind, value) {
    if (!selected) return;
    const key = nodeKey(selected);
    styles[key] = styles[key] || {};
    if (kind === 'radius') { selected.style.borderRadius = `${value}px`; styles[key].borderRadius = `${value}px`; }
    if (kind === 'padding') { selected.style.padding = `${value}px`; styles[key].padding = `${value}px`; }
    if (kind === 'glass') {
      selected.style.background = value === 'strong' ? 'linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))' : value === 'soft' ? 'linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.06))' : '';
      styles[key].background = selected.style.background;
    }
    saveEdits();
  }

  function moveSelected(direction) {
    if (!selected || !selected.parentNode) return;
    const parent = selected.parentNode;
    direction === 'up' ? parent.insertBefore(selected, selected.previousElementSibling) : parent.insertBefore(selected.nextElementSibling, selected);
    toast(direction === 'up' ? 'Moved up' : 'Moved down');
  }

  function removeSelected() { if (!selected) return; const node = selected; selected = null; node.remove(); toast('Removed'); }

  function bindEditableNodes() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      if (node.dataset.ownerBound === 'true') return;
      node.dataset.ownerBound = 'true';
      node.addEventListener('click', () => selectNode(node));
      node.addEventListener('focus', () => selectNode(node));
      node.addEventListener('input', () => { edits[nodeKey(node)] = node.textContent.trim(); });
      node.addEventListener('blur', saveEdits);
    });
  }

  function bindDraggableBlocks() {
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card').forEach((node) => {
      if (node.dataset.ownerDragBound === 'true') return;
      node.dataset.ownerDragBound = 'true';
      node.addEventListener('click', () => selectNode(node));
      node.addEventListener('dragstart', (event) => { if (!enabled) return event.preventDefault(); node.classList.add('owner-dragging'); event.dataTransfer.setData('text/plain', 'owner-block'); selected = node; });
      node.addEventListener('dragend', () => node.classList.remove('owner-dragging'));
      node.addEventListener('dragover', (event) => { if (!enabled || !selected || selected === node) return; event.preventDefault(); });
      node.addEventListener('drop', (event) => { if (!enabled || !selected || selected === node) return; event.preventDefault(); node.parentNode.insertBefore(selected, node.nextSibling); toast('Moved'); });
    });
  }

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
    ensureStyle(); ensureUi(); applyDrafts(); bindEditableNodes(); bindDraggableBlocks();
    expose(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', (event) => expose(event.detail?.role || ''), { passive: true });
    new MutationObserver(() => { applyDrafts(); bindEditableNodes(); bindDraggableBlocks(); }).observe(document.body, { childList: true, subtree: true });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();