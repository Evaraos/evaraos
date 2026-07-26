import {
  auth,
  onAuthStateChanged,
  hydrateUserProfile,
  getSavedUserProfile,
  getSavedUserRole,
  normalizeRole
} from '../firebase.js';

const ALLOWED_ROLES = new Set(['owner', 'admin']);
let builderLoaded = false;
let authResolved = false;

function savedRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || 'customer';
}

function roleIsAllowed() {
  return ALLOWED_ROLES.has(savedRole());
}

async function loadBuilder() {
  if (builderLoaded) return;
  builderLoaded = true;
  await import('./studio-visual-builder.js?v=3-auth-gated');
}

async function hydrateAndLoad(user) {
  if (!user) return;
  const profile = await hydrateUserProfile(user, { requireVerified: true });
  authResolved = true;
  const role = normalizeRole(profile?.role || savedRole());
  if (ALLOWED_ROLES.has(role)) await loadBuilder();
}

if (roleIsAllowed()) {
  loadBuilder().catch((error) => console.error('Studio builder failed to load:', error));
} else {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    hydrateAndLoad(user)
      .catch((error) => console.error('Studio authorization hydration failed:', error))
      .finally(() => unsubscribe?.());
  });

  window.addEventListener('evara:session-ready', () => {
    authResolved = true;
    if (roleIsAllowed()) loadBuilder().catch((error) => console.error('Studio builder failed to load:', error));
  });

  setTimeout(() => {
    if (!builderLoaded && authResolved && roleIsAllowed()) {
      loadBuilder().catch((error) => console.error('Studio builder failed to load:', error));
    }
  }, 6500);
}
