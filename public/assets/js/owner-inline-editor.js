(() => {
  'use strict';
  const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
  const STORE_KEY = 'evaraos-owner-inline-edits-v2';
  let enabled = false;
  let edits = readEdits();
  let selected = null;

  function roleAllowed(role = '') {
    const normalized = String(role || '').toLowerCase().replace(/\s+/g, '_');
    return OWNER_ROLES.has(normalized);
  }
  function readEdits() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; } }
  function saveEdits() { try { localStorage.setItem(STORE_KEY, JSON.stringify(edits)); } catch {} }
  function keyFor(node) { return `${location.pathname}::${node.dataset.ownerEdit || node.dataset.ownerBlock}`; }

  function ensureStyle() {
    if (document.getElementById('ownerInlineEditorStyle')) return;
    const style = document.createElement('style');
    style.id = 'ownerInlineEditorStyle';
    style.textContent = `
      [data-owner-edit],[data-owner-block]{position:relative!important;}
      html.owner-editor-on [data-owner-edit],html.owner-editor-on [data-owner-block]{outline:1.5px dashed rgba(255,255,255,.52)!important;outline-offset:6px!important;border-radius:14px!important;cursor:text!important;}
      html.owner-editor-on [data-owner-block]{cursor:grab!important;}
      html.owner-editor-on [data-owner-edit]:hover,html.owner-editor-on [data-owner-block]:hover{outline-color:rgba(242,23,45,.86)!important;box-shadow:0 0 0 6px rgba(242,23,45,.08)!important;}
      html.owner-editor-on .owner-selected{outline:2px solid rgba(242,23,45,.95)!important;outline-offset:7px!important;}
      html.owner-editor-on .owner-dragging{opacity:.62!important;transform:scale(.985)!important;}
      .owner-editor-fab{position:fixed!important;right:18px!important;bottom:calc(156px + env(safe-area-inset-bottom,0px))!important;z-index:9997!important;display:none!important;gap:8px!important;align-items:center!important;padding:12px 14px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.13))!important;border:1px solid rgba(255,255,255,.45)!important;color:var(--text-primary,#fff)!important;font-weight:950!important;box-shadow:0 18px 44px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.38)!important;backdrop-filter:blur(24px) saturate(1.35)!important;-webkit-backdrop-filter:blur(24px) saturate(1.35)!important;}
      .owner-editor-fab.is-visible{display:flex!important;}
      .owner-editor-fab.is-on{background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(242,23,45,.18))!important;}
      .owner-editor-toolbar{position:fixed!important;left:50%!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;transform:translateX(-50%) translateY(16px)!important;opacity:0!important;pointer-events:none!important;z-index:9998!important;display:flex!important;gap:8px!important;padding:10px!important;border-radius:22px!important;background:linear-gradient(145deg,rgba(255,255,255,.23),rgba(10,12,18,.66))!important;border:1px solid rgba(255,255,255,.30)!important;backdrop-filter:blur(24px) saturate(1.25)!important;-webkit-backdrop-filter:blur(24px) saturate(1.25)!important;box-shadow:0 18px 42px rgba(0,0,0,.28)!important;}
      .owner-editor-toolbar.is-visible{opacity:1!important;pointer-events:auto!important;transform:translateX(-50%) translateY(0)!important;}
      .owner-editor-toolbar button{border:1px solid rgba(255,255,255,.24)!important;border-radius:15px!important;padding:10px 12px!important;color:#fff!important;background:rgba(255,255,255,.15)!important;font-weight:900!important;}
      .owner-editor-toolbar button:hover{background:rgba(255,255,255,.24)!important;}
      .owner-drop-zone{border:1.5px dashed rgba(255,255,255,.44)!important;border-radius:24px!important;padding:18px!important;display:grid!important;place-items:center!important;text-align:center!important;min-height:86px!important;color:var(--text-secondary,rgba(255,255,255,.72))!important;background:rgba(255,255,255,.07)!important;}
      .owner-editor-toast{position:fixed!important;left:50%!important;top:calc(env(safe-area-inset-top,0px) + 18px)!important;transform:translateX(-50%) translateY(-12px)!important;opacity:0!important;z-index:9999!important;padding:12px 14px!important;border-radius:18px!important;color:#fff!important;background:rgba(10,12,18,.76)!important;border:1px solid rgba(255,255,255,.32)!important;backdrop-filter:blur(22px)!important;transition:.2s ease!important;}
      .owner-editor-toast.is-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}
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
    if (!document.querySelector('.owner-editor-toolbar')) {
      const bar = document.createElement('div');
      bar.className = 'owner-editor-toolbar';
      bar.innerHTML = '<button type="button" data-owner-add="section">+ Section</button><button type="button" data-owner-add="card">+ Card</button><button type="button" data-owner-add="button">+ Button</button><button type="button" data-owner-save>Save</button><button type="button" data-owner-reset>Reset</button><button type="button" data-owner-builder>Studio</button>';
      bar.querySelector('[data-owner-save]').addEventListener('click', () => { saveEdits(); toast('Saved locally'); });
      bar.querySelector('[data-owner-reset]').addEventListener('click', resetPage);
      bar.querySelector('[data-owner-builder]').addEventListener('click', () => location.assign('/website-builder.html'));
      bar.querySelectorAll('[data-owner-add]').forEach((button) => button.addEventListener('click', () => addBlock(button.dataset.ownerAdd)));
      document.body.appendChild(bar);
    }
  }

  function toast(message) {
    let node = document.querySelector('.owner-editor-toast');
    if (!node) { node = document.createElement('div'); node.className = 'owner-editor-toast'; document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1500);
  }

  function applyDrafts() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      const key = keyFor(node);
      if (edits[key]) node.textContent = edits[key];
    });
  }

  function editableHost() { return document.querySelector('main') || document.querySelector('#appRoot') || document.body; }

  function addBlock(type = 'section') {
    const host = editableHost();
    const block = document.createElement(type === 'button' ? 'div' : 'section');
    block.className = type === 'card' ? 'glass-card owner-drop-zone' : 'owner-drop-zone';
    block.dataset.ownerBlock = `custom-${Date.now()}`;
    block.draggable = enabled;
    block.innerHTML = type === 'button' ? '<button class="btn btn-theme-primary" data-owner-edit="buttonText">New Button</button>' : '<strong data-owner-edit="customTitle">New section</strong><small data-owner-edit="customCopy">Click Live Edit, then type directly here. Drag to move.</small>';
    host.appendChild(block);
    bindEditableNodes();
    bindDraggableBlocks();
    toast(`${type} added`);
  }

  function bindEditableNodes() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      if (node.dataset.ownerBound === 'true') return;
      node.dataset.ownerBound = 'true';
      node.addEventListener('focus', () => document.querySelector('.owner-editor-toolbar')?.classList.add('is-visible'));
      node.addEventListener('input', () => { edits[keyFor(node)] = node.textContent.trim(); });
      node.addEventListener('blur', saveEdits);
    });
  }

  function bindDraggableBlocks() {
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card').forEach((node) => {
      if (node.dataset.ownerDragBound === 'true') return;
      node.dataset.ownerDragBound = 'true';
      node.addEventListener('click', () => { if (!enabled) return; selected?.classList.remove('owner-selected'); selected = node; selected.classList.add('owner-selected'); });
      node.addEventListener('dragstart', (event) => { if (!enabled) return event.preventDefault(); node.classList.add('owner-dragging'); event.dataTransfer.setData('text/plain', 'owner-block'); selected = node; });
      node.addEventListener('dragend', () => node.classList.remove('owner-dragging'));
      node.addEventListener('dragover', (event) => { if (!enabled || !selected || selected === node) return; event.preventDefault(); });
      node.addEventListener('drop', (event) => {
        if (!enabled || !selected || selected === node) return;
        event.preventDefault();
        node.parentNode.insertBefore(selected, node.nextSibling);
        toast('Moved');
      });
    });
  }

  function toggleEditor() {
    enabled = !enabled;
    document.documentElement.classList.toggle('owner-editor-on', enabled);
    document.querySelector('.owner-editor-fab')?.classList.toggle('is-on', enabled);
    document.querySelector('.owner-editor-toolbar')?.classList.toggle('is-visible', enabled);
    document.querySelectorAll('[data-owner-edit]').forEach((node) => { node.contentEditable = enabled ? 'plaintext-only' : 'false'; node.spellcheck = enabled; });
    document.querySelectorAll('[data-owner-block],.glass-card,.studio-section,.app-icon-current-card,.app-icon-background-card').forEach((node) => { node.draggable = enabled; });
    toast(enabled ? 'Live editing enabled' : 'Live editing disabled');
  }

  function resetPage() {
    Object.keys(edits).filter((key) => key.startsWith(`${location.pathname}::`)).forEach((key) => delete edits[key]);
    saveEdits();
    location.reload();
  }

  function expose(role = '') {
    const allowed = roleAllowed(role);
    document.querySelector('.owner-editor-fab')?.classList.toggle('is-visible', allowed);
    if (!allowed) {
      enabled = false;
      document.documentElement.classList.remove('owner-editor-on');
      document.querySelector('.owner-editor-toolbar')?.classList.remove('is-visible');
    }
  }

  function boot() {
    ensureStyle(); ensureUi(); applyDrafts(); bindEditableNodes(); bindDraggableBlocks();
    expose(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', (event) => expose(event.detail?.role || ''), { passive: true });
    new MutationObserver(() => { applyDrafts(); bindEditableNodes(); bindDraggableBlocks(); }).observe(document.body, { childList: true, subtree: true });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();