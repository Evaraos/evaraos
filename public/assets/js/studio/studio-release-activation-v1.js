import {
  functions,
  httpsCallable,
  getSavedUserProfile
} from '../firebase.js';

const ACTIVATION_VERSION = 'studio-release-activation-v1';
const activateReleaseCall = httpsCallable(functions, 'activateStudioRelease');
let activationTask = null;
let lastActivation = null;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function companyId() {
  const profile = getSavedUserProfile?.() || {};
  return text(profile.companyId || localStorage.getItem('evaraos-studio-company-id') || '', 128);
}

function setWorkbenchStatus(message, tone = '') {
  const status = document.querySelector('[data-workbench-status]');
  if (!status) return;
  status.textContent = text(message, 600);
  status.dataset.tone = tone;
}

function localWorkbenchKey(graphId) {
  return `evaraos-studio-workbench-v5:${companyId() || 'local'}:${text(graphId, 220) || 'pending'}`;
}

function persistActiveMetadata(graphId, activeRelease) {
  try {
    const key = localWorkbenchKey(graphId);
    const current = JSON.parse(localStorage.getItem(key) || 'null') || {};
    const publish = current.publish && typeof current.publish === 'object' ? current.publish : {};
    current.publish = {
      ...publish,
      channel: activeRelease.channel,
      slug: activeRelease.slug,
      seoTitle: activeRelease.seoTitle || publish.seoTitle || '',
      seoDescription: activeRelease.seoDescription || publish.seoDescription || '',
      lastRelease: {
        ...(publish.lastRelease || {}),
        ...clone(activeRelease),
        status: 'active',
        active: true,
        activatedAt: activeRelease.activatedAtIso || new Date().toISOString()
      }
    };
    current.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(current));
  } catch {}
}

function renderActiveBadge(activeRelease) {
  document.querySelector('[data-studio-active-release]')?.remove();
  const publishPanel = document.querySelector('[data-workbench-tab="publish"]')?.closest('[data-canvas-workbench]');
  if (!publishPanel) return;
  const badge = document.createElement('div');
  badge.className = 'studio-active-release-badge';
  badge.dataset.studioActiveRelease = 'true';
  badge.setAttribute('role', 'status');

  const dot = document.createElement('span');
  const copy = document.createElement('div');
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  strong.textContent = 'Active release';
  small.textContent = `${activeRelease.channel} • ${activeRelease.slug} • ${activeRelease.releaseId}`;
  copy.append(strong, small);
  badge.append(dot, copy);

  const footer = publishPanel.querySelector('.studio-workbench-footer');
  if (footer) publishPanel.insertBefore(badge, footer);
  else publishPanel.append(badge);
}

async function activationContext(graphId) {
  const localSession = await window.EvaraStudioJournal?.getLocalSession?.();
  const openBranch = window.EvaraTrustedStudioJournal?.snapshot?.()?.openBranches
    ?.find((item) => item.graphId === graphId);
  const projectId = text(localSession?.projectId || 'evara-studio-visual-builder', 160);
  const branchId = text(openBranch?.branchId || '', 160);
  if (!projectId) throw new Error('The trusted Studio project scope is unavailable.');
  return { companyId: companyId() || undefined, projectId, branchId };
}

async function activatePreparedRelease(detail = {}) {
  const graphId = text(detail.graphId, 220);
  const releaseId = text(detail.releaseId, 200);
  if (!graphId || !releaseId) throw new Error('Prepared release metadata is incomplete.');

  const metadata = window.EvaraStudioWorkbench?.getMeta?.() || {};
  const publish = metadata.publish || {};
  const channel = text(publish.channel || 'production', 40).toLowerCase();
  const slug = text(publish.slug || 'owner-dashboard', 120).toLowerCase();
  const seoTitle = text(publish.seoTitle, 180);
  const seoDescription = text(publish.seoDescription, 320);
  const context = await activationContext(graphId);

  setWorkbenchStatus('Activating immutable release…');
  const response = await activateReleaseCall({
    companyId: context.companyId,
    projectId: context.projectId,
    releaseId,
    channel,
    slug,
    seoTitle,
    seoDescription
  });
  const activeRelease = response.data?.release;
  if (response.data?.active !== true || !activeRelease?.releaseId) {
    throw new Error('The trusted activation service did not confirm an active release.');
  }

  lastActivation = clone(activeRelease);
  persistActiveMetadata(graphId, activeRelease);
  setWorkbenchStatus(`Active on ${activeRelease.channel}/${activeRelease.slug}.`, 'success');
  renderActiveBadge(activeRelease);
  window.dispatchEvent(new CustomEvent('evara:studio-release-active', {
    detail: { ...clone(activeRelease), graphId, activationVersion: ACTIVATION_VERSION }
  }));
  return clone(activeRelease);
}

function queueActivation(detail) {
  const next = Promise.resolve(activationTask)
    .catch(() => undefined)
    .then(() => activatePreparedRelease(detail));
  activationTask = next.finally(() => {
    if (activationTask === next) activationTask = null;
  });
  next.catch((error) => {
    setWorkbenchStatus(error?.message || 'Release activation failed.', 'error');
    window.dispatchEvent(new CustomEvent('evara:studio-release-activation-error', {
      detail: {
        releaseId: text(detail?.releaseId, 200),
        graphId: text(detail?.graphId, 220),
        error: text(error?.message || error, 600),
        activationVersion: ACTIVATION_VERSION
      }
    }));
  });
  return next;
}

window.addEventListener('evara:studio-release-complete', (event) => {
  queueActivation(clone(event.detail || {}));
});

window.EvaraStudioReleaseActivation = Object.freeze({
  version: ACTIVATION_VERSION,
  activate: (detail) => queueActivation(clone(detail || {})),
  snapshot: () => ({
    version: ACTIVATION_VERSION,
    activating: Boolean(activationTask),
    lastActivation: clone(lastActivation)
  })
});
