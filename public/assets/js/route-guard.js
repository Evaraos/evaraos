import {
  auth,
  onAuthStateChanged,
  hydrateUserProfile,
  clearSavedUserRole,
  clearSavedUserProfile
} from './firebase.js';
import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessRole
} from './access-control.js';

const ROUTES = Object.freeze({
  login: './login.html'
});

const AUTH_WAIT_TIMEOUT_MS = 4500;
let hasFinishedRouteGuard = false;

function publishRouteSession(detail = {}) {
  const session = Object.freeze({
    authenticated: Boolean(detail.authenticated),
    role: String(detail.role || ''),
    userId: String(detail.userId || ''),
    source: String(detail.source || ''),
    at: Date.now()
  });
  window.EvaraRouteSession = session;
  return session;
}

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, {
    detail: { at: Date.now(), ...detail }
  }));
}

function pageName() {
  return window.location.pathname || '/index.html';
}

function normalizePath(path = '') {
  if (!path) return '';
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

function clearAuthPendingState() {
  document.documentElement.classList.remove('auth-pending');
  document.body?.classList.remove('auth-pending');
}

function revealWithoutLoader() {
  document.body?.classList.remove('app-loading');
  document.body?.classList.add('app-ready');
}

function safeMarkReady(detail = {}) {
  if (hasFinishedRouteGuard) return;
  hasFinishedRouteGuard = true;
  clearAuthPendingState();
  if (window.EvaraLoader?.markSessionReady) {
    window.EvaraLoader.markSessionReady(detail);
  } else {
    revealWithoutLoader();
  }
  emit('evara:session-ready', publishRouteSession(detail));
}

function clearUserSession() {
  clearSavedUserRole?.();
  clearSavedUserProfile?.();
}

function beginGuardRedirect(url, options = {}) {
  if (hasFinishedRouteGuard) return;
  hasFinishedRouteGuard = true;

  window.EvaraLoader?.beginNavigationLoad?.({
    title: options.title || 'Opening EvaraOS',
    subtitle: options.subtitle || 'Taking you to the right page.'
  });

  requestAnimationFrame(() => window.location.replace(url));
}

function saveIntendedRoute() {
  try {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!/(login|signup|reset)\.html/.test(current)) {
      sessionStorage.setItem('evaraos-intended-route', current);
    }
  } catch {}
}

function consumeIntendedRoute() {
  try {
    const saved = sessionStorage.getItem('evaraos-intended-route') || '';
    sessionStorage.removeItem('evaraos-intended-route');
    return normalizePath(saved);
  } catch {
    return '';
  }
}

function accountIsActive(profile = {}) {
  const status = String(profile.status || 'active').trim().toLowerCase();
  const approval = String(profile.approvalStatus || '').trim().toLowerCase();
  return !['inactive', 'suspended', 'disabled', 'rejected'].includes(status)
    && approval !== 'rejected';
}

function safeDestinationForRole(path, role) {
  const fallback = defaultRouteForRole(role);
  if (!path) return fallback;
  return canAccessPageName(path, role) ? path : fallback;
}

function waitForVerifiedFirebaseUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = null;

    const finish = (user = null) => {
      if (settled) return;
      settled = true;
      try { unsubscribe?.(); } catch {}
      resolve(user || null);
    };

    const timer = setTimeout(() => finish(auth.currentUser || null), AUTH_WAIT_TIMEOUT_MS);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      finish(user || null);
    });
  });
}

async function readVerifiedProfile(user) {
  if (!user?.uid) return null;

  const profile = await hydrateUserProfile(user, { requireVerified: true });
  if (!profile || profile.uid !== user.uid || !profile.role || !accountIsActive(profile)) return null;
  return profile;
}

async function resolveVerifiedSession() {
  const user = await waitForVerifiedFirebaseUser();
  if (!user) return { user: null, profile: null, role: '' };

  const profile = await readVerifiedProfile(user);
  if (!profile) return { user, profile: null, role: '' };

  return {
    user,
    profile,
    role: normalizeAccessRole(profile.role)
  };
}

async function handlePrivateRoute() {
  const session = await resolveVerifiedSession();

  if (!session.user || !session.profile || !session.role) {
    saveIntendedRoute();
    clearUserSession();
    beginGuardRedirect(ROUTES.login, {
      title: 'Secure Area',
      subtitle: 'Your account could not be securely verified.'
    });
    return;
  }

  if (!canAccessPageName(pageName(), session.role)) {
    beginGuardRedirect(defaultRouteForRole(session.role), {
      title: 'Opening your dashboard',
      subtitle: 'That screen is not authorized for this account.'
    });
    return;
  }

  safeMarkReady({
    mode: 'private',
    authenticated: true,
    role: session.role,
    userId: session.user.uid,
    source: 'verified-route-guard'
  });
}

async function handleAuthRoute() {
  const session = await resolveVerifiedSession();

  if (session.user && session.profile && session.role) {
    const intended = consumeIntendedRoute();
    beginGuardRedirect(safeDestinationForRole(intended, session.role), {
      title: 'Opening EvaraOS',
      subtitle: 'Your secure session is already active.'
    });
    return;
  }

  clearUserSession();
  safeMarkReady({ mode: 'auth', authenticated: false, source: 'verified-guest' });
}

function handlePublicRoute(mode) {
  safeMarkReady({
    mode: mode || 'public',
    authenticated: Boolean(auth.currentUser),
    source: 'public-route'
  });
}

async function initRouteGuard() {
  const mode = document.body?.dataset?.routeGuard || '';

  try {
    if (mode === 'private') {
      await handlePrivateRoute();
      return;
    }

    if (mode === 'auth') {
      await handleAuthRoute();
      return;
    }

    handlePublicRoute(mode);
  } catch (error) {
    console.error('Route authorization failed:', error);

    if (mode === 'private') {
      saveIntendedRoute();
      clearUserSession();
      beginGuardRedirect(ROUTES.login, {
        title: 'Returning to login',
        subtitle: 'Unable to verify your secure session.'
      });
      return;
    }

    safeMarkReady({ mode, error: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRouteGuard, { once: true });
} else {
  initRouteGuard();
}
