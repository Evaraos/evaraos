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
} from './firebase.js';

const OWNER_ROLES = new Set(['owner']);
const DRAFT_KEY = 'evaraos-owner-page-drafts-v4';
const CACHE_PREFIX = 'evaraos-app-builder-v1:';
let installing = false;

function profile() { return getSavedUserProfile?.() || {}; }
function role() { return normalizeRole?.(profile().role || getSavedUserRole?.() || '') || ''; }
function allowed() { return OWNER_ROLES.has(role()); }
function companyId() { return String(profile().companyId || '').trim(); }
function pageKey() { return location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'; }
function readDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } }
function writeDrafts(value) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch {} }
function status(message, tone = '') {
  const node = document.querySelector('[data-owner-publish-status]');
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function safeUrl(value) {
  const raw = String(value || '').trim().slice(0, 1400);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try { const url = new URL(raw, location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

function sanitizePage(page = {}) {
  const text = {};
  Object.entries(page.text || {}).slice(0, 400).forEach(([key, value]) => { text[String(key).slice(0, 180)] = String(value ?? '').slice(0, 5000); });
  const media = {};
  Object.entries(page.media || {}).slice(0, 200).forEach(([key, value]) => { const url = safeUrl(value); if (url) media[String(key).slice(0, 180)] = url; });
  const style = {};
  const allowedStyle = new Set(['borderRadius', 'padding', 'background', 'backgroundImage', 'backgroundSize', 'backgroundPosition']);
  Object.entries(page.style || {}).slice(0, 250).forEach(([key, patch]) => {
    const safe = {};
    Object.entries(patch || {}).forEach(([name, value]) => { if (allowedStyle.has(name)) safe[name] = String(value).slice(0, 1000); });
    style[String(key).slice(0, 180)] = safe;
  });
  const blocks = Array.isArray(page.blocks) ? page.blocks.slice(0, 60).map((item) => ({
    type: ['card', 'image', 'map', 'button', 'section'].includes(item?.type) ? item.type : 'card',
    title: String(item?.title || '').slice(0, 240),
    copy: String(item?.copy || '').slice(0, 1500),
    label: String(item?.label || '').slice(0, 160),
    url: safeUrl(item?.url)
  })) : [];
  return { text, media, style, blocks, publishedAtMs: Date.now(), publishedBy: auth.currentUser?.uid || profile().uid || '' };
}

async function readAppBuilder() {
  const id = companyId();
  if (!id) throw new Error('Your owner account does not have a company workspace assigned.');
  const snapshot = await getDoc(doc(db, 'companies', id));
  return snapshot.exists() && snapshot.data()?.appBuilder ? snapshot.data().appBuilder : {};
}

function cache(config) {
  const id = companyId();
  if (!id) return;
  try { localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(config)); } catch {}
}

async function publishPage() {
  if (!allowed()) return status('Owner access is required.', 'error');
  const id = companyId();
  if (!id) return status('Assign this owner account to a company workspace first.', 'error');
  const drafts = readDrafts();
  const key = pageKey();
  const page = sanitizePage(drafts[key] || {});
  status('Publishing this page…');
  try {
    const existing = await readAppBuilder();
    const next = {
      ...existing,
      version: 1,
      pages: { ...(existing.pages || {}), [key]: page },
      updatedAtMs: Date.now(),
      updatedBy: auth.currentUser?.uid || profile().uid || ''
    };
    await setDoc(doc(db, 'companies', id), {
      appBuilder: next,
      appBuilderUpdatedAt: serverTimestamp()
    }, { merge: true });
    cache(next);
    window.dispatchEvent(new CustomEvent('evara:app-builder-updated', { detail: { companyId: id, config: next } }));
    status('Published. Everyone in this workspace will see the update.', 'success');
  } catch (error) {
    console.error('Owner page publish failed:', error);
    status(error?.message || 'The page could not be published.', 'error');
  }
}

async function loadPublished() {
  if (!allowed()) return;
  status('Loading published page…');
  try {
    const config = await readAppBuilder();
    const key = pageKey();
    const published = config.pages?.[key];
    if (!published) return status('No published version exists for this page yet.', 'error');
    const drafts = readDrafts();
    drafts[key] = published;
    writeDrafts(drafts);
    cache(config);
    window.dispatchEvent(new CustomEvent('evara:app-builder-updated', { detail: { companyId: companyId(), config } }));
    status('Published version loaded into Live Edit.', 'success');
  } catch (error) {
    console.error('Published page load failed:', error);
    status(error?.message || 'Published content could not be loaded.', 'error');
  }
}

function install() {
  if (installing || !allowed()) return;
  const panel = document.querySelector('.owner-editor-panel');
  if (!panel) return;
  if (panel.querySelector('[data-owner-publish-section]')) return;
  installing = true;
  const section = document.createElement('section');
  section.className = 'owner-editor-section';
  section.dataset.ownerPublishSection = 'true';
  section.innerHTML = '<strong>Publish to workspace</strong><p>Live Edit saves a private draft on this device. Publish sends the page text, media, styles, and added blocks to your company workspace.</p><div class="owner-editor-actions"><button type="button" data-owner-publish-page>Publish Page</button><button type="button" data-owner-load-published>Load Published</button></div><small data-owner-publish-status>Draft only — not visible to other users yet.</small>';
  const studioSection = Array.from(panel.querySelectorAll('.owner-editor-section')).find((node) => node.textContent.includes('Studio'));
  panel.insertBefore(section, studioSection || null);
  section.querySelector('[data-owner-publish-page]')?.addEventListener('click', publishPage);
  section.querySelector('[data-owner-load-published]')?.addEventListener('click', loadPublished);
  installing = false;
}

window.addEventListener('evara:session-ready', () => setTimeout(install, 80));
window.addEventListener('pageshow', () => setTimeout(install, 250));
const observer = new MutationObserver(() => install());
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });
setTimeout(install, 900);
