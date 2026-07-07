(() => {
  'use strict';
  const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
  const STORE_KEY = 'evaraos-owner-inline-edits-v1';
  let enabled = false;
  let edits = readEdits();

  function roleAllowed(role = '') {
    const normalized = String(role || '').toLowerCase().replace(/\s+/g, '_');
    return OWNER_ROLES.has(normalized);
  }

  function readEdits() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
  }

  function saveEdits() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(edits)); } catch {}
  }

  function ensureStyle() {
    if (document.getElementById('ownerInlineEditorStyle')) return;
    const style = document.createElement('style');
    style.id = 'ownerInlineEditorStyle';
    style.textContent = `
      [data-owner-edit]{position:relative!important;}
      html.owner-editor-on [data-owner-edit]{outline:1.5px dashed rgba(255,255,255,.55)!important;outline-offset:6px!important;border-radius:12px!important;cursor:text!important;}
      html.owner-editor-on [data-owner-edit]:hover{outline-color:rgba(242,23,45,.85)!important;box-shadow:0 0 0 6px rgba(242,23,45,.08)!important;}
      html.owner-editor-on [data-owner-edit].is-empty:before{content:'+'!important;position:absolute!important;right:-10px!important;top:-10px!important;width:24px!important;height:24px!important;border-radius:999px!important;display:grid!important;place-items:center!important;background:rgba(255,255,255,.75)!important;color:#e30613!important;font-weight:950!important;backdrop-filter:blur(18px)!important;z-index:20!important;}
      .owner-editor-fab{position:fixed!important;right:18px!important;bottom:calc(94px + env(safe-area-inset-bottom,0px))!important;z-index:9997!important;display:none!important;gap:8px!important;align-items:center!important;padding:12px 14px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.13))!important;border:1px solid rgba(255,255,255,.45)!important;color:var(--text-primary,#fff)!important;font-weight:950!important;box-shadow:0 18px 44px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.38)!important;backdrop-filter:blur(24px) saturate(1.35)!important;-webkit-backdrop-filter:blur(24px) saturate(1.35)!important;}
      .owner-editor-fab.is-visible{display:flex!important;}
      .owner-editor-fab.is-on{background:linear-gradient(145deg,rgba(242,23,45,.38),rgba(255,255,255,.13))!important;}
      .owner-editor-toolbar{position:fixed!important;left:50%!important;bottom:calc(146px + env(safe-area-inset-bottom,0px))!important;transform:translateX(-50%) translateY(16px)!important;opacity:0!important;pointer-events:none!important;z-index:9998!important;display:flex!important;gap:8px!important;padding:10px!important;border-radius:20px!important;background:rgba(10,12,18,.72)!important;border:1px solid rgba(255,255,255,.28)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;box-shadow:0 18px 42px rgba(0,0,0,.28)!important;}
      .owner-editor-toolbar.is-visible{opacity:1!important;pointer-events:auto!important;transform:translateX(-50%) translateY(0)!important;}
      .owner-editor-toolbar button{border:0!important;border-radius:14px!important;padding:10px 12px!important;color:#fff!important;background:rgba(255,255,255,.15)!important;font-weight:900!important;}
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
      fab.textContent = 'Edit Page';
      fab.addEventListener('click', toggleEditor);
      document.body.appendChild(fab);
    }
    if (!document.querySelector('.owner-editor-toolbar')) {
      const bar = document.createElement('div');
      bar.className = 'owner-editor-toolbar';
      bar.innerHTML = '<button type="button" data-owner-save>Save draft</button><button type="button" data-owner-reset>Reset page</button><button type="button" data-owner-builder>Builder</button>';
      bar.querySelector('[data-owner-save]').addEventListener('click', () => { saveEdits(); toast('Draft saved locally'); });
      bar.querySelector('[data-owner-reset]').addEventListener('click', resetPage);
      bar.querySelector('[data-owner-builder]').addEventListener('click', () => location.assign('/website-builder.html'));
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

  function keyFor(node) {
    return `${location.pathname}::${node.dataset.ownerEdit}`;
  }

  function applyDrafts() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      const key = keyFor(node);
      if (edits[key]) node.textContent = edits[key];
      node.classList.toggle('is-empty', !String(node.textContent || '').trim());
    });
  }

  function bindEditableNodes() {
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      if (node.dataset.ownerBound === 'true') return;
      node.dataset.ownerBound = 'true';
      node.addEventListener('focus', () => document.querySelector('.owner-editor-toolbar')?.classList.add('is-visible'));
      node.addEventListener('input', () => {
        edits[keyFor(node)] = node.textContent.trim();
        node.classList.toggle('is-empty', !node.textContent.trim());
      });
      node.addEventListener('blur', saveEdits);
    });
  }

  function toggleEditor() {
    enabled = !enabled;
    document.documentElement.classList.toggle('owner-editor-on', enabled);
    document.querySelector('.owner-editor-fab')?.classList.toggle('is-on', enabled);
    document.querySelector('.owner-editor-toolbar')?.classList.toggle('is-visible', enabled);
    document.querySelectorAll('[data-owner-edit]').forEach((node) => {
      node.contentEditable = enabled ? 'plaintext-only' : 'false';
      node.spellcheck = enabled;
    });
    toast(enabled ? 'Inline editing enabled' : 'Inline editing disabled');
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
    ensureStyle();
    ensureUi();
    applyDrafts();
    bindEditableNodes();
    expose(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', (event) => expose(event.detail?.role || ''), { passive: true });
    new MutationObserver(() => { applyDrafts(); bindEditableNodes(); }).observe(document.body, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();