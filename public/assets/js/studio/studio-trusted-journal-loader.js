import { appCheck } from '../firebase.js';
import { getToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';

const LOADER_VERSION = 'trusted-studio-journal-loader-v1';
const TOKEN_TIMEOUT_MS = 15_000;
let state = 'checking';
let reason = 'app-check-token-requested';
let lastError = null;
let loaded = false;
let tokenIssuedAt = null;

function clean(value, max = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function emit(nextState, nextReason, extra = {}) {
  state = nextState;
  reason = nextReason;
  window.dispatchEvent(new CustomEvent('evara:app-check-status', {
    detail: {
      state,
      reason,
      loaderVersion: LOADER_VERSION,
      loaded,
      tokenIssuedAt,
      ...extra
    }
  }));
}

function timeoutAfter(milliseconds) {
  return new Promise((_, reject) => {
    const timer = window.setTimeout(() => {
      const error = new Error('App Check token acquisition timed out.');
      error.code = 'app-check-timeout';
      reject(error);
    }, milliseconds);
    timer.unref?.();
  });
}

async function acquireToken(forceRefresh = false) {
  if (!appCheck) {
    const error = new Error('Firebase App Check did not initialize. Trusted Studio synchronization is unavailable.');
    error.code = 'app-check-not-initialized';
    throw error;
  }
  const result = await Promise.race([
    getToken(appCheck, forceRefresh),
    timeoutAfter(TOKEN_TIMEOUT_MS)
  ]);
  if (!result?.token) {
    const error = new Error('Firebase App Check did not return an attestation token.');
    error.code = 'app-check-token-missing';
    throw error;
  }
  tokenIssuedAt = new Date().toISOString();
  return {
    issuedAt: tokenIssuedAt,
    expireTimeMillis: Number(result.expireTimeMillis || 0) || null
  };
}

async function loadTrustedJournal({ forceRefresh = false } = {}) {
  if (loaded && window.EvaraTrustedStudioJournal) return window.EvaraTrustedStudioJournal;
  emit('checking', forceRefresh ? 'app-check-token-refresh' : 'app-check-token-requested');
  try {
    const tokenMetadata = await acquireToken(forceRefresh);
    emit('ready', 'app-check-token-confirmed', tokenMetadata);
    await import('./studio-trusted-journal.js?v=1');
    if (!window.EvaraTrustedStudioJournal) {
      const error = new Error('Trusted Studio Journal adapter did not register after App Check succeeded.');
      error.code = 'trusted-adapter-registration-failed';
      throw error;
    }
    loaded = true;
    lastError = null;
    emit('ready', 'trusted-journal-loaded', tokenMetadata);
    return window.EvaraTrustedStudioJournal;
  } catch (error) {
    lastError = error;
    loaded = false;
    const code = clean(error?.code || error?.name || 'app-check-failed', 120);
    const message = clean(error?.message || error, 500);
    emit('recovery-required', code, { error: message });
    window.dispatchEvent(new CustomEvent('evara:trusted-studio-journal', {
      detail: {
        state: 'recovery-required',
        reason: 'app-check-unavailable',
        serviceCode: code,
        error: message,
        adapterVersion: null,
        loaderVersion: LOADER_VERSION
      }
    }));
    throw error;
  }
}

const readiness = loadTrustedJournal();
readiness.catch(() => undefined);

window.EvaraAppCheckReadiness = Object.freeze({
  version: LOADER_VERSION,
  ready: readiness,
  retry: () => loadTrustedJournal({ forceRefresh: true }),
  snapshot: () => ({
    version: LOADER_VERSION,
    state,
    reason,
    loaded,
    tokenIssuedAt,
    appCheckInitialized: Boolean(appCheck),
    error: lastError ? {
      code: clean(lastError?.code || lastError?.name || 'unknown', 120),
      message: clean(lastError?.message || lastError, 500)
    } : null
  })
});
