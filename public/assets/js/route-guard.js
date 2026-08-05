import {
  auth,
  onAuthStateChanged
} from './firebase.js';
import {
  canAccessPageName,
  defaultRouteForRole
} from './access-control.js';
import {
  ACCOUNT_LIFECYCLE_STATES,
  resolveAccountLifecycle,
  routeForAccountLifecycle
} from './account-lifecycle.js';
import {
  clearVerifiedProfileCache,
  readVerifiedUserProfile
} from './verified-profile.js';

const ROUTES = Object.freeze({
  login: '/login.html',
  accountStatus: '/account-status.html'
});

const AUTH_WAIT_TIMEOUT_MS = 4500;
let hasFinishedRouteGuard = false;

function clean(value = '') {
  return String(value || '').trim();
}

function publishRouteSession(detail = {}) {
  const session = Object.freeze({
    authenticated: Boolean(detail.authenticated),
    role: clean(detail.role),
    userId: clean(detail.userId),
    lifecycle: clean(detail.lifecycle),
    status: clean(detail.status),
    approvalStatus: clean(detail.approvalStatus),
    displayName: clean(detail.displayName),
    email: clean(detail.email),
    source: clean(detail.source),
    mode: clean(detail.mode),
    error: Boolean(detail.error),
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

function currentPath() {
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
    if (!/(login|signup|reset|account-status)\.html/.test(current)) {
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

function safeDestinationForRole(path, role) {
  const fallback = defaultRouteForRole(role);
  if (!path) return fallback;
  return canAccessPageName(path, role) ? path : fallback;
}

function accountStatusDestination(lifecycle) {
  return routeForAccountLifecycle(lifecycle || {
    state: ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED,
    active: false,
    role: ''
  });
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

async function resolveVerifiedSession() {
  const user = await waitForVerifiedFirebaseUser();
  if (!user) {
    return {
      user: null,
      profile: null,
      lifecycle: resolveAccountLifecycle(null)
    };
  }

  const profile = await readVerifiedUserProfile(user);
  return {
    user,
    profile,
    lifecycle: resolveAccountLifecycle(profile)
  };
}

function verifiedSessionDetail(mode, session, source = 'verified-route-guard') {
  return {
    mode,
    authenticated: Boolean(session.user),
    role: session.lifecycle.role,
    userId: session.user?.uid || '',
    lifecycle: session.lifecycle.state,
    status: session.lifecycle.status,
    approvalStatus: session.lifecycle.approvalStatus,
    displayName: session.profile?.displayName || session.user?.displayName || '',
    email: session.profile?.email || session.user?.email || '',
    source
  };
}

async function handlePrivateRoute() {
  const session = await resolveVerifiedSession();

  if (!session.user) {
    saveIntendedRoute();
    clearVerifiedProfileCache();
    beginGuardRedirect(ROUTES.login, {
      title: 'Secure Area',
      subtitle: 'Please sign in to continue.'
    });
    return;
  }

  if (!session.lifecycle.active) {
    saveIntendedRoute();
    beginGuardRedirect(accountStatusDestination(session.lifecycle), {
      title: 'Checking account status',
      subtitle: 'This account is not approved for application access.'
    });
    return;
  }

  if (!canAccessPageName(currentPath(), session.lifecycle.role)) {
    beginGuardRedirect(defaultRouteForRole(session.lifecycle.role), {
      title: 'Opening your dashboard',
      subtitle: 'That screen is not authorized for this account.'
    });
    return;
  }

  safeMarkReady(verifiedSessionDetail('private', session));
}

async function handleAuthRoute() {
  const session = await resolveVerifiedSession();

  if (!session.user) {
    clearVerifiedProfileCache();
    safeMarkReady({ mode: 'auth', authenticated: false, source: 'verified-guest' });
    return;
  }

  if (!session.lifecycle.active) {
    beginGuardRedirect(accountStatusDestination(session.lifecycle), {
      title: 'Opening account status',
      subtitle: 'Reviewing your current access state.'
    });
    return;
  }

  const intended = consumeIntendedRoute();
  beginGuardRedirect(safeDestinationForRole(intended, session.lifecycle.role), {
    title: 'Opening EvaraOS',
    subtitle: 'Your secure session is already active.'
  });
}

async function handleAccountStatusRoute() {
  const session = await resolveVerifiedSession();

  if (!session.user) {
    clearVerifiedProfileCache();
    beginGuardRedirect(ROUTES.login, {
      title: 'Sign in required',
      subtitle: 'Sign in to review your account status.'
    });
    return;
  }

  if (session.lifecycle.active) {
    const intended = consumeIntendedRoute();
    beginGuardRedirect(safeDestinationForRole(intended, session.lifecycle.role), {
      title: 'Opening EvaraOS',
      subtitle: 'Your account is approved and active.'
    });
    return;
  }

  safeMarkReady(verifiedSessionDetail('account-status', session));
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

    if (mode === 'account-status') {
      await handleAccountStatusRoute();
      return;
    }

    handlePublicRoute(mode);
  } catch (error) {
    console.error('Route authorization failed:', error);

    if (mode === 'private') {
      saveIntendedRoute();
      if (auth.currentUser) {
        beginGuardRedirect(`${ROUTES.accountStatus}?state=${ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED}`, {
          title: 'Verification required',
          subtitle: 'Unable to verify the account profile securely.'
        });
      } else {
        clearVerifiedProfileCache();
        beginGuardRedirect(ROUTES.login, {
          title: 'Returning to login',
          subtitle: 'Unable to verify your secure session.'
        });
      }
      return;
    }

    if (mode === 'auth' && auth.currentUser) {
      beginGuardRedirect(`${ROUTES.accountStatus}?state=${ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED}`, {
        title: 'Verification required',
        subtitle: 'Unable to verify the account profile securely.'
      });
      return;
    }

    if (mode === 'account-status') {
      safeMarkReady({
        mode,
        authenticated: Boolean(auth.currentUser),
        lifecycle: ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED,
        source: 'verified-route-guard',
        error: true
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
