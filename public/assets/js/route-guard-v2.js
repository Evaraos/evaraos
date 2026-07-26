import {
  auth,
  onAuthStateChanged,
  hydrateUserProfile,
  getSavedUserProfile,
  clearSavedUserRole,
  clearSavedUserProfile
} from './firebase.js';
import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessRole
} from './access-control.js';

const ROUTES = Object.freeze({ login: './login.html' });
const AUTH_WAIT_TIMEOUT_MS = 4500;
let hasFinishedRouteGuard = false;

function safeProfile(profile = {}) {
  return Object.freeze({
    uid: String(profile.uid || profile.id || ''),
    id: String(profile.id || profile.uid || ''),
    email: String(profile.email || ''),
    displayName: String(profile.displayName || profile.fullName || profile.name || profile.email || ''),
    fullName: String(profile.fullName || profile.displayName || profile.name || ''),
    name: String(profile.name || profile.fullName || profile.displayName || ''),
    username: String(profile.username || ''),
    role: String(profile.role || ''),
    companyId: String(profile.companyId || ''),
    companyName: String(profile.companyName || ''),
    approvalStatus: String(profile.approvalStatus || ''),
    status: String(profile.status || ''),
    photoURL: String(profile.photoURL || profile.photoUrl || ''),
    phone: String(profile.phone || ''),
    notes: String(profile.notes || '')
  });
}

function publishRouteSession(detail = {}) {
  const profile = detail.profile && typeof detail.profile === 'object' ? safeProfile(detail.profile) : null;
  const session = Object.freeze({
    authenticated: Boolean(detail.authenticated),
    role: String(detail.role || ''),
    userId: String(detail.userId || profile?.uid || ''),
    source: String(detail.source || ''),
    profile,
    at: Date.now()
  });
  window.EvaraRouteSession = session;
  return session;
}

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail: { at: Date.now(), ...detail } }));
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
  const session = publishRouteSession(detail);
  if (window.EvaraLoader?.markSessionReady) window.EvaraLoader.markSessionReady(session);
  else revealWithoutLoader();
  emit('evara:session-ready', session);
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
    if (!/(login|signup|reset)\.html/.test(current)) sessionStorage.setItem('evaraos-intended-route', current);
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
  return !['inactive', 'suspended', 'disabled', 'rejected'].includes(status) && approval !== 'rejected';
}

function profileIsUsable(profile, user) {
  if (!profile || !user?.uid) return false;
  const uid = String(profile.uid || profile.id || '');
  const role = normalizeAccessRole(profile.role || '');
  return uid === user.uid && Boolean(role) && accountIsActive(profile);
}

function cachedProfileFor(user) {
  const cached = getSavedUserProfile?.() || null;
  return profileIsUsable(cached, user) ? cached : null;
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
  if (!user?.uid) return { profile: null, source: '' };
  const profile = await hydrateUserProfile(user, { requireVerified: true });
  if (profileIsUsable(profile, user)) return { profile, source: 'verified-route-guard' };

  // The cache is only a routing fallback. Firestore rules remain the data
  // authority, and the cached UID must exactly match Firebase Authentication.
  const cached = cachedProfileFor(user);
  if (cached) return { profile: cached, source: 'verified-route-guard-cache' };
  return { profile: null, source: '' };
}

async function resolveVerifiedSession() {
  const user = await waitForVerifiedFirebaseUser();
  if (!user) return { user: null, profile: null, role: '', source: '' };
  const resolved = await readVerifiedProfile(user);
  if (!resolved.profile) return { user, profile: null, role: '', source: '' };
  return {
    user,
    profile: resolved.profile,
    role: normalizeAccessRole(resolved.profile.role),
    source: resolved.source
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
    profile: session.profile,
    source: session.source
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
    if (mode === 'private') { await handlePrivateRoute(); return; }
    if (mode === 'auth') { await handleAuthRoute(); return; }
    handlePublicRoute(mode);
  } catch (error) {
    console.error('Route authorization failed:', error);
    if (mode === 'private') {
      const user = auth.currentUser;
      const cached = user ? cachedProfileFor(user) : null;
      const role = normalizeAccessRole(cached?.role || '');
      if (user && cached && role && canAccessPageName(pageName(), role)) {
        safeMarkReady({
          mode: 'private',
          authenticated: true,
          role,
          userId: user.uid,
          profile: cached,
          source: 'verified-route-guard-cache'
        });
        return;
      }
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRouteGuard, { once: true });
else initRouteGuard();
