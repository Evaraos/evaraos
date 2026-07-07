import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const DRAFT_KEY = 'evaraos-studio-draft-v1';

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}
function isAllowed() { return OWNER_ROLES.has(currentRole()); }
function data() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } }
function saveData(value) { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); }
function toast(message) {
  let node = document.querySelector('.builder-toast');
  if (!node) { node = document.createElement('div'); node.className = 'builder-toast'; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1500);
}
function saveDraft(show = true) {
  const saved = data();
  document.querySelectorAll('[data-studio-field]').forEach((field) => { saved[field.dataset.studioField] = field.value || ''; });
  saved.product = document.querySelector('[data-studio-product].is-active')?.dataset.studioProduct || 'studio';
  saved.view = document.querySelector('[data-studio-frame]')?.dataset.view || 'tablet';
  saveData(saved);
  if (show) toast('Studio draft saved');
}
function setView(view = 'tablet') {
  document.querySelectorAll('[data-viewport]').forEach((button) => button.classList.toggle('is-active', button.dataset.viewport === view));
  const frame = document.querySelector('[data-studio-frame]');
  if (frame) frame.dataset.view = view;
}
function setProduct(product = 'studio') {
  document.querySelectorAll('[data-studio-product]').forEach((button) => button.classList.toggle('is-active', button.dataset.studioProduct === product));
  const names = { studio: 'Evara Studio canvas', operations: 'Operations OS draft', finance: 'Finance OS draft', hr: 'HR OS draft', mapping: 'Mapping + Tracking draft', marketplace: 'Marketplace draft', ai: 'AI OS draft' };
  const title = document.querySelector('[data-owner-edit="canvasTitle"]');
  if (title) title.textContent = names[product] || 'Evara Studio canvas';
}
function addBlock(type = 'module') {
  const frame = document.querySelector('[data-studio-frame]');
  if (!frame) return;
  const node = document.createElement('section');
  node.className = 'studio-section is-selected';
  node.dataset.studioBlock = type;
  const label = type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  node.innerHTML = '<button class="studio-block-x" type="button">Remove</button><strong>' + label + '</strong><small>Configure access, data, and AI behavior from the inspector.</small>';
  document.querySelectorAll('.studio-section').forEach((item) => item.classList.remove('is-selected'));
  frame.appendChild(node);
  toast('Studio block added');
}
function boot() {
  const access = document.querySelector('[data-builder-access]');
  if (!isAllowed()) { if (access) access.textContent = 'Owner or admin required'; return; }
  if (access) access.textContent = 'Access granted: ' + (currentRole() || 'owner');
  window.EvaraBrand?.apply?.();
  const saved = data();
  document.querySelectorAll('[data-studio-field]').forEach((field) => { field.value = saved[field.dataset.studioField] || ''; });
  setView(saved.view || 'tablet');
  setProduct(saved.product || 'studio');
  document.addEventListener('click', (event) => {
    const product = event.target.closest('[data-studio-product]');
    if (product) { setProduct(product.dataset.studioProduct); saveDraft(false); }
    const view = event.target.closest('[data-viewport]');
    if (view) { setView(view.dataset.viewport); saveDraft(false); }
    const add = event.target.closest('[data-component],[data-add-section]');
    if (add) addBlock(add.dataset.component || 'section');
    const section = event.target.closest('.studio-section');
    if (section) { document.querySelectorAll('.studio-section').forEach((item) => item.classList.remove('is-selected')); section.classList.add('is-selected'); }
    const remove = event.target.closest('.studio-block-x');
    if (remove) { remove.closest('.studio-section')?.remove(); toast('Block removed'); }
  });
  document.querySelectorAll('[data-save-studio],[data-save-builder-draft]').forEach((button) => button.addEventListener('click', () => saveDraft(true)));
  document.querySelector('[data-builder-preview]')?.addEventListener('click', () => document.documentElement.classList.toggle('builder-preview-mode'));
  document.querySelectorAll('[data-studio-field]').forEach((field) => field.addEventListener('input', () => saveDraft(false)));
}
window.addEventListener('evara:session-ready', boot, { once: true });
setTimeout(boot, 1200);
