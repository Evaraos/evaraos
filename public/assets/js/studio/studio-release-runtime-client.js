import { functions, httpsCallable } from '../firebase.js';

const CLIENT_VERSION = 'studio-release-runtime-client-v1';
const CHANNELS = new Set(['production', 'staging']);
const activateReleaseCall = httpsCallable(functions, 'activateStudioRelease');
const getPublishedReleaseCall = httpsCallable(functions, 'getPublishedStudioRelease');

const state = {
  activating: false,
  loading: false,
  lastActivation: null,
  lastPublished: null,
  lastError: null
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanId(value, label, maxLength = 200, { optional = false } = {}) {
  const id = cleanText(value, maxLength);
  if (!id && optional) return '';
  if (!id || !/^[a-zA-Z0-9:._-]+$/.test(id)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return id;
}

function cleanChannel(value) {
  const channel = cleanText(value || 'production', 40).toLowerCase();
  if (!CHANNELS.has(channel)) throw new TypeError('Release channel must be production or staging.');
  return channel;
}

function cleanSlug(value) {
  const slug = cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) throw new TypeError('A route slug is required.');
  return slug;
}

function normalizeError(error) {
  return {
    code: cleanText(error?.code || 'unknown', 120),
    message: cleanText(error?.message || error || 'Studio release request failed.', 700)
  };
}

function emit(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(name, {
    detail: { clientVersion: CLIENT_VERSION, ...clone(detail) }
  }));
}

async function activate(options = {}) {
  if (state.activating) throw new Error('A Studio release activation is already in progress.');
  const request = {
    companyId: cleanId(options.companyId, 'companyId', 128, { optional: true }) || undefined,
    projectId: cleanId(options.projectId, 'projectId', 160),
    releaseId: cleanId(options.releaseId, 'releaseId', 200),
    channel: cleanChannel(options.channel),
    slug: cleanSlug(options.slug),
    seoTitle: cleanText(options.seoTitle, 180),
    seoDescription: cleanText(options.seoDescription, 320)
  };

  state.activating = true;
  state.lastError = null;
  emit('evara:studio-release-activation-started', {
    projectId: request.projectId,
    releaseId: request.releaseId,
    channel: request.channel,
    slug: request.slug
  });

  try {
    const response = await activateReleaseCall(request);
    const payload = response.data || {};
    if (payload.ok !== true || payload.active !== true || !payload.release?.releaseId) {
      throw new Error('The trusted activation service did not confirm an active release.');
    }
    state.lastActivation = clone(payload);
    emit('evara:studio-release-active', payload);
    return clone(payload);
  } catch (error) {
    state.lastError = normalizeError(error);
    emit('evara:studio-release-activation-error', state.lastError);
    throw error;
  } finally {
    state.activating = false;
  }
}

async function getPublished(options = {}) {
  if (state.loading) throw new Error('A Studio release retrieval is already in progress.');
  const request = {
    companyId: cleanId(options.companyId, 'companyId', 128, { optional: true }) || undefined,
    channel: cleanChannel(options.channel),
    slug: cleanSlug(options.slug)
  };

  state.loading = true;
  state.lastError = null;
  try {
    const response = await getPublishedReleaseCall(request);
    const payload = response.data || {};
    if (payload.ok !== true) throw new Error('The trusted release service returned an invalid response.');
    state.lastPublished = clone(payload);
    emit('evara:studio-published-release-loaded', payload);
    return clone(payload);
  } catch (error) {
    state.lastError = normalizeError(error);
    emit('evara:studio-published-release-error', state.lastError);
    throw error;
  } finally {
    state.loading = false;
  }
}

window.EvaraStudioReleaseRuntime = Object.freeze({
  version: CLIENT_VERSION,
  activate,
  getPublished,
  snapshot: () => clone({
    version: CLIENT_VERSION,
    activating: state.activating,
    loading: state.loading,
    lastActivation: state.lastActivation,
    lastPublished: state.lastPublished,
    lastError: state.lastError
  })
});
