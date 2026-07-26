import { normalizeAccessRole } from '../access-control.js';

const VERIFIED_SOURCES = new Set([
  'verified-route-guard',
  'verified-route-guard-cache'
]);

function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function verifiedRouteSession() {
  const session = window.EvaraRouteSession || null;
  if (!session || !session.authenticated || !VERIFIED_SOURCES.has(String(session.source || ''))) return null;
  return session;
}

export function storedProfile() {
  return readJsonStorage('evaraos-user') || {};
}

export function actualRole() {
  const sessionRole = normalizeAccessRole(verifiedRouteSession()?.role || '');
  if (sessionRole) return sessionRole;

  const profileRole = normalizeAccessRole(storedProfile().role || '');
  if (profileRole) return profileRole;

  try {
    return normalizeAccessRole(
      localStorage.getItem('evaraos-role') ||
      sessionStorage.getItem('evaraos-role') ||
      ''
    );
  } catch {
    return '';
  }
}

export function registryRole(role = actualRole()) {
  const normalized = normalizeAccessRole(role);
  if (normalized === 'platform_admin' || normalized === 'owner') return 'owner';
  if (normalized === 'admin' || normalized === 'manager') return 'admin';
  if (normalized === 'vendor') return 'vendor';
  if (normalized === 'sales' || normalized === 'technician' || normalized === 'cleaner') return 'staff';
  if (normalized === 'customer') return 'customer';
  return 'guest';
}

export function isActuallyAuthenticated() {
  if (verifiedRouteSession()) return true;
  const profile = storedProfile();
  return Boolean(actualRole() && (profile.uid || profile.id || profile.email));
}

export function displayProfile() {
  const sessionProfile = verifiedRouteSession()?.profile;
  const profile = sessionProfile && typeof sessionProfile === 'object' ? sessionProfile : storedProfile();
  const name = String(
    profile.displayName ||
    profile.fullName ||
    profile.name ||
    profile.username ||
    profile.email ||
    'Evaraos User'
  );
  const image = String(
    profile.photoURL ||
    profile.photoUrl ||
    profile.avatarUrl ||
    profile.avatar ||
    profile.profilePhoto ||
    profile.profilePhotoUrl ||
    ''
  ).trim();
  return { ...profile, name, image, role: actualRole() };
}

export function navigationAuthoritySnapshot() {
  return Object.freeze({
    authenticated: isActuallyAuthenticated(),
    role: actualRole(),
    registryRole: registryRole(),
    profile: displayProfile(),
    source: verifiedRouteSession()?.source || 'stored-profile-fallback'
  });
}
