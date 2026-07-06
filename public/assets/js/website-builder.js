import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const DRAFT_KEY = 'evaraos-builder-draft-v1';

function role() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function allowed() {
  return OWNER_ROLES.has(role());
}

function redirectLocked() {
  if (!allowed()) {
    document.querySelector('[data-builder-access]').textContent = 'Access denied. Owner/admin role required.';
    setTimeout(() => location.replace('/dashboard.html'), 900);
    return false;
  }
  document.querySelector('[data-builder-access]').textContent = `Access granted: ${role() || 'owner'}.`;
  return true;
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    document.querySelectorAll('[data-builder-field]').forEach((field) => {
      field.value = draft[field.dataset.builderField] || '';
    });
  } catch {}
}

function saveDraft() {
  const draft = {};
  document.querySelectorAll('[data-builder-field]').forEach((field) => {
    draft[field.dataset.builderField] = field.value || '';
  });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  alert('Builder draft saved locally. Publishing controls come next.');
}

function boot() {
  if (!redirectLocked()) return;
  window.EvaraBrand?.apply?.();
  loadDraft();
  document.querySelector('[data-open-icons]')?.addEventListener('click', () => location.assign('/settings/icons.html'));
  document.querySelector('[data-save-builder-draft]')?.addEventListener('click', saveDraft);
}

window.addEventListener('evara:session-ready', boot, { once: true });
setTimeout(boot, 1200);
