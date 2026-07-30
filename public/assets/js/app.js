import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from './firebase.js';
import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessRole
} from './access-control.js';

const BASE_PATH = '/evaraos';
const SECTION_PAGE_MAP = Object.freeze({
  dashboard: 'dashboard.html',
  companies: 'companies.html',
  users: 'users.html',
  applications: 'applications.html',
  sales_reps: 'sales_reps.html',
  leads: 'leads.html',
  jobs: 'jobs.html',
  audit: 'audit.html',
  org: 'org.html',
  performance: 'performance.html',
  customer_dashboard: 'customer_dashboard.html',
  settings: 'settings-v2.html',
  profile: 'profile.html',
  security: 'security.html',
  qa: 'qa.html'
});

export function getAssetPath(path = '') {
  if (!path) return '#';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith(BASE_PATH)) return path;
  if (path.startsWith('/')) return `${BASE_PATH}${path}`;
  return `${BASE_PATH}/${path}`;
}

export function normalizeRole(role = '') {
  return normalizeAccessRole(role) || 'guest';
}

export function hasPermission(user, section) {
  return canAccess(user?.role, section);
}

export function canAccess(role, section) {
  const normalizedRole = normalizeAccessRole(role);
  if (!normalizedRole) return false;
  if (section === 'self') return true;
  const page = SECTION_PAGE_MAP[String(section || '').trim()] || String(section || '').trim();
  return Boolean(page) && canAccessPageName(page, normalizedRole);
}

export function renderSidebar(role, active = '') {
  const normalizedRole = normalizeAccessRole(role);
  const links = [
    { key: 'dashboard', href: '/dashboard.html', label: 'Dashboard' },
    { key: 'companies', href: '/companies.html', label: 'Companies' },
    { key: 'users', href: '/users.html', label: 'Users' },
    { key: 'applications', href: '/applications.html', label: 'Applications' },
    { key: 'sales_reps', href: '/sales_reps.html', label: 'Sales Reps' },
    { key: 'leads', href: '/leads.html', label: 'Leads' },
    { key: 'jobs', href: '/jobs.html', label: 'Jobs' },
    { key: 'audit', href: '/audit.html', label: 'Audit' },
    { key: 'org', href: '/org.html', label: 'Organization' },
    { key: 'performance', href: '/performance.html', label: 'Performance' },
    { key: 'customer_dashboard', href: '/customer_dashboard.html', label: 'Customer Portal' }
  ];

  return `
    <div class="sidebar-inner">
      <a class="sidebar-logo-wrap" href="${getAssetPath('index.html')}">
        <img src="${getAssetPath('assets/img/evaraos_logo.png')}" alt="Evaraos Logo" class="sidebar-logo" />
      </a>
      <nav class="sidebar-nav">
        ${links.filter((link) => normalizedRole && canAccessPageName(link.href, normalizedRole)).map((link) => `
          <a href="${link.href}" class="sidebar-link ${active === link.key ? 'active' : ''}">${link.label}</a>
        `).join('')}
      </nav>
    </div>`;
}

export async function loadCompany(companyId) {
  if (!companyId) return null;
  try {
    const snap = await getDoc(doc(db, 'companies', companyId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : { id: companyId, name: companyId };
  } catch (error) {
    console.error('Failed to load company:', error);
    return { id: companyId, name: companyId };
  }
}

export async function hydrateCurrentUser(firebaseUser) {
  if (!firebaseUser) return null;
  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!snap.exists()) {
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        role: 'customer',
        approvalStatus: 'pending',
        active: true
      };
    }

    const normalizedRole = normalizeAccessRole(snap.data()?.role);
    if (!normalizedRole) throw new Error(`Unsupported account role: ${String(snap.data()?.role || 'missing')}`);

    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      ...snap.data(),
      role: normalizedRole
    };
  } catch (error) {
    console.error('Failed to hydrate current user:', error);
    return null;
  }
}

export function requireAuth(callback, options = {}) {
  const { allowRoles = null, redirectTo = '/login.html' } = options;

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      window.location.href = redirectTo;
      return;
    }

    const user = await hydrateCurrentUser(firebaseUser);
    if (!user) {
      window.location.href = redirectTo;
      return;
    }

    const userRole = normalizeAccessRole(user.role);
    if (Array.isArray(allowRoles) && allowRoles.length) {
      const allowed = allowRoles.map(normalizeAccessRole).filter(Boolean);
      if (!allowed.includes(userRole)) {
        window.location.href = defaultRouteForRole(userRole);
        return;
      }
    }

    callback(user);
  });
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = '/index.html';
}

export async function bindTopbar(user, title = 'Dashboard') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-left">
        <a class="brand-link" href="/index.html">
          <img src="/assets/img/evaraos_logo.png" alt="Evaraos Logo" class="brand-logo" />
          <span class="brand-text">Evaraos</span>
        </a>
      </div>
      <div class="topbar-center"><h1 class="page-title">${title}</h1></div>
      <div class="topbar-right">
        <button type="button" class="theme-btn" data-theme-toggle data-theme-label="true"><span data-theme-text>Appearance</span></button>
        <div class="user-pill">
          <span>${user?.name || user?.username || user?.email || 'User'}</span>
          <span class="user-role">${normalizeRole(user?.role || 'guest')}</span>
        </div>
        <button id="logoutBtn" class="btn btn-outline" type="button">Logout</button>
      </div>
    </div>`;

  window.EvaraTheme?.updateThemeControls?.();
  document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
}

export async function fetchAllCollection(collectionName, options = {}) {
  const { filters = [], orderByField = '', orderDirection = 'asc', max = 500 } = options;
  try {
    const constraints = [];
    for (const filter of filters) {
      if (filter?.field) constraints.push(where(filter.field, filter.op || '==', filter.value));
    }
    if (orderByField) constraints.push(orderBy(orderByField, orderDirection));
    if (max) constraints.push(limit(max));

    const ref = collection(db, collectionName);
    const result = await getDocs(constraints.length ? query(ref, ...constraints) : query(ref, limit(max)));
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.error(`Failed to fetch collection "${collectionName}":`, error);
    throw error;
  }
}

export function fetchUsersByCompany(companyId) {
  if (!companyId) return Promise.resolve([]);
  return fetchAllCollection('users', {
    filters: [{ field: 'companyId', op: '==', value: companyId }],
    max: 500
  });
}

export async function createDocument(collectionName, payload = {}) {
  const finalPayload = { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const created = await addDoc(collection(db, collectionName), finalPayload);
  return { id: created.id, ...finalPayload };
}

export async function updateDocument(collectionName, id, payload = {}) {
  await updateDoc(doc(db, collectionName, id), { ...payload, updatedAt: serverTimestamp() });
  return true;
}

export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
  return true;
}

export async function saveUserProfile(uid, payload = {}) {
  await setDoc(doc(db, 'users', uid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  return true;
}

export async function createSalesRep(payload = {}, currentUser = null) {
  const cleanUsername = String(payload.username || '').trim().toLowerCase();
  const cleanName = String(payload.fullName || payload.name || '').trim();
  if (!cleanName || !cleanUsername) throw new Error('Full name and username are required.');

  return createDocument('users', {
    name: cleanName,
    username: cleanUsername,
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').trim(),
    status: payload.status || 'active',
    active: payload.status !== 'inactive',
    notes: String(payload.notes || '').trim(),
    role: 'sales_rep',
    companyId: currentUser?.companyId || payload.companyId || '',
    reportsTo: currentUser?.uid || payload.reportsTo || '',
    approvalStatus: 'approved'
  });
}

export async function updateSalesRep(id, payload = {}) {
  const cleanUsername = String(payload.username || '').trim().toLowerCase();
  const cleanName = String(payload.fullName || payload.name || '').trim();
  if (!cleanName || !cleanUsername) throw new Error('Full name and username are required.');

  return updateDocument('users', id, {
    name: cleanName,
    username: cleanUsername,
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').trim(),
    status: payload.status || 'active',
    active: payload.status !== 'inactive',
    notes: String(payload.notes || '').trim()
  });
}
