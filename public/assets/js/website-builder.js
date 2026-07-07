import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const DRAFT_KEY = 'evaraos-builder-draft-v2';

function role() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}
function allowed() { return OWNER_ROLES.has(role()); }
function redirectLocked() {
  const access = document.querySelector('[data-builder-access]');
  if (!allowed()) {
    if (access) access.textContent = 'Access denied. Owner/admin role required.';
    setTimeout(() => location.replace('/dashboard.html'), 900);
    return false;
  }
  if (access) access.textContent = `Access granted: ${role() || 'owner'}.`;
  return true;
}
function draft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
function loadDraft() {
  const saved = draft();
  document.querySelectorAll('[data-builder-field]').forEach((field) => { field.value = saved[field.dataset.builderField] || ''; });
  Object.entries(saved.blocks || {}).forEach(([key, value]) => renderBlock(key, value));
}
function collectDraft() {
  const saved = draft();
  document.querySelectorAll('[data-builder-field]').forEach((field) => { saved[field.dataset.builderField] = field.value || ''; });
  saved.blocks = saved.blocks || {};
  return saved;
}
function saveDraft(show = true) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
  if (show) toast('Builder draft saved locally');
}
function toast(message) {
  let node = document.querySelector('.builder-toast');
  if (!node) { node = document.createElement('div'); node.className = 'builder-toast'; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1600);
}
function renderBlock(type, value = {}) {
  const target = document.querySelector(`[data-placeholder="${type}"]`) || document.querySelector('.builder-canvas');
  if (!target) return;
  target.classList.add('is-filled');
  target.innerHTML = `<button type="button" data-remove-block="${type}">×</button><strong>${value.title || type.replace(/\b\w/g, c => c.toUpperCase())}</strong><small>${value.copy || 'Click fields in the inspector, then save your draft.'}</small>`;
}
function addBlock(type) {
  const saved = collectDraft();
  saved.blocks = saved.blocks || {};
  saved.blocks[type] = { title: `${type.replace(/\b\w/g, c => c.toUpperCase())} block`, copy: 'Placeholder added. Replace this with live content.' };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
  renderBlock(type, saved.blocks[type]);
  toast('Placeholder block added');
}
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  document.querySelectorAll('[data-builder-field]').forEach((field) => { field.value = ''; });
  toast('Draft cleared');
  setTimeout(() => location.reload(), 450);
}
function bindTabs() {
  document.querySelectorAll('[data-builder-tab]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-builder-tab]').forEach((node) => node.classList.remove('is-active'));
    button.classList.add('is-active');
    toast(`${button.textContent.trim()} panel selected`);
  }));
}
function bindBlocks() {
  document.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-block]');
    if (add) addBlock(add.dataset.addBlock);
    const remove = event.target.closest('[data-remove-block]');
    if (remove) {
      const saved = collectDraft();
      if (saved.blocks) delete saved.blocks[remove.dataset.removeBlock];
      localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
      location.reload();
    }
  });
}
function boot() {
  if (!redirectLocked()) return;
  window.EvaraBrand?.apply?.();
  loadDraft();
  bindTabs();
  bindBlocks();
  document.querySelector('[data-open-icons]')?.addEventListener('click', () => location.assign('/settings/icons.html'));
  document.querySelector('[data-save-builder-draft]')?.addEventListener('click', () => saveDraft(true));
  document.querySelector('[data-clear-builder-draft]')?.addEventListener('click', clearDraft);
  document.querySelector('[data-builder-preview]')?.addEventListener('click', () => document.documentElement.classList.toggle('builder-preview-mode'));
  document.querySelectorAll('[data-builder-field]').forEach((field) => field.addEventListener('input', () => saveDraft(false)));
}
window.addEventListener('evara:session-ready', boot, { once: true });
setTimeout(boot, 1200);
