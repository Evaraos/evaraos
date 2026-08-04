import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getSavedUserProfile,
  getSavedUserRole,
  normalizeRole
} from '../firebase.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const CACHE_PREFIX = 'evaraos-app-builder-v1:';
const GLOBAL_SCOPE_ID = 'evaraos-platform';
const DEFAULTS = {
  version: 1,
  brand: {
    name: 'Evaraos',
    markUrl: '/assets/brand/evaraos-mark.png?v=brand-png-3',
    appIconUrl: '/assets/brand/evaraos-app-icon.png?v=brand-png-1',
    accent: '#f2172d'
  },
  loaders: {
    launch: {
      eyebrow: 'EVARAOS',
      title: 'Welcome to Evaraos',
      subtitle: 'Preparing your operating system.',
      logoUrl: '/assets/brand/evaraos-mark.png?v=brand-png-3',
      background: '#eef5fb'
    },
    resume: {
      title: 'Welcome back to Evaraos',
      subtitle: 'Refreshing your workspace.'
    },
    compact: {
      label: 'Loading Evaraos',
      logoUrl: '/assets/brand/evaraos-mark.png?v=brand-png-3',
      background: 'rgba(238,245,251,.42)'
    }
  },
  pages: {}
};

let state = structuredClone(DEFAULTS);
let mounted = false;
let storage = null;

function profile() { return getSavedUserProfile?.() || {}; }
function role() { return normalizeRole?.(profile().role || getSavedUserRole?.() || '') || ''; }
function allowed() { return role() === 'owner'; }
function companyId() {
  const assigned = String(profile().companyId || '').trim();
  if (assigned) return assigned;
  return role() === 'owner' ? GLOBAL_SCOPE_ID : '';
}
function scopeLabel(id = companyId()) { return id === GLOBAL_SCOPE_ID ? 'global EvaraOS' : 'company workspace'; }
function configDocument(id = companyId()) {
  return id === GLOBAL_SCOPE_ID
    ? doc(db, 'public_app_config', 'global')
    : doc(db, 'companies', id);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function merge(base, next) {
  if (!next || typeof next !== 'object' || Array.isArray(next)) return next ?? base;
  const output = { ...(base || {}) };
  Object.entries(next).forEach(([key, value]) => { output[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(output[key] || {}, value) : value; });
  return output;
}
function getPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) {
  const parts = path.split('.');
  let target = object;
  parts.slice(0, -1).forEach((key) => { target[key] = target[key] && typeof target[key] === 'object' ? target[key] : {}; target = target[key]; });
  target[parts.at(-1)] = value;
}
function status(message, tone = '') {
  const node = document.querySelector('[data-studio-owner-status]');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}
function cache(config) {
  const id = companyId();
  if (!id) return;
  try { localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(config)); } catch {}
}
function dispatch(config = state) {
  window.dispatchEvent(new CustomEvent('evara:app-builder-updated', { detail: { companyId: companyId(), config } }));
}

function safeImagePreviewUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate, window.location.origin);
    const sameOriginHttp = url.origin === window.location.origin && (url.protocol === 'https:' || url.protocol === 'http:');
    if (!sameOriginHttp && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

function setImagePreview(preview, value, fallback = '') {
  if (!(preview instanceof HTMLImageElement)) return;
  const safeUrl = safeImagePreviewUrl(value) || safeImagePreviewUrl(fallback);
  if (!safeUrl) {
    preview.removeAttribute('src');
    return;
  }
  preview.src = safeUrl;
}

function style() {
  if (document.getElementById('studioOwnerControlStyles')) return;
  const tag = document.createElement('style');
  tag.id = 'studioOwnerControlStyles';
  tag.textContent = `
    .studio-owner-control-fab{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:10020;border:1px solid rgba(255,255,255,.38);border-radius:999px;padding:12px 16px;background:linear-gradient(145deg,rgba(255,255,255,.32),rgba(242,23,45,.16));color:var(--text-primary,#fff);font:900 13px/1 system-ui;box-shadow:0 18px 54px rgba(0,0,0,.28);backdrop-filter:blur(24px) saturate(1.35);-webkit-backdrop-filter:blur(24px) saturate(1.35)}
    .studio-owner-control-panel{position:fixed;inset:calc(18px + env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px)) auto;width:min(560px,calc(100vw - 36px));z-index:10030;display:none;grid-template-rows:auto 1fr auto;border-radius:30px;overflow:hidden;color:var(--text-primary,#fff);background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(9,12,19,.82));border:1px solid rgba(255,255,255,.38);box-shadow:0 28px 90px rgba(0,0,0,.38);backdrop-filter:blur(34px) saturate(1.45);-webkit-backdrop-filter:blur(34px) saturate(1.45)}
    .studio-owner-control-panel.is-open{display:grid}.studio-owner-control-head,.studio-owner-control-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.14)}.studio-owner-control-foot{border-top:1px solid rgba(255,255,255,.14);border-bottom:0;flex-wrap:wrap}.studio-owner-control-head h2{margin:0;font-size:1.05rem}.studio-owner-control-head p{margin:4px 0 0;color:var(--text-secondary,rgba(255,255,255,.68));font-size:12px}.studio-owner-control-close{width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10);color:inherit;font-size:22px}.studio-owner-control-body{overflow:auto;padding:16px;display:grid;gap:14px}.studio-owner-config-section{display:grid;gap:11px;padding:14px;border-radius:22px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}.studio-owner-config-section h3{margin:0;font-size:.82rem;text-transform:uppercase;letter-spacing:.09em}.studio-owner-config-section p{margin:0;color:var(--text-secondary,rgba(255,255,255,.66));font-size:12px;line-height:1.45}.studio-owner-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.studio-owner-field{display:grid;gap:6px;font-size:11px;font-weight:850;color:var(--text-secondary,rgba(255,255,255,.72))}.studio-owner-field.is-wide{grid-column:1/-1}.studio-owner-field input,.studio-owner-field textarea{width:100%;min-width:0;border-radius:14px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.10);color:inherit;padding:10px 11px;font:inherit}.studio-owner-field input[type=color]{height:42px;padding:4px}.studio-owner-field textarea{min-height:74px;resize:vertical}.studio-owner-upload{display:grid;grid-template-columns:72px 1fr;gap:10px;align-items:center;padding:10px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.studio-owner-upload img{width:72px;height:72px;object-fit:contain;border-radius:16px;background:rgba(255,255,255,.08);padding:8px}.studio-owner-upload-actions{display:grid;gap:7px}.studio-owner-upload-actions input[type=file]{font-size:11px}.studio-owner-button{border:1px solid rgba(255,255,255,.28);border-radius:14px;padding:10px 13px;background:rgba(255,255,255,.12);color:inherit;font-weight:900}.studio-owner-button.is-primary{background:linear-gradient(145deg,rgba(242,23,45,.92),rgba(193,10,31,.92));border-color:rgba(255,255,255,.34)}[data-studio-owner-status]{font-size:12px;color:var(--text-secondary,rgba(255,255,255,.68))}[data-studio-owner-status][data-tone=success]{color:#7ff0b3}[data-studio-owner-status][data-tone=error]{color:#ff9da7}
    @media(max-width:720px){.studio-owner-control-panel{inset:8px 8px calc(8px + env(safe-area-inset-bottom,0px));width:auto;border-radius:24px}.studio-owner-control-fab{right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px))}.studio-owner-grid{grid-template-columns:1fr}.studio-owner-field.is-wide{grid-column:auto}.studio-owner-control-foot{align-items:stretch}.studio-owner-control-foot button{flex:1}}
  `;
  document.head.appendChild(tag);
}

function formConfig() {
  const next = clone(state);
  document.querySelectorAll('[data-config-path]').forEach((input) => setPath(next, input.dataset.configPath, input.value.trim()));
  next.version = 1;
  next.updatedAtMs = Date.now();
  next.updatedBy = auth.currentUser?.uid || profile().uid || '';
  return next;
}

function fill(config) {
  state = merge(clone(DEFAULTS), config || {});
  document.querySelectorAll('[data-config-path]').forEach((input) => { input.value = String(getPath(state, input.dataset.configPath) ?? ''); });
  document.querySelectorAll('[data-upload-preview]').forEach((img) => {
    setImagePreview(img, getPath(state, img.dataset.uploadPreview), DEFAULTS.brand.markUrl);
  });
}

function toggle(open) {
  const panel = document.querySelector('.studio-owner-control-panel');
  if (!panel) return;
  const next = typeof open === 'boolean' ? open : !panel.classList.contains('is-open');
  panel.classList.toggle('is-open', next);
  if (next) history.replaceState(null, '', `${location.pathname}${location.search}#app-settings`);
  else if (location.hash === '#app-settings') history.replaceState(null, '', `${location.pathname}${location.search}`);
}

async function load() {
  const id = companyId();
  if (!id) {
    fill(DEFAULTS);
    status('Select a company workspace before publishing tenant settings.', 'error');
    return;
  }
  try {
    const snapshot = await getDoc(configDocument(id));
    const existing = snapshot.exists() ? snapshot.data()?.appBuilder : null;
    fill(existing || DEFAULTS);
    cache(state);
    dispatch(state);
    status(existing ? `${scopeLabel(id)} settings loaded.` : `No ${scopeLabel(id)} settings yet. Defaults are ready.`, 'success');
  } catch (error) {
    console.error('Owner App Builder load failed:', error);
    fill(DEFAULTS);
    status('Settings could not be loaded.', 'error');
  }
}

async function publish() {
  if (!allowed()) return status('Owner access is required.', 'error');
  const id = companyId();
  if (!id) return status('Select a company workspace before publishing.', 'error');
  status('Publishing app settings…');
  try {
    const target = configDocument(id);
    const snapshot = await getDoc(target);
    const existing = snapshot.exists() ? snapshot.data()?.appBuilder || {} : {};
    const input = formConfig();
    const next = merge(existing, input);
    next.pages = existing.pages || input.pages || {};
    next.updatedAtMs = Date.now();
    next.updatedBy = auth.currentUser?.uid || profile().uid || '';
    await setDoc(target, { appBuilder: next, appBuilderUpdatedAt: serverTimestamp() }, { merge: true });
    state = next;
    cache(next);
    dispatch(next);
    status(`Published live to the ${scopeLabel(id)} scope.`, 'success');
  } catch (error) {
    console.error('Owner App Builder publish failed:', error);
    status(error?.message || 'Settings could not be published.', 'error');
  }
}

async function upload(target, file) {
  if (!file || !file.type.startsWith('image/')) return status('Choose an image file.', 'error');
  if (file.size > 8 * 1024 * 1024) return status('Keep logo uploads under 8 MB.', 'error');
  const id = companyId();
  if (!id) return status('Select a company workspace before uploading.', 'error');
  status(`Uploading ${file.name}…`);
  try {
    storage ||= getStorage(getApp());
    const extension = (file.name.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'png';
    const key = target.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const fileRef = ref(storage, `companies/${id}/app-builder-${key}-${Date.now()}.${extension}`);
    await uploadBytes(fileRef, file, { contentType: file.type, customMetadata: { ownerUid: auth.currentUser?.uid || profile().uid || '' } });
    const url = await getDownloadURL(fileRef);
    const input = document.querySelector(`[data-config-path="${CSS.escape(target)}"]`);
    if (input) input.value = url;
    const preview = document.querySelector(`[data-upload-preview="${CSS.escape(target)}"]`);
    setImagePreview(preview, url, DEFAULTS.brand.markUrl);
    dispatch(formConfig());
    status('Upload complete. Publish live when the preview looks right.', 'success');
  } catch (error) {
    console.error('Owner asset upload failed:', error);
    status(error?.message || 'The image could not be uploaded.', 'error');
  }
}

function mount() {
  if (mounted || !allowed()) return;
  const template = document.getElementById('studioOwnerControlTemplate');
  if (!(template instanceof HTMLTemplateElement)) return;
  mounted = true;
  style();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'studio-owner-control-fab';
  button.textContent = 'App Settings';
  button.addEventListener('click', () => toggle());
  const panel = document.createElement('aside');
  panel.className = 'studio-owner-control-panel';
  panel.setAttribute('aria-label', 'Owner App Builder settings');
  panel.append(template.content.cloneNode(true));
  document.body.append(button, panel);
  panel.querySelector('[data-studio-owner-close]')?.addEventListener('click', () => toggle(false));
  panel.querySelector('[data-studio-owner-preview]')?.addEventListener('click', () => { state = formConfig(); dispatch(state); status('Preview applied on this device.', 'success'); });
  panel.querySelector('[data-studio-owner-reset]')?.addEventListener('click', () => { fill(DEFAULTS); dispatch(DEFAULTS); status('Form reset to defaults. Nothing is published yet.'); });
  panel.querySelector('[data-studio-owner-publish]')?.addEventListener('click', publish);
  window.addEventListener('evara:menu-open', () => toggle(false));
  panel.querySelector('[data-open-current-page-editor]')?.addEventListener('click', () => { location.assign('/dashboard.html#live-edit'); });
  panel.querySelectorAll('[data-config-path]').forEach((input) => input.addEventListener('input', () => {
    const preview = panel.querySelector(`[data-upload-preview="${CSS.escape(input.dataset.configPath)}"]`);
    setImagePreview(preview, input.value, DEFAULTS.brand.markUrl);
  }));
  panel.querySelectorAll('[data-upload-target]').forEach((input) => input.addEventListener('change', () => upload(input.dataset.uploadTarget, input.files?.[0])));
  load();
  if (location.hash === '#app-settings') toggle(true);
}

window.addEventListener('evara:session-ready', mount);
window.addEventListener('pageshow', () => setTimeout(mount, 100));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 350), { once: true });
else setTimeout(mount, 350);
