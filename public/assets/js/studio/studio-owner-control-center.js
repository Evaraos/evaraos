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
function companyId() { return String(profile().companyId || '').trim(); }
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

function panelMarkup() {
  return `
    <header class="studio-owner-control-head"><div><h2>Owner App Builder</h2><p>Publish brand, loader, logo, and app-wide copy updates without changing code.</p></div><button class="studio-owner-control-close" type="button" data-studio-owner-close aria-label="Close">×</button></header>
    <div class="studio-owner-control-body">
      <section class="studio-owner-config-section"><h3>Brand system</h3><p>These values update the loader marks, browser icons, and any element using the Evara brand data attributes.</p><div class="studio-owner-grid">
        <label class="studio-owner-field">Brand name<input data-config-path="brand.name" maxlength="120"></label>
        <label class="studio-owner-field">Accent color<input data-config-path="brand.accent" type="color"></label>
        <label class="studio-owner-field is-wide">Brand mark URL<input data-config-path="brand.markUrl"></label>
        <label class="studio-owner-field is-wide">App icon URL<input data-config-path="brand.appIconUrl"></label>
      </div>
      <div class="studio-owner-upload"><img data-upload-preview="brand.markUrl" alt="Brand mark preview"><div class="studio-owner-upload-actions"><strong>Upload brand mark</strong><input type="file" accept="image/*" data-upload-target="brand.markUrl"><small>PNG or WebP with transparency works best.</small></div></div>
      <div class="studio-owner-upload"><img data-upload-preview="brand.appIconUrl" alt="App icon preview"><div class="studio-owner-upload-actions"><strong>Upload app icon</strong><input type="file" accept="image/*" data-upload-target="brand.appIconUrl"><small>Use a square image for install and browser icons.</small></div></div></section>

      <section class="studio-owner-config-section"><h3>Launch loader</h3><p>The full welcome loader shown on a real launch or refresh.</p><div class="studio-owner-grid">
        <label class="studio-owner-field">Eyebrow<input data-config-path="loaders.launch.eyebrow" maxlength="80"></label>
        <label class="studio-owner-field">Background<input data-config-path="loaders.launch.background"></label>
        <label class="studio-owner-field is-wide">Title<input data-config-path="loaders.launch.title" maxlength="180"></label>
        <label class="studio-owner-field is-wide">Subtitle<textarea data-config-path="loaders.launch.subtitle" maxlength="260"></textarea></label>
        <label class="studio-owner-field is-wide">Loader logo URL<input data-config-path="loaders.launch.logoUrl"></label>
      </div><div class="studio-owner-upload"><img data-upload-preview="loaders.launch.logoUrl" alt="Launch loader preview"><div class="studio-owner-upload-actions"><strong>Upload launch logo</strong><input type="file" accept="image/*" data-upload-target="loaders.launch.logoUrl"><small>This can be different from the main brand mark.</small></div></div></section>

      <section class="studio-owner-config-section"><h3>Return loader</h3><p>The welcome-back message used after the app has been in the background.</p><div class="studio-owner-grid"><label class="studio-owner-field is-wide">Title<input data-config-path="loaders.resume.title" maxlength="180"></label><label class="studio-owner-field is-wide">Subtitle<textarea data-config-path="loaders.resume.subtitle" maxlength="260"></textarea></label></div></section>

      <section class="studio-owner-config-section"><h3>Compact loader</h3><p>The smaller loader used for internal page changes.</p><div class="studio-owner-grid"><label class="studio-owner-field">Label<input data-config-path="loaders.compact.label" maxlength="120"></label><label class="studio-owner-field">Background<input data-config-path="loaders.compact.background"></label><label class="studio-owner-field is-wide">Logo URL<input data-config-path="loaders.compact.logoUrl"></label></div><div class="studio-owner-upload"><img data-upload-preview="loaders.compact.logoUrl" alt="Compact loader preview"><div class="studio-owner-upload-actions"><strong>Upload compact logo</strong><input type="file" accept="image/*" data-upload-target="loaders.compact.logoUrl"><small>Keep this simple so it stays clear at a small size.</small></div></div></section>

      <section class="studio-owner-config-section"><h3>Page text and existing UI</h3><p>Open any app page and use the owner Live Edit drawer. Select existing text, cards, images, or buttons, save the draft, then choose Publish Page. Published content is shared with the company workspace.</p><button class="studio-owner-button" type="button" data-open-current-page-editor>Open current page with Live Edit</button></section>
    </div>
    <footer class="studio-owner-control-foot"><span data-studio-owner-status>Loading workspace settings…</span><div><button class="studio-owner-button" type="button" data-studio-owner-preview>Preview</button> <button class="studio-owner-button" type="button" data-studio-owner-reset>Reset form</button> <button class="studio-owner-button is-primary" type="button" data-studio-owner-publish>Publish live</button></div></footer>`;
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
  document.querySelectorAll('[data-upload-preview]').forEach((img) => { img.src = String(getPath(state, img.dataset.uploadPreview) || DEFAULTS.brand.markUrl); });
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
    status('This owner account needs a company workspace before settings can be published.', 'error');
    return;
  }
  try {
    const snapshot = await getDoc(doc(db, 'companies', id));
    const existing = snapshot.exists() ? snapshot.data()?.appBuilder : null;
    fill(existing || DEFAULTS);
    cache(state);
    dispatch(state);
    status(existing ? 'Workspace settings loaded.' : 'No published settings yet. Defaults are ready.', 'success');
  } catch (error) {
    console.error('Owner App Builder load failed:', error);
    fill(DEFAULTS);
    status('Settings could not be loaded.', 'error');
  }
}

async function publish() {
  if (!allowed()) return status('Owner access is required.', 'error');
  const id = companyId();
  if (!id) return status('Assign this owner account to a company workspace first.', 'error');
  status('Publishing app settings…');
  try {
    const snapshot = await getDoc(doc(db, 'companies', id));
    const existing = snapshot.exists() ? snapshot.data()?.appBuilder || {} : {};
    const input = formConfig();
    const next = merge(existing, input);
    next.pages = existing.pages || input.pages || {};
    next.updatedAtMs = Date.now();
    next.updatedBy = auth.currentUser?.uid || profile().uid || '';
    await setDoc(doc(db, 'companies', id), { appBuilder: next, appBuilderUpdatedAt: serverTimestamp() }, { merge: true });
    state = next;
    cache(next);
    dispatch(next);
    status('Published live to this company workspace.', 'success');
  } catch (error) {
    console.error('Owner App Builder publish failed:', error);
    status(error?.message || 'Settings could not be published.', 'error');
  }
}

async function upload(target, file) {
  if (!file || !file.type.startsWith('image/')) return status('Choose an image file.', 'error');
  if (file.size > 8 * 1024 * 1024) return status('Keep logo uploads under 8 MB.', 'error');
  const id = companyId();
  if (!id) return status('A company workspace is required before uploading.', 'error');
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
    if (preview) preview.src = url;
    dispatch(formConfig());
    status('Upload complete. Publish live when the preview looks right.', 'success');
  } catch (error) {
    console.error('Owner asset upload failed:', error);
    status(error?.message || 'The image could not be uploaded.', 'error');
  }
}

function mount() {
  if (mounted || !allowed()) return;
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
  panel.innerHTML = panelMarkup();
  document.body.append(button, panel);
  panel.querySelector('[data-studio-owner-close]')?.addEventListener('click', () => toggle(false));
  panel.querySelector('[data-studio-owner-preview]')?.addEventListener('click', () => { state = formConfig(); dispatch(state); status('Preview applied on this device.', 'success'); });
  panel.querySelector('[data-studio-owner-reset]')?.addEventListener('click', () => { fill(DEFAULTS); dispatch(DEFAULTS); status('Form reset to defaults. Nothing is published yet.'); });
  panel.querySelector('[data-studio-owner-publish]')?.addEventListener('click', publish);
  panel.querySelector('[data-open-current-page-editor]')?.addEventListener('click', () => { location.assign('/dashboard.html#live-edit'); });
  panel.querySelectorAll('[data-config-path]').forEach((input) => input.addEventListener('input', () => {
    const preview = panel.querySelector(`[data-upload-preview="${CSS.escape(input.dataset.configPath)}"]`);
    if (preview && input.value) preview.src = input.value;
  }));
  panel.querySelectorAll('[data-upload-target]').forEach((input) => input.addEventListener('change', () => upload(input.dataset.uploadTarget, input.files?.[0])));
  load();
  if (location.hash === '#app-settings') toggle(true);
}

window.addEventListener('evara:session-ready', mount);
window.addEventListener('pageshow', () => setTimeout(mount, 100));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 350), { once: true });
else setTimeout(mount, 350);
