import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getSavedUserProfile,
  getSavedUserRole
} from './firebase.js';
import { normalizeAccessRole, isPlatformOwner } from './access-control.js';

const ALLOWED_ROLES = new Set(['platform_admin', 'owner', 'admin']);
const DRAFT_KEY = 'evaraos-owner-page-drafts-v4';
const CACHE_PREFIX = 'evaraos-app-builder-v1:';
const GLOBAL_CONFIG_COLLECTION = 'public_app_config';
const GLOBAL_CONFIG_ID = 'global';
let installing = false;

function profile() { return getSavedUserProfile?.() || {}; }
function role() { return normalizeAccessRole(profile().role || getSavedUserRole?.() || ''); }
function allowed() { return ALLOWED_ROLES.has(role()); }
function companyId() { return String(profile().companyId || '').trim(); }
function pageKey() { return location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'; }
function readDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } }
function writeDrafts(value) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch {} }

function publishingScope() {
  const currentRole = role();
  if (isPlatformOwner(currentRole)) {
    return Object.freeze({
      type: 'global',
      cacheId: 'global',
      companyId: '',
      ref: doc(db, GLOBAL_CONFIG_COLLECTION, GLOBAL_CONFIG_ID),
      label: 'platform-wide Evaraos experience'
    });
  }

  const id = companyId();
  if (currentRole === 'admin' && id) {
    return Object.freeze({
      type: 'company',
      cacheId: id,
      companyId: id,
      ref: doc(db, 'companies', id),
      label: 'company workspace'
    });
  }

  return null;
}

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
  try {
    const url = new URL(raw, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function sanitizePage(page = {}) {
  const outputText = {};
  Object.entries(page.text || {}).slice(0, 400).forEach(([key, value]) => {
    outputText[String(key).slice(0, 180)] = String(value ?? '').slice(0, 5000);
  });

  const media = {};
  Object.entries(page.media || {}).slice(0, 200).forEach(([key, value]) => {
    const url = safeUrl(value);
    if (url) media[String(key).slice(0, 180)] = url;
  });

  const style = {};
  const allowedStyle = new Set(['borderRadius', 'padding', 'background', 'backgroundImage', 'backgroundSize', 'backgroundPosition']);
  Object.entries(page.style || {}).slice(0, 250).forEach(([key, patch]) => {
    const safe = {};
    Object.entries(patch || {}).forEach(([name, value]) => {
      if (allowedStyle.has(name)) safe[name] = String(value).slice(0, 1000);
    });
    style[String(key).slice(0, 180)] = safe;
  });

  const blocks = Array.isArray(page.blocks) ? page.blocks.slice(0, 60).map((item) => ({
    type: ['card', 'image', 'map', 'button', 'section'].includes(item?.type) ? item.type : 'card',
    title: String(item?.title || '').slice(0, 240),
    copy: String(item?.copy || '').slice(0, 1500),
    label: String(item?.label || '').slice(0, 160),
    url: safeUrl(item?.url)
  })) : [];

  return {
    text: outputText,
    media,
    style,
    blocks,
    publishedAtMs: Date.now(),
    publishedBy: auth.currentUser?.uid || profile().uid || '',
    publishedByRole: role()
  };
}

async function readAppBuilder(scope) {
  const snapshot = await getDoc(scope.ref);
  if (!snapshot.exists()) return {};
  return snapshot.data()?.appBuilder && typeof snapshot.data().appBuilder === 'object'
    ? snapshot.data().appBuilder
    : {};
}

function cache(config, scope) {
  try { localStorage.setItem(`${CACHE_PREFIX}${scope.cacheId}`, JSON.stringify(config)); } catch {}
}

async function publishPage() {
  if (!allowed()) return status('Owner or administrator access is required.', 'error');
  const scope = publishingScope();
  if (!scope) return status('Administrators must be assigned to a company workspace before publishing.', 'error');

  const drafts = readDrafts();
  const key = pageKey();
  const page = sanitizePage(drafts[key] || {});
  status(`Publishing to the ${scope.label}…`);

  try {
    const existing = await readAppBuilder(scope);
    const next = {
      ...existing,
      version: 2,
      scope: scope.type,
      pages: { ...(existing.pages || {}), [key]: page },
      updatedAtMs: Date.now(),
      updatedBy: auth.currentUser?.uid || profile().uid || '',
      updatedByRole: role()
    };

    await setDoc(scope.ref, {
      appBuilder: next,
      appBuilderUpdatedAt: serverTimestamp()
    }, { merge: true });

    cache(next, scope);
    window.dispatchEvent(new CustomEvent('evara:app-builder-updated', {
      detail: {
        scope: scope.type,
        cacheId: scope.cacheId,
        companyId: scope.companyId,
        config: next
      }
    }));
    status(scope.type === 'global'
      ? 'Published globally. The owner-controlled Evaraos experience is now updated.'
      : 'Published. Users in this company workspace will see the update.', 'success');
  } catch (error) {
    console.error('Page publish failed:', error);
    status(error?.message || 'The page could not be published.', 'error');
  }
}

async function loadPublished() {
  if (!allowed()) return;
  const scope = publishingScope();
  if (!scope) return status('Administrators must be assigned to a company workspace before loading published settings.', 'error');
  status(`Loading the published ${scope.label}…`);

  try {
    const config = await readAppBuilder(scope);
    const key = pageKey();
    const published = config.pages?.[key];
    if (!published) return status('No published version exists for this page yet.', 'error');
    const drafts = readDrafts();
    drafts[key] = published;
    writeDrafts(drafts);
    cache(config, scope);
    window.dispatchEvent(new CustomEvent('evara:app-builder-updated', {
      detail: { scope: scope.type, cacheId: scope.cacheId, companyId: scope.companyId, config }
    }));
    status('Published version loaded into Live Edit.', 'success');
  } catch (error) {
    console.error('Published page load failed:', error);
    status(error?.message || 'Published content could not be loaded.', 'error');
  }
}

function install() {
  if (installing || !allowed()) return;
  const panel = document.querySelector('.owner-editor-panel');
  if (!panel || panel.querySelector('[data-owner-publish-section]')) return;
  installing = true;

  const scope = publishingScope();
  const platformOwner = isPlatformOwner(role());
  const section = document.createElement('section');
  section.className = 'owner-editor-section';
  section.dataset.ownerPublishSection = 'true';
  section.innerHTML = platformOwner
    ? '<strong>Publish globally</strong><p>Owner access controls the platform-wide Evaraos experience. No company workspace is required.</p><div class="owner-editor-actions"><button type="button" data-owner-publish-page>Publish Globally</button><button type="button" data-owner-load-published>Load Global</button></div><small data-owner-publish-status>Draft only — publish when ready.</small>'
    : scope
      ? '<strong>Publish to company workspace</strong><p>Administrator publishing is limited to the assigned company workspace.</p><div class="owner-editor-actions"><button type="button" data-owner-publish-page>Publish Company Page</button><button type="button" data-owner-load-published>Load Published</button></div><small data-owner-publish-status>Draft only — not visible to company users yet.</small>'
      : '<strong>Company workspace required</strong><p>Administrator publishing requires an assigned company. Owner accounts do not have this restriction.</p><small data-owner-publish-status data-tone="error">Ask an owner to assign this administrator to a company workspace.</small>';

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
