import {
  loadExperienceEditorState,
  saveExperienceDraftPatch,
  publishExperienceDraft
} from './experience-config-client.js';
import { getSavedUserProfile, getSavedUserRole, normalizeRole } from '../firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'platform_admin', 'admin']);
const LOCAL_DRAFT_KEY = 'evaraos-owner-page-drafts-v4';
let installed = false;
let busy = false;
let state = null;

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function allowed() {
  const role = currentRole();
  if (role === 'admin') return Boolean((getSavedUserProfile?.() || {}).platformAccess);
  return OWNER_ROLES.has(role);
}

function pageKey() {
  return location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';
}

function readLocalPage() {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY) || '{}') || {};
    return all[pageKey()] || { text: {}, blocks: [], style: {}, media: {} };
  } catch {
    return { text: {}, blocks: [], style: {}, media: {} };
  }
}

function setStatus(message) {
  const node = document.querySelector('[data-owner-experience-status]');
  if (node) node.textContent = message;
}

function setBusy(next) {
  busy = next;
  document.querySelectorAll('[data-owner-experience-save],[data-owner-experience-publish]').forEach((button) => { button.disabled = next; });
}

async function savePageDraft() {
  if (busy) return;
  setBusy(true);
  setStatus('Saving page draft securely…');
  try {
    state = await saveExperienceDraftPatch({ pageOverrides: { [pageKey()]: readLocalPage() } });
    window.EvaraExperience?.applyConfig?.(state.draft);
    setStatus(`Page draft saved • revision ${state.draftRevision}`);
  } catch (error) {
    setStatus(error.message || 'Unable to save this page draft.');
  } finally {
    setBusy(false);
  }
}

async function publishPage() {
  if (busy) return;
  setBusy(true);
  setStatus('Saving page and publishing live…');
  try {
    state = await saveExperienceDraftPatch({ pageOverrides: { [pageKey()]: readLocalPage() } });
    state = await publishExperienceDraft();
    window.EvaraExperience?.applyConfig?.(state.published);
    setStatus(`Live version ${state.publishedVersion} published`);
  } catch (error) {
    setStatus(error.message || 'Unable to publish this page.');
  } finally {
    setBusy(false);
  }
}

function installControls() {
  if (!allowed()) return;
  const panel = document.querySelector('.owner-editor-panel');
  if (!panel || panel.querySelector('[data-owner-experience-section]')) return;
  const section = document.createElement('section');
  section.className = 'owner-editor-section';
  section.dataset.ownerExperienceSection = 'true';
  section.innerHTML = `
    <strong>Live publishing</strong>
    <p>Save this page into the shared Experience draft, then publish it for every user and device.</p>
    <div class="owner-editor-actions">
      <button type="button" data-owner-experience-save>Save Page Draft</button>
      <button type="button" data-owner-experience-publish>Publish Page Live</button>
    </div>
    <small data-owner-experience-status>Loading shared draft status…</small>
  `;
  const studioSection = Array.from(panel.querySelectorAll('.owner-editor-section')).at(-1);
  panel.insertBefore(section, studioSection || null);
  section.querySelector('[data-owner-experience-save]')?.addEventListener('click', savePageDraft);
  section.querySelector('[data-owner-experience-publish]')?.addEventListener('click', publishPage);
  loadExperienceEditorState().then((next) => {
    state = next;
    setStatus(`Draft r${next.draftRevision} • Live v${next.publishedVersion}`);
  }).catch((error) => setStatus(error.message || 'Shared draft unavailable.'));

  if (new URLSearchParams(location.search).get('ownerEdit') === '1') {
    setTimeout(() => document.querySelector('.owner-edit-toggle')?.click(), 100);
  }
}

function boot() {
  if (installed || !allowed()) return;
  installed = true;
  installControls();
  const observer = new MutationObserver(installControls);
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 900), { once: true });
else setTimeout(boot, 900);
